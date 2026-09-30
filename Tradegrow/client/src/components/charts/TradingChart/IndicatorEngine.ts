import { CandleData } from './TradingChart.types';

export interface LinePoint {
  time: number;
  value: number;
}

export interface BollingerPoint {
  time: number;
  upper: number;
  middle: number;
  lower: number;
}

export interface MACDPoint {
  time: number;
  macd: number;
  signal: number;
  histogram: number;
}

export class IndicatorEngine {
  /**
   * Simple Moving Average (SMA)
   */
  public static calculateSMA(candles: CandleData[], period: number = 20, source: 'close' | 'open' = 'close'): LinePoint[] {
    const points: LinePoint[] = [];
    if (candles.length < period) return points;

    for (let i = period - 1; i < candles.length; i++) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += candles[i - j][source];
      }
      points.push({
        time: candles[i].time,
        value: Number((sum / period).toFixed(2))
      });
    }

    return points;
  }

  /**
   * Exponential Moving Average (EMA)
   */
  public static calculateEMA(candles: CandleData[], period: number = 9, source: 'close' | 'open' = 'close'): LinePoint[] {
    const points: LinePoint[] = [];
    if (candles.length < period) return points;

    const k = 2 / (period + 1);

    // Initial SMA for first EMA seed
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += candles[i][source];
    }
    let prevEma = sum / period;
    points.push({ time: candles[period - 1].time, value: Number(prevEma.toFixed(2)) });

    for (let i = period; i < candles.length; i++) {
      const price = candles[i][source];
      const ema = (price * k) + (prevEma * (1 - k));
      points.push({ time: candles[i].time, value: Number(ema.toFixed(2)) });
      prevEma = ema;
    }

    return points;
  }

  /**
   * Weighted Moving Average (WMA)
   */
  public static calculateWMA(candles: CandleData[], period: number = 14): LinePoint[] {
    const points: LinePoint[] = [];
    if (candles.length < period) return points;

    const weightSum = (period * (period + 1)) / 2;

    for (let i = period - 1; i < candles.length; i++) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        const weight = period - j;
        sum += candles[i - j].close * weight;
      }
      points.push({
        time: candles[i].time,
        value: Number((sum / weightSum).toFixed(2))
      });
    }

    return points;
  }

  /**
   * Bollinger Bands (SMA +/- N * stdDev)
   */
  public static calculateBollingerBands(candles: CandleData[], period: number = 20, stdDevMult: number = 2): BollingerPoint[] {
    const points: BollingerPoint[] = [];
    if (candles.length < period) return points;

    const smaPoints = this.calculateSMA(candles, period);

    for (let i = period - 1; i < candles.length; i++) {
      const smaIndex = i - (period - 1);
      const middle = smaPoints[smaIndex].value;

      let varianceSum = 0;
      for (let j = 0; j < period; j++) {
        const diff = candles[i - j].close - middle;
        varianceSum += diff * diff;
      }

      const stdDev = Math.sqrt(varianceSum / period);
      const upper = Number((middle + (stdDevMult * stdDev)).toFixed(2));
      const lower = Number((middle - (stdDevMult * stdDev)).toFixed(2));

      points.push({
        time: candles[i].time,
        middle,
        upper,
        lower
      });
    }

    return points;
  }

  /**
   * Relative Strength Index (RSI)
   */
  public static calculateRSI(candles: CandleData[], period: number = 14): LinePoint[] {
    const points: LinePoint[] = [];
    if (candles.length <= period) return points;

    let gainSum = 0;
    let lossSum = 0;

    for (let i = 1; i <= period; i++) {
      const change = candles[i].close - candles[i - 1].close;
      if (change >= 0) gainSum += change;
      else lossSum += Math.abs(change);
    }

    let avgGain = gainSum / period;
    let avgLoss = lossSum / period;

    let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    let rsi = 100 - (100 / (1 + rs));
    points.push({ time: candles[period].time, value: Number(rsi.toFixed(2)) });

    for (let i = period + 1; i < candles.length; i++) {
      const change = candles[i].close - candles[i - 1].close;
      const gain = change >= 0 ? change : 0;
      const loss = change < 0 ? Math.abs(change) : 0;

      avgGain = ((avgGain * (period - 1)) + gain) / period;
      avgLoss = ((avgLoss * (period - 1)) + loss) / period;

      rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi = 100 - (100 / (1 + rs));
      points.push({ time: candles[i].time, value: Number(rsi.toFixed(2)) });
    }

    return points;
  }

  /**
   * Moving Average Convergence Divergence (MACD)
   */
  public static calculateMACD(
    candles: CandleData[],
    fastPeriod: number = 12,
    slowPeriod: number = 26,
    signalPeriod: number = 9
  ): MACDPoint[] {
    const points: MACDPoint[] = [];
    if (candles.length < slowPeriod + signalPeriod) return points;

    const fastEma = this.calculateEMA(candles, fastPeriod);
    const slowEma = this.calculateEMA(candles, slowPeriod);

    // Align fast and slow EMAs
    const macdLinePoints: LinePoint[] = [];
    const offset = slowPeriod - fastPeriod;

    for (let i = 0; i < slowEma.length; i++) {
      const macdVal = fastEma[i + offset].value - slowEma[i].value;
      macdLinePoints.push({ time: slowEma[i].time, value: macdVal });
    }

    // Signal Line = EMA of MACD Line
    const k = 2 / (signalPeriod + 1);
    let sigSum = 0;
    for (let i = 0; i < signalPeriod; i++) {
      sigSum += macdLinePoints[i].value;
    }
    let prevSignal = sigSum / signalPeriod;

    for (let i = signalPeriod - 1; i < macdLinePoints.length; i++) {
      const macdVal = macdLinePoints[i].value;
      const signalVal = i === signalPeriod - 1 ? prevSignal : (macdVal * k) + (prevSignal * (1 - k));
      const histogram = macdVal - signalVal;

      points.push({
        time: macdLinePoints[i].time,
        macd: Number(macdVal.toFixed(2)),
        signal: Number(signalVal.toFixed(2)),
        histogram: Number(histogram.toFixed(2))
      });

      prevSignal = signalVal;
    }

    return points;
  }

  /**
   * Volume Weighted Average Price (VWAP)
   */
  public static calculateVWAP(candles: CandleData[]): LinePoint[] {
    const points: LinePoint[] = [];
    let cumVolume = 0;
    let cumPriceVolume = 0;

    for (const c of candles) {
      const typicalPrice = (c.high + c.low + c.close) / 3;
      const vol = c.volume || 100;

      cumPriceVolume += typicalPrice * vol;
      cumVolume += vol;

      const vwap = cumVolume > 0 ? cumPriceVolume / cumVolume : typicalPrice;
      points.push({
        time: c.time,
        value: Number(vwap.toFixed(2))
      });
    }

    return points;
  }
}
