import { IndicatorEngine } from '../client/src/components/charts/TradingChart/IndicatorEngine';
import { CandleData } from '../client/src/components/charts/TradingChart/TradingChart.types';

describe('TradingView Lightweight Charts Indicator Engine Tests', () => {
  const sampleCandles: CandleData[] = Array.from({ length: 50 }, (_, i) => {
    const time = 1700000000 + (i * 300);
    const close = 100 + Math.sin(i / 5) * 10 + (i * 0.5);
    return {
      time,
      open: close - 1,
      high: close + 2,
      low: close - 2,
      close,
      volume: 1000 + (i * 50)
    };
  });

  test('1. Calculates SMA correctly', () => {
    const sma = IndicatorEngine.calculateSMA(sampleCandles, 20);
    expect(sma.length).toBe(31); // 50 - 20 + 1
    expect(sma[0].time).toBe(sampleCandles[19].time);
    expect(typeof sma[0].value).toBe('number');
  });

  test('2. Calculates EMA correctly', () => {
    const ema = IndicatorEngine.calculateEMA(sampleCandles, 9);
    expect(ema.length).toBe(42); // 50 - 9 + 1
    expect(ema[0].time).toBe(sampleCandles[8].time);
    expect(typeof ema[0].value).toBe('number');
  });

  test('3. Calculates Bollinger Bands correctly', () => {
    const bb = IndicatorEngine.calculateBollingerBands(sampleCandles, 20, 2);
    expect(bb.length).toBe(31);
    expect(bb[0].upper).toBeGreaterThan(bb[0].middle);
    expect(bb[0].lower).toBeLessThan(bb[0].middle);
  });

  test('4. Calculates RSI correctly', () => {
    const rsi = IndicatorEngine.calculateRSI(sampleCandles, 14);
    expect(rsi.length).toBe(36);
    expect(rsi[0].value).toBeGreaterThanOrEqual(0);
    expect(rsi[0].value).toBeLessThanOrEqual(100);
  });

  test('5. Calculates MACD correctly', () => {
    const macd = IndicatorEngine.calculateMACD(sampleCandles, 12, 26, 9);
    expect(macd.length).toBeGreaterThan(0);
    expect(macd[0].histogram).toBeCloseTo(macd[0].macd - macd[0].signal, 2);
  });

  test('6. Calculates VWAP correctly', () => {
    const vwap = IndicatorEngine.calculateVWAP(sampleCandles);
    expect(vwap.length).toBe(50);
    expect(vwap[0].time).toBe(sampleCandles[0].time);
  });
});
