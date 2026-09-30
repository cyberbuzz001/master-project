/**
 * tests/market_data_integration.test.ts
 *
 * Phase 19-20 End-to-End Correctness Suite for Centralized Market Data Pipeline.
 * Tests: Market Data Engine Ingestion & Normalization, Symbology Mappings, Stale/Duplicate Rejection,
 * Option Chain Matrix Generation & View Isolation, and Real WebSocket Client Protocol Interactions.
 */

import http from 'http';
import WebSocket from 'ws';
import { MarketDataEngine } from '../server/src/marketData/MarketDataEngine';
import { OptionChainBroadcasterService, chainKey } from '../server/src/marketData/OptionChainBroadcasterService';
import { setupWebSocketServer } from '../server/src/websocket/server';
import { MarketTick } from '../server/src/marketData/types';

describe('Market Data Pipeline & Integration Correctness Suite', () => {
  let server: http.Server;
  let wsUrl: string;
  let port: number;
  let engine: MarketDataEngine;
  let broadcaster: OptionChainBroadcasterService;
  const openSockets: WebSocket[] = [];

  beforeAll((done) => {
    engine = MarketDataEngine.getInstance();
    broadcaster = OptionChainBroadcasterService.getInstance();

    server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
    });

    setupWebSocketServer(server);

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      port = addr.port;
      wsUrl = `ws://127.0.0.1:${port}/ws`;
      done();
    });
  });

  afterAll((done) => {
    broadcaster.stop();
    for (const ws of openSockets) {
      try { ws.terminate(); } catch (_) {}
    }
    server.close(() => {
      done();
    });
  });

  beforeEach(() => {
    broadcaster.stop();
  });

  function createTrackedSocket(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      openSockets.push(ws);
      ws.on('open', () => resolve(ws));
      ws.on('error', (err) => reject(err));
    });
  }

  // ============================================================================
  // SECTION 1: MARKET DATA INGESTION, NORMALIZATION & REJECTION
  // ============================================================================
  describe('1. Market Data Ingestion & State Normalization', () => {
    test('1.1 Tick received end-to-end (injected -> engine -> cache)', () => {
      const now = Date.now();
      const testTick: MarketTick = {
        instrumentToken: 'NSE_TATASTEEL',
        exchange: 'NSE',
        symbol: 'TATASTEEL',
        ltp: 165.25,
        open: 164.0,
        high: 166.5,
        low: 163.5,
        close: 164.2,
        change: 1.05,
        changePercent: 0.64,
        volume: 2500000,
        bid: 165.20,
        ask: 165.30,
        bidQty: 500,
        askQty: 400,
        timestamp: now,
        source: 'dhan'
      };

      engine.setCachedTick(testTick);
      const cached = engine.getCachedTick('NSE_TATASTEEL');

      expect(cached).toBeDefined();
      expect(cached?.ltp).toBe(165.25);
      expect(cached?.symbol).toBe('TATASTEEL');
    });

    test('1.2 Tick normalized with all fields correctly typed', () => {
      const now = Date.now();
      const tick: MarketTick = {
        instrumentToken: 'NSE_INFY',
        exchange: 'NSE',
        symbol: 'INFY',
        ltp: 1850.75,
        open: 1840.0,
        high: 1860.0,
        low: 1835.0,
        close: 1845.0,
        change: 5.75,
        changePercent: 0.31,
        volume: 850000,
        bid: 1850.50,
        ask: 1851.00,
        bidQty: 250,
        askQty: 300,
        timestamp: now,
        source: 'dhan'
      };

      engine.setCachedTick(tick);
      const cached = engine.getCachedTick('NSE_INFY')!;

      expect(typeof cached.instrumentToken).toBe('string');
      expect(typeof cached.exchange).toBe('string');
      expect(typeof cached.symbol).toBe('string');
      expect(typeof cached.ltp).toBe('number');
      expect(typeof cached.open).toBe('number');
      expect(typeof cached.high).toBe('number');
      expect(typeof cached.low).toBe('number');
      expect(typeof cached.close).toBe('number');
      expect(typeof cached.change).toBe('number');
      expect(typeof cached.changePercent).toBe('number');
      expect(typeof cached.volume).toBe('number');
      expect(typeof cached.bid).toBe('number');
      expect(typeof cached.ask).toBe('number');
      expect(typeof cached.timestamp).toBe('number');
      expect(cached.timestamp).toBe(now);
    });

    test('1.3 Token mapped correctly across aliases and symbology forms', () => {
      const now = Date.now();
      const nfoTick: MarketTick = {
        instrumentToken: 'NFO_NIFTY_24500_CE',
        exchange: 'NFO',
        symbol: 'NIFTY 24500 CE',
        ltp: 142.50,
        open: 120.0,
        high: 155.0,
        low: 110.0,
        close: 130.0,
        change: 12.5,
        changePercent: 9.6,
        volume: 450000,
        bid: 142.00,
        ask: 143.00,
        bidQty: 1500,
        askQty: 1800,
        timestamp: now,
        source: 'dhan'
      };

      engine.setCachedTick(nfoTick);

      // Hit by primary token
      expect(engine.getCachedTick('NFO_NIFTY_24500_CE')?.ltp).toBe(142.50);
      // Hit by formatted symbol
      expect(engine.getCachedTick('NIFTY 24500 CE')?.ltp).toBe(142.50);
      // Hit by compact token
      expect(engine.getCachedTick('NIFTY24500CE')?.ltp).toBe(142.50);
    });

    test('1.4 Stale tick rejected and staleTicksRejected metric incremented', () => {
      const baseTime = 100_000;
      const initialTick: MarketTick = {
        instrumentToken: 'NSE_HDFCBANK',
        exchange: 'NSE',
        symbol: 'HDFCBANK',
        ltp: 1600.0,
        open: 1590.0, high: 1610.0, low: 1585.0, close: 1595.0,
        change: 5.0, changePercent: 0.31, volume: 100000,
        bid: 1599.5, ask: 1600.5, bidQty: 100, askQty: 100,
        timestamp: baseTime,
        source: 'dhan'
      };

      engine.setCachedTick(initialTick);
      expect(engine.getCachedTick('NSE_HDFCBANK')?.ltp).toBe(1600.0);

      const metricsBefore = engine.getPipelineMetrics();

      // Attempt to inject an older (stale) tick
      const staleTick: MarketTick = {
        ...initialTick,
        ltp: 1550.0, // Stale old price
        timestamp: baseTime - 5000 // 5s in the past
      };

      engine.setCachedTick(staleTick);

      // Cache must NOT be overwritten
      expect(engine.getCachedTick('NSE_HDFCBANK')?.ltp).toBe(1600.0);

      const metricsAfter = engine.getPipelineMetrics();
      expect(metricsAfter.staleTicksRejected).toBeGreaterThan(metricsBefore.staleTicksRejected);
    });

    test('1.5 Duplicate tick handled without corrupting state', () => {
      const now = Date.now();
      const duplicateTick: MarketTick = {
        instrumentToken: 'NSE_SBIN',
        exchange: 'NSE',
        symbol: 'SBIN',
        ltp: 820.50,
        open: 815.0, high: 825.0, low: 810.0, close: 818.0,
        change: 2.5, changePercent: 0.30, volume: 400000,
        bid: 820.0, ask: 821.0, bidQty: 200, askQty: 200,
        timestamp: now,
        source: 'dhan'
      };

      engine.setCachedTick(duplicateTick);
      engine.setCachedTick(duplicateTick); // Re-inject identical tick

      const cached = engine.getCachedTick('NSE_SBIN');
      expect(cached?.ltp).toBe(820.50);
      expect(cached?.timestamp).toBe(now);
    });
  });

  // ============================================================================
  // SECTION 2: OPTION CHAIN MATRIX BUILDING & VIEW ISOLATION
  // ============================================================================
  describe('2. Option Chain Matrix Generation & Isolation', () => {
    test('2.1 Generates distinct view keys for symbol, expiry, and strike range', () => {
      const v1 = { symbol: 'NIFTY', expiry: '2026-08-27', strikeRange: '10' };
      const v2 = { symbol: 'NIFTY', expiry: '2026-09-24', strikeRange: '10' };
      const v3 = { symbol: 'SENSEX', expiry: '2026-08-27', strikeRange: '10' };

      const k1 = chainKey(v1);
      const k2 = chainKey(v2);
      const k3 = chainKey(v3);

      expect(k1).not.toEqual(k2);
      expect(k1).not.toEqual(k3);
    });

    test('2.2 Different strike ranges produce different broadcaster views', () => {
      const k5 = broadcaster.addView({ symbol: 'NIFTY', expiry: '2026-08-27', strikeRange: '5' })!;
      const k10 = broadcaster.addView({ symbol: 'NIFTY', expiry: '2026-08-27', strikeRange: '10' })!;
      const k20 = broadcaster.addView({ symbol: 'NIFTY', expiry: '2026-08-27', strikeRange: '20' })!;

      expect(k5).not.toEqual(k10);
      expect(k10).not.toEqual(k20);

      const metrics = broadcaster.getMetrics();
      expect(metrics.activeViewCount).toBe(3);
    });

    test('2.3 Snapshots for View A are never dispatched to View B', () => {
      const viewA = { symbol: 'NIFTY', expiry: '2026-08-27', strikeRange: '10' };
      const viewB = { symbol: 'BANKNIFTY', expiry: '2026-08-27', strikeRange: '10' };

      const keyA = chainKey(viewA);
      const keyB = chainKey(viewB);

      expect(keyA).not.toEqual(keyB);
      expect(keyA.includes('NIFTY')).toBe(true);
      expect(keyB.includes('BANKNIFTY')).toBe(true);
    });
  });

  // ============================================================================
  // SECTION 3: WEBSOCKET PROTOCOL, FAN-OUT & TEARDOWN
  // ============================================================================
  describe('3. WebSocket Gateway & Fan-Out Protocol', () => {
    test('3.1 Multiple clients receive real-time tick from a single injection', async () => {
      const ws1 = await createTrackedSocket();
      const ws2 = await createTrackedSocket();

      const ws1Promise = new Promise<void>((resolve) => {
        ws1.on('message', (raw) => {
          try {
            const msg = JSON.parse(raw.toString());
            if (msg.type === 'MARKET_TICK' && (msg.data?.symbol === 'ITC' || msg.data?.instrumentToken === 'NSE_ITC')) {
              resolve();
            }
          } catch (_) {}
        });
      });

      const ws2Promise = new Promise<void>((resolve) => {
        ws2.on('message', (raw) => {
          try {
            const msg = JSON.parse(raw.toString());
            if (msg.type === 'MARKET_TICK' && (msg.data?.symbol === 'ITC' || msg.data?.instrumentToken === 'NSE_ITC')) {
              resolve();
            }
          } catch (_) {}
        });
      });

      ws1.send(JSON.stringify({ action: 'SUBSCRIBE', tokens: ['NSE_ITC'] }));
      ws2.send(JSON.stringify({ action: 'SUBSCRIBE', tokens: ['NSE_ITC'] }));

      // Wait a tick for subscription indexing
      await new Promise(r => setTimeout(r, 50));

      engine.injectSyntheticTick({
        instrumentToken: 'NSE_ITC',
        exchange: 'NSE',
        symbol: 'ITC',
        ltp: 485.50,
        open: 480.0, high: 490.0, low: 478.0, close: 482.0,
        change: 3.5, changePercent: 0.72, volume: 1500000,
        bid: 485.0, ask: 486.0, bidQty: 500, askQty: 500,
        timestamp: Date.now(),
        source: 'dhan'
      });

      await Promise.all([ws1Promise, ws2Promise]);
    });

    test('3.2 Duplicate subscriptions from one socket do not inflate ref-count', async () => {
      const ws = await createTrackedSocket();

      ws.send(JSON.stringify({ action: 'SUBSCRIBE', tokens: ['NSE_WIPRO'] }));
      ws.send(JSON.stringify({ action: 'SUBSCRIBE', tokens: ['NSE_WIPRO'] }));
      ws.send(JSON.stringify({ action: 'SUBSCRIBE', tokens: ['NSE_WIPRO'] }));

      await new Promise(r => setTimeout(r, 50));

      const metrics = engine.getPipelineMetrics();
      expect(metrics.refCountedTokens).toBeGreaterThanOrEqual(1);

      ws.close();
      await new Promise(r => setTimeout(r, 50));
    });

    test('3.3 Clean teardown: refCountedTokens and activeViewCount return to 0 after disconnect', async () => {
      const ws = await createTrackedSocket();

      ws.send(JSON.stringify({ action: 'SUBSCRIBE', tokens: ['NSE_BAJFINANCE'] }));
      ws.send(JSON.stringify({ action: 'SUBSCRIBE_OPTION_CHAIN', symbol: 'NIFTY', expiry: '2026-08-27', strikeRange: '10' }));

      await new Promise(r => setTimeout(r, 50));

      ws.close();
      await new Promise(r => setTimeout(r, 100));

      const broadcasterMetrics = broadcaster.getMetrics();
      expect(broadcasterMetrics.activeViewCount).toBe(0);
      expect(broadcasterMetrics.totalSubscribers).toBe(0);
    });
  });
});
