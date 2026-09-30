import { useState, useEffect, useRef } from 'react';
import { useMarketSocket, SocketStatus } from './useMarketSocket';
import { MarketTick, TickSource } from '../types';
import { logMarketTelemetry } from './useMarketTelemetry';

export type PriceState = 'LIVE' | 'STALE' | 'DISCONNECTED' | 'MARKET_CLOSED' | 'SYNTHETIC';

export interface TickFreshnessData {
  state: PriceState;
  tick: MarketTick | undefined;
  lastTickAt: number | undefined;
  timeSinceLastTick: number | undefined;
  isSynthetic: boolean;
  hasReceivedTick: boolean;
  socketStatus: SocketStatus;
  source?: TickSource;
}

export const DEFAULT_STALE_THRESHOLD_MS = 30000; // 30 seconds
export const INITIAL_TICK_TIMEOUT_MS = 15000;  // 15 seconds

/**
 * Checks if current time is within Indian Stock Market (NSE) trading hours:
 * Monday - Friday, 09:15 AM - 03:30 PM IST (UTC+5:30)
 */
export function isNSEMarketOpen(now: Date = new Date()): boolean {
  const istOffset = 5.5 * 60 * 60 * 1000;
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const istDate = new Date(utc + istOffset);

  const day = istDate.getDay();
  if (day === 0 || day === 6) return false;

  const hours = istDate.getHours();
  const minutes = istDate.getMinutes();
  const timeInMinutes = hours * 60 + minutes;

  const marketOpenMinutes = 9 * 60 + 15;  // 09:15 AM IST
  const marketCloseMinutes = 15 * 60 + 30; // 03:30 PM IST

  return timeInMinutes >= marketOpenMinutes && timeInMinutes <= marketCloseMinutes;
}

export function evaluateTickState(
  socketStatus: SocketStatus,
  lastTickAt: number | undefined,
  tick: MarketTick | undefined,
  staleThresholdMs: number = DEFAULT_STALE_THRESHOLD_MS,
  now: number = Date.now()
): { state: PriceState; timeSinceLastTick: number | undefined; isSynthetic: boolean; source?: TickSource } {
  const tickSource = tick?.source;
  const tickSourceStr = (tickSource as string) || '';
  const isSynthetic = Boolean(
    tick && (tick.isSynthetic || (tick as any).synthetic || tickSourceStr === 'synthetic_skew' || tickSourceStr === 'mock')
  );

  // Explicit backend source tags take precedence
  if (tickSourceStr === 'market_closed') {
    return { state: 'MARKET_CLOSED', timeSinceLastTick: lastTickAt ? now - lastTickAt : undefined, isSynthetic: false, source: tickSource };
  }

  if (tickSourceStr === 'synthetic_skew' || tickSourceStr === 'mock' || (isSynthetic && tickSourceStr !== 'dhan' && tickSourceStr !== 'fyers' && tickSourceStr !== 'angelone' && tickSourceStr !== 'guard_feed' && tickSourceStr !== 'live')) {
    return { state: 'SYNTHETIC', timeSinceLastTick: lastTickAt ? now - lastTickAt : undefined, isSynthetic: true, source: tickSource };
  }

  if (tickSource === 'cached_stale') {
    return { state: 'STALE', timeSinceLastTick: lastTickAt ? now - lastTickAt : undefined, isSynthetic: false, source: tickSource };
  }

  // Socket offline / reconnecting state
  if (socketStatus === 'DISCONNECTED' || socketStatus === 'RECONNECTING' || socketStatus === 'UNAVAILABLE') {
    return { state: 'DISCONNECTED', timeSinceLastTick: lastTickAt ? now - lastTickAt : undefined, isSynthetic: false, source: tickSource };
  }

  // If a tick was received recently within stale threshold, mark as LIVE
  if (lastTickAt && (now - lastTickAt) <= staleThresholdMs) {
    return { state: 'LIVE', timeSinceLastTick: now - lastTickAt, isSynthetic: false, source: tickSource || 'live' };
  }

  // Outside market hours check if no recent tick
  const marketOpen = isNSEMarketOpen(new Date(now));
  if (!marketOpen) {
    return { state: 'MARKET_CLOSED', timeSinceLastTick: lastTickAt ? now - lastTickAt : undefined, isSynthetic: false, source: tickSource };
  }

  // No tick received yet
  if (!lastTickAt) {
    return { state: 'STALE', timeSinceLastTick: undefined, isSynthetic: false, source: tickSource };
  }

  const timeSinceLastTick = now - lastTickAt;
  if (timeSinceLastTick > staleThresholdMs) {
    return { state: 'STALE', timeSinceLastTick, isSynthetic: false, source: tickSource };
  }

  return { state: 'LIVE', timeSinceLastTick, isSynthetic: false, source: tickSource || 'live' };
}

/**
 * Hook to evaluate tick freshness state for a single instrument token.
 */
export function useTickFreshness(
  token: string,
  staleThresholdMs: number = DEFAULT_STALE_THRESHOLD_MS
): TickFreshnessData {
  const { status, ticks, lastTickTimestamps, firstSubscribedAt } = useMarketSocket();
  const [now, setNow] = useState<number>(Date.now());
  const timeoutLoggedRef = useRef<boolean>(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const tick = ticks.get(token);
  const lastTickAt = lastTickTimestamps.get(token);
  const subscribedAt = firstSubscribedAt.get(token);
  const hasReceivedTick = Boolean(lastTickAt || tick);

  // Check 10s initial tick timeout for telemetry logging
  useEffect(() => {
    if (!token || hasReceivedTick || !subscribedAt || timeoutLoggedRef.current) return;

    if (now - subscribedAt > INITIAL_TICK_TIMEOUT_MS) {
      logMarketTelemetry('TOKEN_NO_TICKS_TIMEOUT', { elapsedMs: now - subscribedAt }, token);
      timeoutLoggedRef.current = true;
    }
  }, [token, hasReceivedTick, subscribedAt, now]);

  useEffect(() => {
    timeoutLoggedRef.current = false;
  }, [token]);

  const { state, timeSinceLastTick, isSynthetic, source } = evaluateTickState(
    status,
    lastTickAt,
    tick,
    staleThresholdMs,
    now
  );

  return {
    state,
    tick,
    lastTickAt,
    timeSinceLastTick,
    isSynthetic,
    hasReceivedTick,
    socketStatus: status,
    source,
  };
}

/**
 * Hook to evaluate tick freshness state for multiple instrument tokens.
 */
export function useMultiTickFreshness(
  tokens: string[],
  staleThresholdMs: number = DEFAULT_STALE_THRESHOLD_MS
): Map<string, TickFreshnessData> {
  const { status, ticks, lastTickTimestamps } = useMarketSocket();
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const resultMap = new Map<string, TickFreshnessData>();

  tokens.forEach(token => {
    if (!token) return;
    const tick = ticks.get(token);
    const lastTickAt = lastTickTimestamps.get(token);
    const hasReceivedTick = Boolean(lastTickAt || tick);

    const { state, timeSinceLastTick, isSynthetic, source } = evaluateTickState(
      status,
      lastTickAt,
      tick,
      staleThresholdMs,
      now
    );

    resultMap.set(token, {
      state,
      tick,
      lastTickAt,
      timeSinceLastTick,
      isSynthetic,
      hasReceivedTick,
      socketStatus: status,
      source,
    });
  });

  return resultMap;
}
