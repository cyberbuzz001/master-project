import React, { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode, useSyncExternalStore } from 'react';
import { MarketTick } from '../types';
import { logMarketTelemetry } from './useMarketTelemetry';
import { normalizeToken } from '../utils/symbology';

export type SocketStatus = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING' | 'UNAVAILABLE';

/** Admin-only real-time event types forwarded from the shared /ws connection. */
export type AdminEventType =
  | 'USER_STATUS_UPDATED' | 'USER_PROFILE_UPDATED' | 'ORDER_CREATED' | 'ORDER_UPDATED'
  | 'TRADE_EXECUTED' | 'POSITION_UPDATED' | 'FUNDS_UPDATED'
  | 'FUND_REQUEST_CREATED' | 'FUND_REQUEST_UPDATED' | 'KYC_UPDATED' | 'RISK_ALERT'
  | 'ADMIN_NOTIFICATION_CREATED' | 'CHAT_MESSAGE_RECEIVED';

export interface AdminSocketEvent {
  type: AdminEventType;
  userId: string;
  data: any;
  timestamp: number;
}

export interface MarketSocketContextType {
  status: SocketStatus;
  ticks: Map<string, MarketTick>;
  lastTickTimestamps: Map<string, number>;
  firstSubscribedAt: Map<string, number>;
  reconnectCount: number;
  subscribe: (tokens: string[]) => void;
  unsubscribe: (tokens: string[]) => void;
  /** Register a listener for admin-only events forwarded over the same connection.
   *  Returns an unsubscribe function. Pass a specific type to filter, or omit for all. */
  onAdminEvent: (callback: (event: AdminSocketEvent) => void, type?: AdminEventType) => () => void;
  /** Watch one customer's admin events (Customer360 drill-down). Ref-counted like subscribe/unsubscribe. */
  adminSubscribeUser: (userId: string) => void;
  adminUnsubscribeUser: (userId: string) => void;
  /** Watch every customer's admin events (platform-wide queue views — OrderMonitor, FundsDashboard). Ref-counted. */
  adminSubscribeAll: () => void;
  adminUnsubscribeAll: () => void;
  /** Send a live-chat message. Customers omit toUserId (implicitly targets support);
   *  staff must supply the customer's userId they're replying to. */
  sendChatMessage: (text: string, toUserId?: string) => void;
}

const MarketSocketContext = createContext<MarketSocketContextType | null>(null);

const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;

// ── Global Fine-Grained Reactive Tick Store ───────────────────────────────────
class GlobalTickStore {
  private static instance: GlobalTickStore;
  private ticks = new Map<string, MarketTick>();
  private listeners = new Map<string, Set<() => void>>();

  public static getInstance(): GlobalTickStore {
    if (!GlobalTickStore.instance) {
      GlobalTickStore.instance = new GlobalTickStore();
    }
    return GlobalTickStore.instance;
  }

  public updateTicks(newTicks: Map<string, MarketTick>): void {
    const changedTokens: string[] = [];
    newTicks.forEach((tick, token) => {
      this.ticks.set(token, tick);
      changedTokens.push(token);
    });

    // Notify only components subscribed to the modified tokens
    changedTokens.forEach(token => {
      const subs = this.listeners.get(token);
      if (subs && subs.size > 0) {
        subs.forEach(cb => cb());
      }
    });
  }

  public subscribe(token: string, onStoreChange: () => void): () => void {
    if (!token) return () => {};
    if (!this.listeners.has(token)) {
      this.listeners.set(token, new Set());
    }
    this.listeners.get(token)!.add(onStoreChange);

    return () => {
      const subs = this.listeners.get(token);
      if (subs) {
        subs.delete(onStoreChange);
        if (subs.size === 0) this.listeners.delete(token);
      }
    };
  }

  public getSnapshot = (token: string): MarketTick | undefined => {
    return this.ticks.get(token);
  };

  public getAllTicks(): Map<string, MarketTick> {
    return this.ticks;
  }
}

export const globalTickStore = GlobalTickStore.getInstance();

interface MarketSocketProviderProps {
  children: ReactNode;
  userToken?: string | null;
}

export const MarketSocketProvider: React.FC<MarketSocketProviderProps> = ({ children, userToken }) => {
  const [status, setStatus] = useState<SocketStatus>('CONNECTING');
  const [ticks, setTicks] = useState<Map<string, MarketTick>>(new Map());
  const [lastTickTimestamps, setLastTickTimestamps] = useState<Map<string, number>>(new Map());
  const [reconnectCount, setReconnectCount] = useState<number>(0);

  // Active subscriptions ref-counting map: token -> subscriber count
  const subscriptionCountsRef = useRef<Map<string, number>>(new Map());
  // Tracks timestamp when token was first subscribed (for 10s initial tick timeout check)
  const firstSubscribedAtRef = useRef<Map<string, number>>(new Map());
  const [firstSubscribedAt, setFirstSubscribedAt] = useState<Map<string, number>>(new Map());

  const wsRef = useRef<WebSocket | null>(null);
  const pendingTicksRef = useRef<Map<string, MarketTick>>(new Map());
  const dirtyTimestampsRef = useRef<Map<string, number>>(new Map());
  const rafIdRef = useRef<number | null>(null);
  const trailingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastContextSyncRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef<boolean>(true);

  // Admin event listeners: Set of {callback, type?} — type undefined means "all types"
  const adminListenersRef = useRef<Set<{ callback: (event: AdminSocketEvent) => void; type?: AdminEventType }>>(new Set());
  // Ref-counted like token subscriptions, so multiple components watching the same
  // customer (or all-customers mode) don't stomp each other's un-subscribe on unmount.
  const adminUserWatchCountsRef = useRef<Map<string, number>>(new Map());
  const adminWatchAllCountRef = useRef<number>(0);

  const flushContext = useCallback(() => {
    if (trailingTimeoutRef.current) {
      clearTimeout(trailingTimeoutRef.current);
      trailingTimeoutRef.current = null;
    }
    lastContextSyncRef.current = Date.now();
    setTicks(new Map(globalTickStore.getAllTicks()));

    if (dirtyTimestampsRef.current.size > 0) {
      const dirty = new Map(dirtyTimestampsRef.current);
      dirtyTimestampsRef.current.clear();
      setLastTickTimestamps(prev => {
        const next = new Map(prev);
        dirty.forEach((ts, tok) => next.set(tok, ts));
        return next;
      });
    }
  }, []);

  /**
   * PERFORMANCE & LATENCY OPTIMIZATION:
   * Incoming WebSocket ticks are accumulated in pendingTicksRef and flushed once per browser
   * animation frame (~16ms) via requestAnimationFrame.
   * Updates globalTickStore for fine-grained O(1) subscriber dispatch without broad context thrashing.
   * Trailing timeout guarantees that low-frequency ticks (e.g. SENSEX) arriving during the 250ms
   * cooldown window are never dropped from broad context and tick freshness maps.
   */
  const scheduleBatchUpdate = useCallback(() => {
    if (rafIdRef.current !== null) return;

    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      if (!isMountedRef.current || pendingTicksRef.current.size === 0) return;

      const newTicks = new Map(pendingTicksRef.current);
      pendingTicksRef.current.clear();
      const now = Date.now();

      // 1. Dispatch to fine-grained Token subscribers (0 context re-render overhead)
      globalTickStore.updateTicks(newTicks);

      // Accumulate timestamps for all tokens & aliases updated in this frame
      newTicks.forEach((tick, token) => {
        const ts = tick.timestamp && tick.timestamp > 0 ? tick.timestamp : now;
        dirtyTimestampsRef.current.set(token, ts);
      });

      // 2. Throttle broad React Context update to 250ms with trailing edge guarantee
      const elapsed = now - lastContextSyncRef.current;
      if (elapsed >= 250) {
        flushContext();
      } else if (!trailingTimeoutRef.current) {
        trailingTimeoutRef.current = setTimeout(() => {
          trailingTimeoutRef.current = null;
          if (isMountedRef.current) {
            flushContext();
          }
        }, 250 - elapsed);
      }
    });
  }, [flushContext]);

  // Send WS subscription message for tokens
  const sendSubscribe = useCallback((tokens: string[]) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && tokens.length > 0) {
      try {
        wsRef.current.send(JSON.stringify({ action: 'SUBSCRIBE', tokens }));
      } catch (err) {
        console.error('[MarketSocket] Failed to send SUBSCRIBE', err);
      }
    }
  }, []);

  // Send WS unsubscribe message for tokens
  const sendUnsubscribe = useCallback((tokens: string[]) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && tokens.length > 0) {
      try {
        wsRef.current.send(JSON.stringify({ action: 'UNSUBSCRIBE', tokens }));
      } catch (err) {
        console.error('[MarketSocket] Failed to send UNSUBSCRIBE', err);
      }
    }
  }, []);

  const sendAdminAction = useCallback((action: string, extra?: Record<string, any>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ action, ...extra }));
      } catch (err) {
        console.error(`[MarketSocket] Failed to send ${action}`, err);
      }
    }
  }, []);

  const onAdminEvent = useCallback((callback: (event: AdminSocketEvent) => void, type?: AdminEventType) => {
    const entry = { callback, type };
    adminListenersRef.current.add(entry);
    return () => { adminListenersRef.current.delete(entry); };
  }, []);

  const adminSubscribeUser = useCallback((userId: string) => {
    if (!userId) return;
    const count = adminUserWatchCountsRef.current.get(userId) || 0;
    adminUserWatchCountsRef.current.set(userId, count + 1);
    if (count === 0) sendAdminAction('ADMIN_SUBSCRIBE', { userId });
  }, [sendAdminAction]);

  const adminUnsubscribeUser = useCallback((userId: string) => {
    if (!userId) return;
    const count = adminUserWatchCountsRef.current.get(userId) || 0;
    if (count <= 1) {
      adminUserWatchCountsRef.current.delete(userId);
      sendAdminAction('ADMIN_UNSUBSCRIBE', { userId });
    } else {
      adminUserWatchCountsRef.current.set(userId, count - 1);
    }
  }, [sendAdminAction]);

  const adminSubscribeAll = useCallback(() => {
    adminWatchAllCountRef.current += 1;
    if (adminWatchAllCountRef.current === 1) sendAdminAction('ADMIN_SUBSCRIBE_ALL');
  }, [sendAdminAction]);

  const adminUnsubscribeAll = useCallback(() => {
    adminWatchAllCountRef.current = Math.max(0, adminWatchAllCountRef.current - 1);
    if (adminWatchAllCountRef.current === 0) sendAdminAction('ADMIN_UNSUBSCRIBE_ALL');
  }, [sendAdminAction]);

  const sendChatMessage = useCallback((text: string, toUserId?: string) => {
    if (!text.trim()) return;
    sendAdminAction('CHAT_SEND', toUserId ? { text, toUserId } : { text });
  }, [sendAdminAction]);

  // Public subscribe method with ref-counting
  const subscribe = useCallback((tokens: string[]) => {
    if (!tokens || tokens.length === 0) return;
    const now = Date.now();
    const tokensToSubscribeOnWS: string[] = [];

    tokens.forEach(t => {
      if (!t) return;
      const currentCount = subscriptionCountsRef.current.get(t) || 0;
      subscriptionCountsRef.current.set(t, currentCount + 1);

      if (currentCount === 0) {
        tokensToSubscribeOnWS.push(t);
        firstSubscribedAtRef.current.set(t, now);
      }
    });

    if (tokensToSubscribeOnWS.length > 0) {
      setFirstSubscribedAt(new Map(firstSubscribedAtRef.current));
      sendSubscribe(tokensToSubscribeOnWS);
    }
  }, [sendSubscribe]);

  // Public unsubscribe method with ref-counting
  const unsubscribe = useCallback((tokens: string[]) => {
    if (!tokens || tokens.length === 0) return;
    const tokensToUnsubscribeOnWS: string[] = [];

    tokens.forEach(t => {
      if (!t) return;
      const currentCount = subscriptionCountsRef.current.get(t) || 0;
      if (currentCount <= 1) {
        subscriptionCountsRef.current.delete(t);
        firstSubscribedAtRef.current.delete(t);
        tokensToUnsubscribeOnWS.push(t);
      } else {
        subscriptionCountsRef.current.set(t, currentCount - 1);
      }
    });

    if (tokensToUnsubscribeOnWS.length > 0) {
      setFirstSubscribedAt(new Map(firstSubscribedAtRef.current));
      sendUnsubscribe(tokensToUnsubscribeOnWS);
    }
  }, [sendUnsubscribe]);

  // Connection & Exponential Backoff Reconnect Logic
  useEffect(() => {
    isMountedRef.current = true;
    let attempts = 0;
    const lastPongRef = { current: Date.now() };

    const connect = () => {
      if (!isMountedRef.current) return;

      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.onmessage = null;
        try { wsRef.current.close(); } catch (_) {}
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws${userToken ? `?token=${userToken}` : ''}`;
      
      setStatus(attempts === 0 ? 'CONNECTING' : 'RECONNECTING');
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      lastPongRef.current = Date.now();

      ws.onopen = () => {
        if (!isMountedRef.current) return;
        setStatus('CONNECTED');
        setReconnectCount(0);
        attempts = 0;
        lastPongRef.current = Date.now();
        logMarketTelemetry('SOCKET_CONNECTED');

        // Ping heartbeat every 25s with 40s PONG timeout guard
        pingIntervalRef.current = setInterval(() => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            if (Date.now() - lastPongRef.current > 40000) {
              console.warn('[MarketSocket] Pong timeout (>40s) — socket half-open, triggering reconnect.');
              try { wsRef.current.close(); } catch (_) {}
              return;
            }
            wsRef.current.send(JSON.stringify({ action: 'PING' }));
          }
        }, 25000);

        // Auto re-subscribe to all active tokens
        const activeTokens = Array.from(subscriptionCountsRef.current.keys());
        if (activeTokens.length > 0) {
          sendSubscribe(activeTokens);
        }

        // Auto re-subscribe to admin watches (per-customer and/or platform-wide)
        adminUserWatchCountsRef.current.forEach((_count, userId) => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ action: 'ADMIN_SUBSCRIBE', userId }));
          }
        });
        if (adminWatchAllCountRef.current > 0 && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ action: 'ADMIN_SUBSCRIBE_ALL' }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === 'PONG' || message.action === 'PONG') {
            lastPongRef.current = Date.now();
            return;
          }

          const storeTick = (t: MarketTick) => {
            if (!t || !t.instrumentToken) return;
            const aliasSet = new Set<string>([
              t.instrumentToken,
              ...(normalizeToken(t.instrumentToken)),
              ...(t.symbol ? normalizeToken(t.symbol) : []),
              ...((t as any).tradingSymbol ? normalizeToken((t as any).tradingSymbol) : [])
            ]);

            aliasSet.forEach(aliasKey => {
              pendingTicksRef.current.set(aliasKey, t);
            });
          };

          if (message.type === 'TICK_SNAPSHOT' && Array.isArray(message.data)) {
            lastPongRef.current = Date.now();
            message.data.forEach((t: MarketTick) => storeTick(t));
            scheduleBatchUpdate();
          } else if (message.type === 'MARKET_TICK' && message.data) {
            lastPongRef.current = Date.now();
            storeTick(message.data as MarketTick);
            scheduleBatchUpdate();
          } else if (message.type === 'NOTIFICATION') {
            lastPongRef.current = Date.now();
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('market-notification', { detail: message.data || message }));
            }
          } else if (message.type && adminListenersRef.current.size > 0) {
            // Any other typed frame (ORDER_CREATED, POSITION_UPDATED, FUNDS_UPDATED,
            // FUND_REQUEST_CREATED, etc.) is an admin event — fan out to registered listeners.
            const adminEvent: AdminSocketEvent = {
              type: message.type, userId: message.userId, data: message.data, timestamp: message.timestamp,
            };
            adminListenersRef.current.forEach(({ callback, type }) => {
              if (!type || type === adminEvent.type) callback(adminEvent);
            });
          }
        } catch (_) {}
      };

      ws.onclose = () => {
        if (!isMountedRef.current) return;
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

        attempts++;
        setReconnectCount(attempts);
        setStatus('DISCONNECTED');

        // Full jitter exponential backoff: prevents thundering herd on server restart
        const base = Math.min(INITIAL_BACKOFF_MS * Math.pow(1.5, Math.min(attempts - 1, 8)), MAX_BACKOFF_MS);
        const backoffMs = Math.round(base * (0.5 + Math.random() * 0.5));
        logMarketTelemetry('RECONNECT_ATTEMPT', { attempt: attempts, backoffMs });

        reconnectTimeoutRef.current = setTimeout(connect, backoffMs);
      };

      ws.onerror = () => {
        try { ws?.close(); } catch (_) {}
      };
    };

    connect();

    return () => {
      isMountedRef.current = false;
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      if (trailingTimeoutRef.current) clearTimeout(trailingTimeoutRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [userToken, scheduleBatchUpdate, sendSubscribe]);

  return React.createElement(
    MarketSocketContext.Provider,
    {
      value: {
        status,
        ticks,
        lastTickTimestamps,
        firstSubscribedAt,
        reconnectCount,
        subscribe,
        unsubscribe,
        onAdminEvent,
        adminSubscribeUser,
        adminUnsubscribeUser,
        adminSubscribeAll,
        adminUnsubscribeAll,
        sendChatMessage,
      },
    },
    children
  );
};

export function useMarketSocket(): MarketSocketContextType {
  const context = useContext(MarketSocketContext);
  if (!context) {
    throw new Error('useMarketSocket must be used within a MarketSocketProvider');
  }
  return context;
}

export function useSubscribeTokens(tokens: string[]) {
  const { subscribe, unsubscribe } = useMarketSocket();
  // `.sort()` mutates in place — sorting `tokens` directly would silently
  // reorder whatever array the caller passed in (often a useMemo result fed
  // to other hooks in the same render, e.g. OptionChainView.tsx passes the
  // same `visibleTokens` array to both this hook and useMultiTickFreshness).
  // Harmless today only because every current second-consumer happens to key
  // by token in a Map rather than by position — sort a copy so this doesn't
  // become order-dependent breakage for some future caller.
  const tokensKey = [...tokens].sort().join(',');

  useEffect(() => {
    if (!tokens || tokens.length === 0) return;
    const tokenList = tokens.filter(Boolean);
    subscribe(tokenList);

    return () => {
      unsubscribe(tokenList);
    };
  }, [tokensKey, subscribe, unsubscribe]);
}

/** Watch one customer's admin events for the lifetime of the calling component (Customer360). */
export function useAdminSubscribeUser(userId: string | null | undefined) {
  const { adminSubscribeUser, adminUnsubscribeUser } = useMarketSocket();

  useEffect(() => {
    if (!userId) return;
    adminSubscribeUser(userId);
    return () => { adminUnsubscribeUser(userId); };
  }, [userId, adminSubscribeUser, adminUnsubscribeUser]);
}

/** Watch every customer's admin events for the lifetime of the calling component
 *  (OrderMonitor, FundsDashboard — platform-wide queue views). */
export function useAdminSubscribeAll() {
  const { adminSubscribeAll, adminUnsubscribeAll } = useMarketSocket();

  useEffect(() => {
    adminSubscribeAll();
    return () => { adminUnsubscribeAll(); };
  }, [adminSubscribeAll, adminUnsubscribeAll]);
}

/**
 * HIGH-PERFORMANCE REACTIVE TICK HOOK:
 * Subscribes to a single token's market ticks via useSyncExternalStore.
 * Re-renders ONLY when this specific token receives an updated tick,
 * completely bypassing broad React Context re-renders.
 */
export function useTokenTick(token: string | null | undefined): MarketTick | undefined {
  const cleanToken = token ? token.trim() : '';

  return useSyncExternalStore(
    useCallback((onStoreChange) => {
      if (!cleanToken) return () => {};
      return globalTickStore.subscribe(cleanToken, onStoreChange);
    }, [cleanToken]),
    useCallback(() => {
      if (!cleanToken) return undefined;
      return globalTickStore.getSnapshot(cleanToken);
    }, [cleanToken])
  );
}
