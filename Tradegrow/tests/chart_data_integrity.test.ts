import { aggregateTickToCandle, normalizeAndSortCandles } from '../client/src/components/charts/TradingChart/TradingChart.utils';
import { IndicatorEngine } from '../client/src/components/charts/TradingChart/IndicatorEngine';

describe('Chart data integrity', () => {
  test('VWAP requires actual volume and resets for the next IST session', () => {
    expect(IndicatorEngine.calculateVWAP([{ time: 600, open: 100, high: 100, low: 100, close: 100, volume: 0 }])).toEqual([]);
    expect(IndicatorEngine.calculateVWAP([600, 86460].map((time, i) => ({ time, open: 100 + i * 100, high: 100 + i * 100, low: 100 + i * 100, close: 100 + i * 100, volume: 10 })))).toEqual([{ time: 600, value: 100 }, { time: 86460, value: 200 }]);
  });
  test('old ticks do not change a newer candle', () => {
    const current = { time: 600, open: 100, high: 110, low: 99, close: 105, volume: 400 };
    expect(aggregateTickToCandle(current, 80, 599, 60).candle).toEqual(current);
  });
  test('ticks in a new session create a new bar instead of changing historical close', () => {
    const prior = { time: 600, open: 100, high: 110, low: 99, close: 105, volume: 400 };
    const next = aggregateTickToCandle(prior, 120, 86460, 60);
    expect(next.isNewCandle).toBe(true);
    expect(next.candle).toEqual({ time: 86460, open: 120, high: 120, low: 120, close: 120, volume: 0 });
    expect(prior.close).toBe(105);
  });
  test('price ticks never invent traded volume', () => {
    const prior = { time: 600, open: 100, high: 110, low: 99, close: 105, volume: 400 };
    expect(aggregateTickToCandle(prior, 106, 610, 60).candle.volume).toBe(400);
  });
  test('rejects nonfinite OHLC and sorts/deduplicates valid bars', () => {
    const bar = { time: 600, open: 100, high: 110, low: 99, close: 105, volume: 400 };
    expect(normalizeAndSortCandles([{ ...bar, open: Infinity }, { ...bar, time: 660 }, bar, { ...bar, close: 107 }])).toEqual([{ ...bar, close: 107 }, { ...bar, time: 660 }]);
  });
});
