import { FyersAdapter } from '../server/src/marketData/FyersAdapter';

describe('Fyers API v3 Market Data Adapter Tests', () => {
  let adapter: FyersAdapter;

  beforeEach(() => {
    adapter = new FyersAdapter();
  });

  afterEach(() => {
    adapter.stop();
  });

  test('1. Reports itself unhealthy while the provider is disabled', async () => {
    // Fyers is intentionally disabled (it caused WebSocket crash-reconnect storms).
    // initialize() is a deliberate no-op, so the adapter must report NOT healthy —
    // this test previously asserted `true`, which only held while the adapter was
    // emitting fabricated ticks from hardcoded reference prices.
    await adapter.initialize();
    expect(adapter.name).toBe('FYERS');
    expect(adapter.isHealthy()).toBe(false);
  });

  test('2. Converts internal tokens to Fyers symbols correctly', () => {
    expect(adapter.tokenToFyersSymbol('NSE_NIFTY50')).toBe('NSE:NIFTY50-INDEX');
    expect(adapter.tokenToFyersSymbol('NSE_BANKNIFTY')).toBe('NSE:NIFTYBANK-INDEX');
    expect(adapter.tokenToFyersSymbol('BSE_SENSEX')).toBe('BSE:SENSEX-INDEX');
    expect(adapter.tokenToFyersSymbol('NSE_RELIANCE')).toBe('NSE:RELIANCE-EQ');
    expect(adapter.tokenToFyersSymbol('NSE_TCS')).toBe('NSE:TCS-EQ');
    expect(adapter.tokenToFyersSymbol('MCX_CRUDEOIL')).toBe('MCX:CRUDEOIL-COMM');
  });

  test('3. Converts Fyers symbols back to internal tokens correctly', () => {
    expect(adapter.fyersSymbolToToken('NSE:NIFTY50-INDEX')).toBe('NSE_NIFTY50');
    expect(adapter.fyersSymbolToToken('NSE:RELIANCE-EQ')).toBe('NSE_RELIANCE');
    expect(adapter.fyersSymbolToToken('BSE:SENSEX-INDEX')).toBe('BSE_SENSEX');
    expect(adapter.fyersSymbolToToken('MCX:CRUDEOIL-COMM')).toBe('MCX_CRUDEOIL');
  });

  test('4. Returns no candles rather than synthesising fake price history', async () => {
    // Regression guard: this used to assert that a random-walk OHLC series was produced
    // when the real API was unavailable. Inventing price history on a trading platform is
    // the bug, not the feature — an empty series lets the UI say "data unavailable".
    const candles = await adapter.getHistoricalCandles('NSE_RELIANCE', '5m', 50);
    expect(Array.isArray(candles)).toBe(true);
    for (const c of candles) {
      expect(c.high).toBeGreaterThanOrEqual(c.low);
      expect(c.time).toBeGreaterThan(0);
    }
  });

  test('5. Generates dynamic option chain matrix with Greeks', async () => {
    const chain = await adapter.getOptionChain('NIFTY', '2026-08-28');
    expect(chain.length).toBeGreaterThan(0);
    expect(chain[0].strikePrice).toBeGreaterThan(0);
    expect(chain[0].ce).toBeDefined();
    expect(chain[0].pe).toBeDefined();
    expect(typeof chain[0].ce.ltp).toBe('number');
  });

  test('6. Supports hot-swapping access token', async () => {
    await adapter.setAccessToken('TEST_HOTSWAP_ACCESS_TOKEN_123');
    expect(adapter.getAccessToken()).toBe('TEST_HOTSWAP_ACCESS_TOKEN_123');
  });

  test('7. Enforces Safety Lock barrier preventing real money order placement', () => {
    expect(() => adapter.placeBrokerOrder()).toThrow('REAL-MONEY TRADING IS DISABLED');
  });
});
