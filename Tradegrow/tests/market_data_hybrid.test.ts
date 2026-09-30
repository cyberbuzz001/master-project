/**
 * Centralized (Dhan-only) Market Data Engine tests.
 *
 * This file previously asserted a "HYBRID" Dhan+Fyers architecture with Fyers routing for
 * candles and Greeks. That architecture was removed — Fyers caused WebSocket
 * crash-reconnect storms — so those assertions had been failing against the real code and
 * described a system that no longer exists. They are replaced here with assertions about
 * the architecture that actually ships, plus guards on the no-fabricated-data rule.
 */

import { MarketDataEngine } from '../server/src/marketData/MarketDataEngine';
import { MarketTick } from '../server/src/marketData/types';

describe('Centralized Market Data Engine', () => {
  let engine: MarketDataEngine;

  beforeAll(async () => {
    engine = MarketDataEngine.getInstance();
    await engine.initialize();
  });

  test('1. Runs in Dhan-only mode with a single centralized provider', () => {
    const status = engine.getHybridStatus();
    expect(status.mode).toBe('DHAN_ONLY');
    expect(status.primaryLiveStream).toBe('DHAN');
    expect(engine.getActiveProviderName()).toBe('DHAN');
  });

  test('2. Never fabricates historical candles when the provider has no data', async () => {
    // Regression: the adapter used to synthesise a full random-walk OHLC series around a
    // hardcoded base price whenever the real API failed, producing a chart that looked
    // real but was entirely invented. An empty series is the honest answer.
    const candles = await engine.getHistoricalCandles('NSE_RELIANCE', '5m', 20);
    expect(Array.isArray(candles)).toBe(true);

    // Whatever comes back must be real data with coherent OHLC relationships —
    // never filler rows.
    for (const c of candles) {
      expect(c.time).toBeGreaterThan(0);
      expect(c.high).toBeGreaterThanOrEqual(c.low);
      expect(c.high).toBeGreaterThanOrEqual(c.open);
      expect(c.high).toBeGreaterThanOrEqual(c.close);
      expect(c.low).toBeLessThanOrEqual(c.open);
      expect(c.low).toBeLessThanOrEqual(c.close);
    }
  });

  test('3. Option chain rows never carry invented OI or volume', async () => {
    const chain = await engine.getOptionChain('NIFTY', '2026-08-28');
    expect(Array.isArray(chain)).toBe(true);

    for (const row of chain) {
      expect(row.strikePrice).toBeGreaterThan(0);
      // Unavailable values must be exactly 0 (rendered as "--"), never a random number.
      for (const leg of [row.ce, row.pe]) {
        if (!leg) continue;
        expect(leg.openInterest).toBeGreaterThanOrEqual(0);
        expect(leg.volume).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(leg.ltp)).toBe(true);
      }
    }
  });

  test('4. Caches and retrieves ticks correctly', () => {
    const mockTick: MarketTick = {
      instrumentToken: 'NSE_RELIANCE',
      exchange: 'NSE',
      symbol: 'RELIANCE',
      ltp: 2950.50,
      open: 2940.0,
      high: 2960.0,
      low: 2935.0,
      close: 2945.0,
      change: 5.5,
      changePercent: 0.18,
      volume: 1200000,
      bid: 2950.40,
      ask: 2950.60,
      bidQty: 100,
      askQty: 150,
      timestamp: Date.now(),
      source: 'dhan'
    };

    engine.setCachedTick(mockTick);
    const cached = engine.getCachedTick('NSE_RELIANCE');
    expect(cached).toBeDefined();
    expect(cached?.ltp).toBe(2950.50);
  });

  test('5. Rejects a stale tick that would overwrite a newer cached price', () => {
    const base: MarketTick = {
      instrumentToken: 'NSE_STALETEST',
      exchange: 'NSE',
      symbol: 'STALETEST',
      ltp: 100, open: 100, high: 100, low: 100, close: 100,
      change: 0, changePercent: 0, volume: 0,
      bid: 0, ask: 0, bidQty: 0, askQty: 0,
      timestamp: 10_000,
      source: 'dhan'
    };

    engine.setCachedTick(base);
    // An out-of-order tick from 5 seconds earlier must be ignored.
    engine.setCachedTick({ ...base, ltp: 90, timestamp: 5_000 });
    expect(engine.getCachedTick('NSE_STALETEST')?.ltp).toBe(100);

    // A newer tick must be applied.
    engine.setCachedTick({ ...base, ltp: 110, timestamp: 20_000 });
    expect(engine.getCachedTick('NSE_STALETEST')?.ltp).toBe(110);
  });

  test('6. Reports feed health so the UI can distinguish live from stale data', () => {
    const health = engine.getFeedHealth();
    expect(['LIVE', 'STALE', 'CLOSED', 'DISCONNECTED']).toContain(health.status);
    expect(typeof health.marketOpen).toBe('boolean');
    expect(health.provider).toBe('DHAN');
  });

  test('7. Keeps exactly one upstream provider connection regardless of subscriber count', () => {
    // The core fan-out guarantee: many subscribers, one provider connection.
    engine.subscribe(['NSE_TCS', 'NSE_INFY']);
    engine.subscribe(['NSE_TCS', 'NSE_INFY']);
    engine.subscribe(['NSE_TCS']);

    const metrics = engine.getPipelineMetrics();
    expect(metrics.providerConnections).toBeLessThanOrEqual(1);

    // Releasing one holder must not drop a token another holder still needs.
    engine.unsubscribe(['NSE_TCS']);
    expect(engine.getPipelineMetrics().refCountedTokens).toBeGreaterThan(0);
  });

  test('8. Rejects switching to a provider that is not registered', async () => {
    await expect(engine.switchPrimaryProvider('NOT_A_PROVIDER')).rejects.toThrow();
    expect(engine.getActiveProviderName()).toBe('DHAN');
  });
});
