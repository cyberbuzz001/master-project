import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { MarketDataEngine } from '../marketData/MarketDataEngine';
import { SymbologyNormalizer } from '../marketData/SymbologyNormalizer';
import { getJwtSecret } from '../middleware/auth';
import { adminEventBus, AdminEvent } from '../utils/adminEventBus';
import { recordChatMessage } from '../utils/chatMessages';
import { maybeGenerateSupportBotReply } from '../utils/supportBot';

export interface ExtendedWebSocket extends WebSocket {
  isAlive?: boolean;
  userId?: string;
  userRole?: string;
  subscriptions?: Set<string>;
  adminWatchedUsers?: Set<string>;
  adminWatchAll?: boolean;
}

// Matches adminApi.ts's own ADMIN_ROLES list — this one previously omitted OPERATIONS_MANAGER,
// COMPLIANCE_OFFICER, RISK_OFFICER, DEALER, ANALYST, and SUPPORT_AGENT, meaning those roles
// could never use ADMIN_SUBSCRIBE_ALL at the gateway level even where their permission catalog
// entry (e.g. SUPPORT_CHAT_RESPOND) says they should have live access. Found while wiring the
// live-chat feature, which SUPPORT_AGENT specifically needs.
const ADMIN_ROLES = [
  'SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OPERATIONS_MANAGER', 'FINANCE_MANAGER',
  'KYC_OFFICER', 'COMPLIANCE_OFFICER', 'RISK_MANAGER', 'RISK_OFFICER',
  'DEALER', 'ANALYST', 'SUPPORT_AGENT', 'READ_ONLY_AUDITOR',
];

// Inverted Subscription Index for O(1) tick dispatch
class TokenSubscriptionIndex {
  private index = new Map<string, Set<ExtendedWebSocket>>();

  public add(token: string, ws: ExtendedWebSocket): void {
    if (!this.index.has(token)) {
      this.index.set(token, new Set());
    }
    this.index.get(token)!.add(ws);
  }

  public remove(token: string, ws: ExtendedWebSocket): void {
    const set = this.index.get(token);
    if (set) {
      set.delete(ws);
      if (set.size === 0) {
        this.index.delete(token);
      }
    }
  }

  public removeAll(ws: ExtendedWebSocket): void {
    if (ws.subscriptions) {
      ws.subscriptions.forEach(token => {
        this.remove(token, ws);
      });
    }
  }

  public getSubscribers(token: string): Set<ExtendedWebSocket> | undefined {
    return this.index.get(token);
  }
}

const subscriptionIndex = new TokenSubscriptionIndex();
let totalMessagesBroadcast = 0;
let totalDroppedFrames = 0;
let wssInstance: WebSocketServer | null = null;

/**
 * Delivers a payload directly to every currently-connected socket for one user,
 * regardless of admin-watch flags — the one delivery path `adminEventBus`'s
 * fan-out can't cover, since that only reaches sockets with `adminWatchedUsers`/
 * `adminWatchAll` set. Used by the live-chat feature to push a message straight to
 * the customer (or staff member) it's addressed to, in addition to the admin-side
 * fan-out `chatMessages.ts`'s `recordChatMessage` already triggers. A linear scan
 * over `wss.clients` is fine at this platform's connection scale — no separate
 * userId-keyed registry needed for what's expected to be a low-frequency send.
 */
export function deliverToUser(userId: string, payload: object): void {
  if (!wssInstance) return;
  const message = JSON.stringify(payload);
  wssInstance.clients.forEach((client: ExtendedWebSocket) => {
    if (client.userId === userId && client.readyState === WebSocket.OPEN) {
      try { client.send(message); } catch (err) { /* suppress send errors for dead connections */ }
    }
  });
}

export function getWebSocketMetrics() {
  return {
    totalMessagesBroadcast,
    totalDroppedFrames
  };
}

export function getConnectedClientCount(): number {
  return wssInstance ? wssInstance.clients.size : 0;
}

export function setupWebSocketServer(httpServer: Server): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  wssInstance = wss;

  console.log('[WebSocket] High-Performance Gateway running on /ws');

  const defaultTokens = ['NSE_NIFTY50', 'NSE_BANKNIFTY', 'NSE_RELIANCE', 'NSE_TCS', 'NSE_INFY', 'NSE_HDFCBANK'];

  wss.on('connection', (ws: ExtendedWebSocket, req) => {
    ws.isAlive = true;
    ws.subscriptions = new Set();
    ws.adminWatchedUsers = new Set();

    // Register default subscriptions in index
    defaultTokens.forEach(t => {
      ws.subscriptions!.add(t);
      subscriptionIndex.add(t, ws);
      const aliases = SymbologyNormalizer.normalizeToken(t);
      aliases.forEach(a => {
        ws.subscriptions!.add(a);
        subscriptionIndex.add(a, ws);
      });
    });

    // Authenticate token via query string (?token=xyz)
    const urlParams = new URLSearchParams(req.url?.split('?')[1] || '');
    const token = urlParams.get('token');
    if (token) {
      try {
        const decoded = jwt.verify(token, getJwtSecret()) as any;
        ws.userId = decoded.userId;
        ws.userRole = decoded.role || 'USER';
      } catch (err) {
        // Continue unauthenticated for public market tick subscriptions
      }
    }

    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());

        if (data.action === 'SUBSCRIBE' && Array.isArray(data.tokens)) {
          const MAX_SUBS = 1000;
          const currentSize = ws.subscriptions?.size ?? 0;
          const allowedAdds = Math.max(0, MAX_SUBS - currentSize);
          const tokensToAdd = data.tokens.slice(0, allowedAdds);

          tokensToAdd.forEach((t: string) => {
            if (!t) return;
            const clean = t.trim();
            ws.subscriptions?.add(clean);
            subscriptionIndex.add(clean, ws);
            const aliases = SymbologyNormalizer.normalizeToken(clean);
            aliases.forEach(alias => {
              ws.subscriptions?.add(alias);
              subscriptionIndex.add(alias, ws);
            });
          });

          // Forward token subscriptions to MarketDataEngine so market provider emits live ticks
          if (tokensToAdd.length > 0) {
            MarketDataEngine.getInstance().subscribe(tokensToAdd);
          }
        } else if (data.action === 'UNSUBSCRIBE' && Array.isArray(data.tokens)) {
          data.tokens.forEach((t: string) => {
            if (!t) return;
            const clean = t.trim();
            ws.subscriptions?.delete(clean);
            subscriptionIndex.remove(clean, ws);
            const aliases = SymbologyNormalizer.normalizeToken(clean);
            aliases.forEach(alias => {
              ws.subscriptions?.delete(alias);
              subscriptionIndex.remove(alias, ws);
            });
          });

        // ── ADMIN-ONLY: Subscribe to a customer's real-time events ──────────
        } else if (data.action === 'ADMIN_SUBSCRIBE' && data.userId) {
          if (!ws.userRole || !ADMIN_ROLES.includes(ws.userRole)) {
            ws.send(JSON.stringify({ type: 'ERROR', code: 'FORBIDDEN', message: 'Admin role required to subscribe to user events' }));
          } else {
            ws.adminWatchedUsers?.add(data.userId);
            ws.send(JSON.stringify({ type: 'ADMIN_SUBSCRIBED', userId: data.userId }));
          }

        // ── ADMIN-ONLY: Unsubscribe from a customer's real-time events ──────
        } else if (data.action === 'ADMIN_UNSUBSCRIBE' && data.userId) {
          ws.adminWatchedUsers?.delete(data.userId);
          ws.send(JSON.stringify({ type: 'ADMIN_UNSUBSCRIBED', userId: data.userId }));

        // ── ADMIN-ONLY: Subscribe to every customer's admin events (platform-
        // wide queue views — OrderMonitor, FundsDashboard — as opposed to
        // ADMIN_SUBSCRIBE's single-customer drill-down) ─────────────────────
        } else if (data.action === 'ADMIN_SUBSCRIBE_ALL') {
          if (!ws.userRole || !ADMIN_ROLES.includes(ws.userRole)) {
            ws.send(JSON.stringify({ type: 'ERROR', code: 'FORBIDDEN', message: 'Admin role required to subscribe to platform-wide events' }));
          } else {
            ws.adminWatchAll = true;
            ws.send(JSON.stringify({ type: 'ADMIN_SUBSCRIBED_ALL' }));
          }

        } else if (data.action === 'ADMIN_UNSUBSCRIBE_ALL') {
          ws.adminWatchAll = false;
          ws.send(JSON.stringify({ type: 'ADMIN_UNSUBSCRIBED_ALL' }));

        // ── LIVE CHAT: customer sends to support, or staff replies to one customer ──
        } else if (data.action === 'CHAT_SEND' && typeof data.text === 'string' && data.text.trim()) {
          const isStaff = !!ws.userRole && ADMIN_ROLES.includes(ws.userRole) && ws.userRole !== 'USER';
          const customerId = isStaff ? data.toUserId : ws.userId;
          if (!ws.userId || !customerId) {
            ws.send(JSON.stringify({ type: 'ERROR', code: 'INVALID_CHAT', message: isStaff ? 'toUserId is required when a staff member sends a chat message.' : 'Not authenticated.' }));
          } else {
            const text = data.text.trim().slice(0, 4000);
            recordChatMessage(customerId, ws.userId, ws.userRole || 'USER', text)
              .then((row) => {
                // Same type string as the adminEventBus fan-out below uses for this event,
                // so client code listens for one event name regardless of which delivery
                // path (direct-to-user vs admin-watch fan-out) actually carried it.
                const payload = { type: 'CHAT_MESSAGE_RECEIVED', userId: customerId, data: { message: row }, timestamp: Date.now() };
                deliverToUser(customerId, payload);
                if (isStaff) deliverToUser(ws.userId!, payload); // echo back to the sending staff member's own other tabs/sessions

                // AI auto-reply — customer-sent messages only, never in response to
                // a staff (or the bot's own) message. See supportBot.ts.
                if (!isStaff) {
                  maybeGenerateSupportBotReply(customerId)
                    .then((botRow) => {
                      if (botRow) deliverToUser(customerId, { type: 'CHAT_MESSAGE_RECEIVED', userId: customerId, data: { message: botRow }, timestamp: Date.now() });
                    })
                    .catch((err: any) => console.error('[WS CHAT_SEND] Support bot reply failed:', err.message));
                }
              })
              .catch((err: any) => console.error('[WS CHAT_SEND] Failed to record message:', err.message));
          }

        } else if (data.action === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
        } else if (data.action === 'PING' || data.type === 'PING') {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
          }
        }
      } catch (err) {
        // Invalid JSON message ignored
      }
    });

    ws.on('close', () => {
      // Clean up subscriptions from inverted index to prevent memory leak
      subscriptionIndex.removeAll(ws);
      ws.subscriptions?.clear();
      ws.adminWatchedUsers?.clear();
    });

    // Send initial snapshot of all cached ticks
    const cachedTicks = MarketDataEngine.getInstance().getAllCachedTicks();
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'TICK_SNAPSHOT', data: cachedTicks }));
    }
  });

  // High-Speed O(1) Fan-Out: Broadcast market ticks to matching subscribers only
  MarketDataEngine.getInstance().onTick((tick) => {
    const payload = JSON.stringify({ type: 'MARKET_TICK', data: tick });
    const targetClients = new Set<ExtendedWebSocket>();

    // Collect subscribers for token and all aliases
    const directSubs = subscriptionIndex.getSubscribers(tick.instrumentToken);
    if (directSubs) directSubs.forEach(c => targetClients.add(c));

    const tickAliases = SymbologyNormalizer.normalizeToken(tick.instrumentToken);
    if (tick.symbol) {
      const symAliases = SymbologyNormalizer.normalizeToken(tick.symbol);
      symAliases.forEach(a => tickAliases.push(a));
    }

    for (const alias of tickAliases) {
      const aliasSubs = subscriptionIndex.getSubscribers(alias);
      if (aliasSubs) aliasSubs.forEach(c => targetClients.add(c));
    }

    // Broadcast to targeted subscriber clients with backpressure guard
    targetClients.forEach((client: ExtendedWebSocket) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          // Backpressure check: Skip frame if client write buffer is backlogged (>512KB)
          if (client.bufferedAmount > 512 * 1024) {
            totalDroppedFrames++;
            return;
          }
          client.send(payload);
          totalMessagesBroadcast++;
        } catch (err: any) {
          // Suppress send errors for dead connections
        }
      }
    });
  });

  // ── Admin Event Bus → WebSocket Fan-Out ─────────────────────────────────
  adminEventBus.onAllEvents((event: AdminEvent) => {
    const payload = JSON.stringify({
      type: event.type,
      userId: event.userId,
      data: event.payload,
      timestamp: event.timestamp
    });

    wss.clients.forEach((client: ExtendedWebSocket) => {
      if (
        client.readyState === WebSocket.OPEN &&
        (client.adminWatchedUsers?.has(event.userId) || client.adminWatchAll)
      ) {
        try {
          if (client.bufferedAmount <= 512 * 1024) {
            client.send(payload);
          }
        } catch (err: any) {
          // Suppress send errors for dead connections
        }
      }
    });
  });

  // Heartbeat ping interval (30 sec) — detect and terminate zombie connections
  const pingInterval = setInterval(() => {
    wss.clients.forEach((ws: ExtendedWebSocket) => {
      if (ws.isAlive === false) {
        ws.terminate();
        return;
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(pingInterval));

  return wss;
}

/**
 * Gracefully close all open WebSocket sessions and terminate the server.
 * Sends close frame 1001 ("Going Away") to every connected client.
 */
export async function shutdownWebSocketServer(): Promise<void> {
  if (!wssInstance) return;
  console.log(`[WebSocket] Gracefully disconnecting ${wssInstance.clients.size} active clients...`);

  wssInstance.clients.forEach((client: ExtendedWebSocket) => {
    try {
      client.close(1001, 'Server shutting down');
    } catch (_) {}
  });

  return new Promise((resolve) => {
    wssInstance!.close(() => {
      console.log('[WebSocket] Gateway server closed.');
      resolve();
    });
  });
}

