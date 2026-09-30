/**
 * tests/load/market_data_load.test.ts
 *
 * Phase 19-20 Load & Stress Testing Jest Suite.
 * Executes Scenarios A (10 clients), B (50 clients), C (100 clients with churn),
 * and validates the 9 core architectural invariants under real WebSocket load.
 */

import { MarketDataLoadHarness } from './run_load_suite';

describe('Market Data Pipeline Load & Stress Suite (Phases 19-20)', () => {
  let harness: MarketDataLoadHarness;

  beforeAll(async () => {
    harness = new MarketDataLoadHarness();
    await harness.startServer();
  }, 15000);

  afterAll(async () => {
    await harness.stopServer();
  }, 10000);

  test('Scenario A: 10 Clients, 100 ticks/sec (5 index tokens + 1 chain view)', async () => {
    const result = await harness.runScenario({
      name: 'Scenario A (10 Clients)',
      clientCount: 10,
      durationMs: 3000,
      tickRatePerSec: 100,
      distinctInstruments: 30,
      chainViewsPerClient: 1,
      distinctChainViews: ['NIFTY|2026-08-27|10']
    });

    expect(result.providerConnections).toBe(1);
    expect(result.activeViewsUnderLoad).toBe(1); // 10 clients share 1 view
    expect(result.cleanTeardown).toBe(true);
    expect(result.totalTicksReceived).toBeGreaterThan(0);
    expect(result.deliveryLatencyMs.p95).toBeLessThan(100); // Sub-100ms delivery
  }, 20000);

  test('Scenario B: 50 Clients, 300 ticks/sec (3 distinct chain views shared)', async () => {
    const result = await harness.runScenario({
      name: 'Scenario B (50 Clients)',
      clientCount: 50,
      durationMs: 4000,
      tickRatePerSec: 300,
      distinctInstruments: 100,
      chainViewsPerClient: 1,
      distinctChainViews: [
        'NIFTY|2026-08-27|10',
        'BANKNIFTY|2026-08-27|10',
        'SENSEX|2026-08-27|10'
      ]
    });

    expect(result.providerConnections).toBe(1);
    expect(result.activeViewsUnderLoad).toBeLessThanOrEqual(3);
    expect(result.cleanTeardown).toBe(true);
    expect(result.deliveryLatencyMs.p99).toBeLessThan(200);
  }, 25000);

  test('Scenario C: 100 Clients, 1,000 ticks/sec, sustained load with 10% churn', async () => {
    const result = await harness.runScenario({
      name: 'Scenario C (100 Clients + Churn)',
      clientCount: 100,
      durationMs: 5000,
      tickRatePerSec: 1000,
      distinctInstruments: 200,
      chainViewsPerClient: 1,
      distinctChainViews: [
        'NIFTY|2026-08-27|10',
        'BANKNIFTY|2026-08-27|10',
        'FINNIFTY|2026-08-27|10'
      ],
      enable10PercentChurn: true
    });

    expect(result.providerConnections).toBe(1);
    expect(result.cleanTeardown).toBe(true);
    expect(result.rssGrowthPercent).toBeLessThan(25); // Bounded memory growth
  }, 30000);
});
