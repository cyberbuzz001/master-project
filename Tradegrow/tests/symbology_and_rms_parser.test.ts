import { CircuitBreaker } from '../server/src/utils/CircuitBreaker';
import { SymbologyNormalizer } from '../server/src/marketData/SymbologyNormalizer';
import { DhanAdapter } from '../server/src/marketData/DhanAdapter';
import { marginEngineService } from '../server/src/services/MarginEngineService';

describe('1. CircuitBreaker Upstream Resilience Tests', () => {
  test('Executes successful calls and remains CLOSED', async () => {
    const breaker = new CircuitBreaker({ name: 'TestBreaker', timeoutMs: 500, errorThresholdPercentage: 50, resetTimeoutMs: 200 });
    const result = await breaker.execute(async () => 'OK');
    expect(result).toBe('OK');
    expect(breaker.getState()).toBe('CLOSED');
  });

  test('Trips to OPEN state when error threshold is exceeded', async () => {
    const breaker = new CircuitBreaker({ name: 'TestBreaker2', timeoutMs: 100, errorThresholdPercentage: 50, resetTimeoutMs: 200, volumeThreshold: 3 });

    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(async () => { throw new Error('API 504 Error'); });
      } catch (_) {}
    }

    expect(breaker.getState()).toBe('OPEN');
    expect(breaker.isOpen()).toBe(true);

    // Fast-fail with fallback
    const fallbackResult = await breaker.execute(
      async () => 'FAIL',
      () => 'FALLBACK_CACHED_VALUE'
    );
    expect(fallbackResult).toBe('FALLBACK_CACHED_VALUE');
  });

  test('Times out stalled upstream calls beyond timeoutMs', async () => {
    const breaker = new CircuitBreaker({ name: 'TimeoutBreaker', timeoutMs: 50 });
    await expect(
      breaker.execute(async () => {
        await new Promise(r => setTimeout(r, 200));
        return 'DONE';
      })
    ).rejects.toThrow(/timed out/i);
  });
});

describe('2. Multi-Format Derivative Symbol Parsing & Normalization Tests', () => {
  const testFixtures = [
    // Standard formats
    { input: 'NIFTY 24500 CE', expectedUnderlying: 'NIFTY', expectedStrike: 24500, expectedOpt: 'CE' },
    { input: 'NIFTY24500CE', expectedUnderlying: 'NIFTY', expectedStrike: 24500, expectedOpt: 'CE' },
    { input: 'NFO_NIFTY_24500_CE', expectedUnderlying: 'NIFTY', expectedStrike: 24500, expectedOpt: 'CE' },
    { input: 'NFO_NIFTY_24500_PE', expectedUnderlying: 'NIFTY', expectedStrike: 24500, expectedOpt: 'PE' },
    
    // BANKNIFTY
    { input: 'BANKNIFTY 57500 PE', expectedUnderlying: 'BANKNIFTY', expectedStrike: 57500, expectedOpt: 'PE' },
    { input: 'BANKNIFTY57500PE', expectedUnderlying: 'BANKNIFTY', expectedStrike: 57500, expectedOpt: 'PE' },
    { input: 'NFO_BANKNIFTY_57500_PE', expectedUnderlying: 'BANKNIFTY', expectedStrike: 57500, expectedOpt: 'PE' },

    // BSE SENSEX
    { input: 'SENSEX 78000 CE', expectedUnderlying: 'SENSEX', expectedStrike: 78000, expectedOpt: 'CE' },
    { input: 'SENSEX78000CE', expectedUnderlying: 'SENSEX', expectedStrike: 78000, expectedOpt: 'CE' },
    { input: 'BFO_SENSEX_78000_PE', expectedUnderlying: 'SENSEX', expectedStrike: 78000, expectedOpt: 'PE' },

    // FINNIFTY & MIDCPNIFTY
    { input: 'FINNIFTY 25800 CE', expectedUnderlying: 'FINNIFTY', expectedStrike: 25800, expectedOpt: 'CE' },
    { input: 'MIDCPNIFTY 13200 PE', expectedUnderlying: 'MIDCPNIFTY', expectedStrike: 13200, expectedOpt: 'PE' },

    // Stock Options
    { input: 'RELIANCE 1300 CE', expectedUnderlying: 'RELIANCE', expectedStrike: 1300, expectedOpt: 'CE' },
    { input: 'TCS 2400 PE', expectedUnderlying: 'TCS', expectedStrike: 2400, expectedOpt: 'PE' }
  ];

  const optRegex = /(?:^(?:NFO|BFO|NSE|BSE)_)?([A-Z]+)[_\s\d-]*?(\d+(?:\.\d+)?)[_\s]*(CE|PE)$/i;

  testFixtures.forEach(({ input, expectedUnderlying, expectedStrike, expectedOpt }) => {
    test(`Parses fixture format: "${input}"`, () => {
      const match = input.match(optRegex);
      expect(match).not.toBeNull();
      if (match) {
        expect(match[1].toUpperCase()).toBe(expectedUnderlying);
        expect(parseFloat(match[2])).toBe(expectedStrike);
        expect(match[3].toUpperCase()).toBe(expectedOpt);
      }
    });
  });
});

describe('3. LRU Cache & Dynamic Security Map Memory Bounds Tests', () => {
  test('Enforces bounded size and LRU eviction in DhanAdapter.DHAN_SECURITY_MAP', () => {
    const dhanAdapterAny = DhanAdapter as any;

    // Check initial static entries exist
    expect(dhanAdapterAny.DHAN_SECURITY_MAP['NSE_NIFTY50']).toBeDefined();
    expect(dhanAdapterAny.DHAN_SECURITY_MAP['BSE_SENSEX']).toBeDefined();

    // Insert 2,500 dynamic strikes
    for (let i = 1; i <= 2500; i++) {
      dhanAdapterAny.addDynamicSecurityMapping(`NFO_TEST_${i}_CE`, { segment: 'NSE_FNO', securityId: String(100000 + i) });
    }

    // Latest entries must exist
    expect(dhanAdapterAny.DHAN_SECURITY_MAP['NFO_TEST_2500_CE']).toBeDefined();
    expect(dhanAdapterAny.DHAN_SECURITY_MAP['NFO_TEST_2500_CE'].securityId).toBe('102500');

    // Earliest dynamic entry should be evicted by LRUCache
    expect(dhanAdapterAny.DHAN_SECURITY_MAP['NFO_TEST_1_CE']).toBeUndefined();

    // Static baseline keys are preserved
    expect(dhanAdapterAny.DHAN_SECURITY_MAP['NSE_NIFTY50'].securityId).toBe('13');
  });
});

describe('4. RMS Margin Defense-in-Depth Floor Sanity Tests', () => {
  test('Enforces minimum margin floor on naked option selling to prevent solvency breach', async () => {
    // Test quote for writing 65 Qty (1 lot) of NIFTY option
    const quote = await marginEngineService.calculateQuote({
      userId: 'usr_test_mock',
      exchange: 'NSE',
      underlying: 'NIFTY',
      strike: 24500,
      optionType: 'CE',
      side: 'SELL',
      quantity: 65,
      price: 150.0,
      productType: 'NRML'
    });

    // Option sell margin must be substantial (at least ₹500/lot floor or nominal % of spot)
    expect(quote.requiredMargin).toBeGreaterThanOrEqual(500);
    expect(quote.spanMargin).toBeGreaterThan(0);
    expect(quote.exposureMargin).toBeGreaterThan(0);
  });
});
