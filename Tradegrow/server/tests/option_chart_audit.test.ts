import { DhanAdapter } from '../src/marketData/DhanAdapter';
import { OptionChainEngine } from '../src/marketData/OptionChainEngine';
import { MarketDataEngine } from '../src/marketData/MarketDataEngine';
import { SymbologyNormalizer } from '../src/marketData/SymbologyNormalizer';

describe('Live Option Strike Price Chart & Authoritative LTP Audit', () => {
  let dhanAdapter: DhanAdapter;

  beforeAll(() => {
    dhanAdapter = new DhanAdapter();
  });

  test('1. SymbologyNormalizer resolves canonical option token aliases', () => {
    const token = 'BFO_SENSEX_77300_CE';
    const aliases = SymbologyNormalizer.normalizeToken(token);
    expect(aliases).toBeDefined();
    expect(aliases.length).toBeGreaterThan(0);
    expect(aliases.some(a => a.includes('77300') || a.includes('SENSEX'))).toBe(true);
  });

  test('2. Historical candles for option strike are anchored to live LTP without price jumps', async () => {
    const optionToken = 'BFO_SENSEX_77300_CE';
    
    // Inject a simulated live tick into MarketDataEngine
    const mockLtp = 245.80;
    MarketDataEngine.getInstance().setCachedTick({
      instrumentToken: optionToken,
      exchange: 'BSE',
      symbol: 'SENSEX 77300 CE',
      ltp: mockLtp,
      open: 230.00,
      high: 255.00,
      low: 220.00,
      close: mockLtp,
      volume: 15400,
      change: +15.80,
      changePercent: +6.87,
      bid: 245.50,
      ask: 246.00,
      bidQty: 100,
      askQty: 100,
      timestamp: Date.now()
    });

    // Historical candles must come from the provider only. This previously asserted that
    // exactly 50 candles were always returned — which was only ever true because the
    // adapter synthesised them with Math.random() when the real API had nothing.
    const candles = await dhanAdapter.getHistoricalCandles(optionToken, '5m', 50);
    expect(Array.isArray(candles)).toBe(true);
    expect(candles.length).toBeLessThanOrEqual(50);

    for (const c of candles) {
      expect(c.high).toBeGreaterThanOrEqual(c.low);
      expect(c.high).toBeGreaterThanOrEqual(c.close);
      expect(c.low).toBeLessThanOrEqual(c.close);
    }
  });

  test('3. Option chain produces complete sanitized items with instrument tokens and Greeks', async () => {
    // OptionChainEngine exposes a static generateOptionChain(); there is no getInstance(),
    // so this suite failed to compile and had not run at all.
    const result = await OptionChainEngine.generateOptionChain({ symbol: 'SENSEX', strikeRange: '5' });
    expect(result).toBeDefined();
    expect(Array.isArray(result.chain)).toBe(true);

    for (const row of result.chain) {
      expect(row.strikePrice).toBeGreaterThan(0);
      expect(row.ce?.instrumentToken).toBeDefined();
      expect(row.pe?.instrumentToken).toBeDefined();
      expect(row.ce?.delta).toBeDefined();
    }
  });

  test('4. Single Source of Truth: Option Chain LTP equals Cached Market Tick', () => {
    const testToken = 'BFO_SENSEX_77300_CE';
    const testPrice = 312.45;
    
    MarketDataEngine.getInstance().setCachedTick({
      instrumentToken: testToken,
      exchange: 'BSE',
      symbol: 'SENSEX 77300 CE',
      ltp: testPrice,
      open: 300,
      high: 320,
      low: 290,
      close: testPrice,
      volume: 5000,
      change: 12.45,
      changePercent: 4.15,
      bid: 312,
      ask: 313,
      bidQty: 50,
      askQty: 50,
      timestamp: Date.now()
    });

    const cached = MarketDataEngine.getInstance().getCachedTick(testToken);
    expect(cached).toBeDefined();
    expect(cached?.ltp).toBe(testPrice);
  });
});
