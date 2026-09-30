import { marginForLeg, resolveReferencePrice, resolveOptionDetails, ZERO_CHARGES } from '../trading/MarginMath';
import { SymbologyNormalizer } from '../marketData/SymbologyNormalizer';

const NO_RATES = { spanMarginRate: 0, exposureMarginRate: 0, additionalMarginRate: 0 };

describe('MarginMath.marginForLeg', () => {
  test('option BUY: required margin is premium only (orderValue + charges)', () => {
    const r = marginForLeg({
      productType: 'MIS', side: 'BUY', quantity: 50, price: 100,
      optionType: 'CE', strike: 24000, marginParams: NO_RATES, charges: ZERO_CHARGES,
    });
    expect(r.requiredMargin).toBeCloseTo(5000, 2);
    expect(r.premium).toBeCloseTo(5000, 2);
    expect(r.spanMargin).toBe(0);
  });

  test('option SELL: SPAN = max(span formula, minimum floor), plus exposure', () => {
    const spot = 24250, strike = 24000, price = 120, qty = 50;
    const spanRate = 0.12, exposureRate = 0.03;
    const otm = Math.max(0, strike - spot); // ITM CE -> 0
    const spanFormula = (price + spanRate * spot - otm) * qty;
    const spanFloor = (price + 0.05 * spot) * qty;
    const expectedSpan = Math.max(spanFormula, spanFloor);
    const expectedExposure = exposureRate * spot * qty;

    const r = marginForLeg({
      productType: 'NRML', side: 'SELL', quantity: qty, price,
      optionType: 'CE', strike, spotPrice: spot,
      marginParams: { spanMarginRate: spanRate, exposureMarginRate: exposureRate, additionalMarginRate: 0 },
      charges: ZERO_CHARGES,
    });
    expect(r.spanMargin).toBeCloseTo(expectedSpan, 2);
    expect(r.exposureMargin).toBeCloseTo(expectedExposure, 2);
    expect(r.requiredMargin).toBeCloseTo(expectedSpan + expectedExposure, 2);
    expect(r.isEstimated).toBe(true);
  });

  test('option SELL: deep OTM strike still floors at the minimum SPAN amount', () => {
    // Far OTM PE — the span formula alone would go very low; the floor must win.
    const spot = 24250, strike = 20000, price = 5, qty = 50;
    const r = marginForLeg({
      productType: 'NRML', side: 'SELL', quantity: qty, price,
      optionType: 'PE', strike, spotPrice: spot,
      marginParams: { spanMarginRate: 0.12, exposureMarginRate: 0.03, additionalMarginRate: 0 },
      charges: ZERO_CHARGES,
    });
    const spanFloor = (price + 0.05 * spot) * qty;
    expect(r.spanMargin).toBeCloseTo(spanFloor, 2);
  });

  test('equity/futures MIS: 20% of order value (5x intraday leverage)', () => {
    const r = marginForLeg({
      productType: 'MIS', side: 'BUY', quantity: 100, price: 250,
      marginParams: NO_RATES, charges: ZERO_CHARGES,
    });
    expect(r.requiredMargin).toBeCloseTo(100 * 250 * 0.20, 2);
  });

  test('CNC/NRML equity: 100% of order value', () => {
    const r = marginForLeg({
      productType: 'CNC', side: 'BUY', quantity: 10, price: 1500,
      marginParams: NO_RATES, charges: ZERO_CHARGES,
    });
    expect(r.requiredMargin).toBeCloseTo(10 * 1500, 2);
  });

  test('charges are added on top of the base requirement when supplied', () => {
    const charges = { stt: 10, gst: 2, exchangeCharges: 1, stampDuty: 0, sebiFee: 0.5, total: 13.5 };
    const r = marginForLeg({
      productType: 'CNC', side: 'BUY', quantity: 10, price: 100,
      marginParams: NO_RATES, charges,
    });
    expect(r.requiredMargin).toBeCloseTo(1000 + 13.5, 2);
  });
});

describe('MarginMath.resolveReferencePrice', () => {
  test('a fresh tick is tagged live', () => {
    const r = resolveReferencePrice({ ltp: 100, timestamp: Date.now() }, 50);
    expect(r).toMatchObject({ price: 100, source: 'live', isStale: false });
  });

  test('a tick older than the staleness threshold is tagged cached_stale but still used', () => {
    const r = resolveReferencePrice({ ltp: 100, timestamp: Date.now() - 60000 }, 50);
    expect(r).toMatchObject({ price: 100, source: 'cached_stale', isStale: true });
  });

  test('no tick at all falls back to the supplied default, tagged cached_stale', () => {
    const r = resolveReferencePrice(null, 42);
    expect(r).toMatchObject({ price: 42, source: 'cached_stale', isStale: true });
  });

  test('a tick with zero/negative ltp is treated as missing, not used', () => {
    const r = resolveReferencePrice({ ltp: 0, timestamp: Date.now() }, 42);
    expect(r.price).toBe(42);
  });
});

describe('MarginMath.resolveOptionDetails', () => {
  test('prefers an authoritative instrument row over symbol parsing', () => {
    const r = resolveOptionDetails('NIFTY 24500 CE', { option_type: 'CE', strike: '24500', name: 'NIFTY' });
    expect(r).toEqual({ underlying: 'NIFTY', strike: 24500, optionType: 'CE' });
  });

  test('falls back to symbol parsing when no instrument row matches', () => {
    const r = resolveOptionDetails('NFO_NIFTY_24500_CE', null);
    expect(r).toEqual({ underlying: 'NIFTY', strike: 24500, optionType: 'CE' });
  });

  test('returns null for a non-option symbol with no instrument row', () => {
    const r = resolveOptionDetails('RELIANCE', null);
    expect(r).toBeNull();
  });
});

describe('SymbologyNormalizer.parseOptionSymbol', () => {
  test('parses common option symbol formats', () => {
    expect(SymbologyNormalizer.parseOptionSymbol('NIFTY 24500 CE')).toEqual({ underlying: 'NIFTY', strike: 24500, optionType: 'CE' });
    expect(SymbologyNormalizer.parseOptionSymbol('BFO_SENSEX_78400_PE')).toEqual({ underlying: 'SENSEX', strike: 78400, optionType: 'PE' });
    expect(SymbologyNormalizer.parseOptionSymbol('NFO_NIFTY_24500_CE')).toEqual({ underlying: 'NIFTY', strike: 24500, optionType: 'CE' });
    expect(SymbologyNormalizer.parseOptionSymbol('NIFTY-24500-CE')).toEqual({ underlying: 'NIFTY', strike: 24500, optionType: 'CE' });
  });

  test('parses compact, OpenAlgo, and NSE monthly/weekly option formats', () => {
    expect(SymbologyNormalizer.parseOptionSymbol('NIFTY30DEC2524500CE')).toEqual({ underlying: 'NIFTY', strike: 24500, optionType: 'CE' });
    expect(SymbologyNormalizer.parseOptionSymbol('NIFTY24DEC24500CE')).toEqual({ underlying: 'NIFTY', strike: 24500, optionType: 'CE' });
    expect(SymbologyNormalizer.parseOptionSymbol('NIFTY24D3024500CE')).toEqual({ underlying: 'NIFTY', strike: 24500, optionType: 'CE' });
    expect(SymbologyNormalizer.parseOptionSymbol('NIFTY24500CE')).toEqual({ underlying: 'NIFTY', strike: 24500, optionType: 'CE' });
    expect(SymbologyNormalizer.parseOptionSymbol('RELIANCE24DEC2500CE')).toEqual({ underlying: 'RELIANCE', strike: 2500, optionType: 'CE' });
  });

  test('returns null for plain equity or futures symbols', () => {
    expect(SymbologyNormalizer.parseOptionSymbol('RELIANCE')).toBeNull();
    expect(SymbologyNormalizer.parseOptionSymbol('NIFTY-FUT')).toBeNull();
    expect(SymbologyNormalizer.parseOptionSymbol('RELIANCE24SEPFUT')).toBeNull();
  });
});

