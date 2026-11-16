jest.mock('../db/schema', () => ({ queryOne: jest.fn() }));
jest.mock('../marketData/MarketDataEngine', () => ({ MarketDataEngine: { getInstance: jest.fn() } }));
jest.mock('../marketData/InstrumentMasterService', () => ({ InstrumentMasterService: { getInstance: jest.fn() } }));
jest.mock('../utils/marketHours', () => ({ checkSessionWindow: jest.fn(() => ({ open: true })), istDateString: () => '2026-11-16' }));
import { validateResearchData, buildResearchSnapshot } from '../services/ResearchSnapshotService';
import { queryOne } from '../db/schema';
import { MarketDataEngine } from '../marketData/MarketDataEngine';
import { InstrumentMasterService } from '../marketData/InstrumentMasterService';
import { MarketTick, Candle } from '../marketData/types';

const now = Date.now();
const quote = { instrumentToken: 'NSE_RELIANCE', source: 'dhan', timestamp: now, ltp: 100, bid: 99.9, ask: 100.1,
  depthVerified: true, lowerCircuit:50, upperCircuit:200 } as MarketTick;
const bars: Candle[] = Array.from({ length: 31 }, (_, i) => ({ time: Math.floor(now / 1000)- (31-i)*300, open:100, high:102, low:99, close:101, volume:100 }));

test('only completed, ordered, real-price bars enter research', () => {
  const data = validateResearchData(quote.instrumentToken, quote, [...bars, { ...bars[30], time: Math.floor(now/1000) }], now);
  expect(data).toHaveLength(31);
  expect(() => validateResearchData(quote.instrumentToken, quote, [...bars].reverse(), now)).toThrow('unordered');
  expect(() => validateResearchData(quote.instrumentToken, quote, [{ ...bars[0], low: NaN }, ...bars.slice(1)], now)).toThrow('invalid');
});

test.each([
  { timestamp: now-61000 }, { instrumentToken: 'OTHER' }, { source: 'synthetic_skew' },
  { isSynthetic: true }, { ask: 99 }, { bid: 0 }, { ask: 120 },
  { depthVerified:false }, { lowerCircuit: undefined }, { upperCircuit:99 },
])('rejects unsafe quote %j', change => {
  expect(() => validateResearchData(quote.instrumentToken, { ...quote, ...change } as MarketTick, bars, now)).toThrow();
});

test('builds a snapshot from exact server metadata and Dhan data', async () => {
  (queryOne as jest.Mock).mockResolvedValueOnce({ instrument_token: quote.instrumentToken, trading_symbol: 'RELIANCE',
    exchange: 'NSE', instrument_type: 'EQ', lot_size: 1, tick_size: .05 }).mockResolvedValueOnce({ configured: 10, today: 0 });
  (InstrumentMasterService.getInstance as jest.Mock).mockReturnValue({ getDhanScripByToken: () => ({ lotSize:1 }) });
  (MarketDataEngine.getInstance as jest.Mock).mockReturnValue({ getActiveProviderName: () => 'DHAN',
    getResearchCandles: async () => bars, getResearchQuote: async () => quote });
  const result = await buildResearchSnapshot(quote.instrumentToken);
  expect(result.last_price).toBe('100');
  expect(result.source).toBe('dhan');
  expect(result.bars).toHaveLength(31);
});

test('holiday calendar unavailable blocks generation', async () => {
  (queryOne as jest.Mock).mockResolvedValueOnce({ exchange:'NSE', instrument_type:'EQ' }).mockResolvedValueOnce({ configured: 0, today:0 });
  await expect(buildResearchSnapshot('NSE_RELIANCE')).rejects.toThrow('calendar unavailable');
});
