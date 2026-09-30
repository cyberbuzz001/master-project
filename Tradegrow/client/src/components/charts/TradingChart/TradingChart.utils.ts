import { CandleData } from './TradingChart.types';

export function normalizeAndSortCandles(rawCandles: any[]): CandleData[] {
  if (!Array.isArray(rawCandles) || rawCandles.length === 0) return [];

  const validCandles: CandleData[] = [];
  const maxAllowedFutureTime = Math.floor(Date.now() / 1000) + 300; // allow 5 mins max clock skew

  for (const c of rawCandles) {
    if (!c) continue;
    let timeNum = typeof c.time === 'number' ? c.time : Math.floor(new Date(c.time).getTime() / 1000);
    if (isNaN(timeNum) || timeNum <= 0 || timeNum > maxAllowedFutureTime) continue;

    const open = Number(c.open || 0);
    const rawHigh = Number(c.high || open);
    const rawLow = Number(c.low || open);
    const close = Number(c.close || open);
    const volume = Math.max(0, Number(c.volume || 0));

    // Enforce strict OHLC invariants: High >= max(Open, Close, Low), Low <= min(Open, Close, High)
    const high = Math.max(rawHigh, open, close, rawLow);
    const low = Math.min(rawLow, open, close, rawHigh);

    validCandles.push({
      time: timeNum,
      open,
      high,
      low,
      close,
      volume
    });
  }

  // Deduplicate by timestamp (last one wins) and sort ascending
  const map = new Map<number, CandleData>();
  for (const candle of validCandles) {
    map.set(candle.time, candle);
  }

  return Array.from(map.values()).sort((a, b) => a.time - b.time);
}

export function aggregateTickToCandle(
  existingCandle: CandleData | null,
  tickPrice: number,
  tickTime: number,
  intervalSeconds: number
): { candle: CandleData; isNewCandle: boolean } {
  const currentIntervalStart = Math.floor(tickTime / intervalSeconds) * intervalSeconds;

  if (!existingCandle || existingCandle.time < currentIntervalStart) {
    return {
      candle: {
        time: currentIntervalStart,
        open: tickPrice,
        high: tickPrice,
        low: tickPrice,
        close: tickPrice,
        volume: 10
      },
      isNewCandle: true
    };
  }

  const high = Math.max(existingCandle.high, tickPrice);
  const low = Math.min(existingCandle.low, tickPrice);

  return {
    candle: {
      time: existingCandle.time,
      open: existingCandle.open,
      high,
      low,
      close: tickPrice,
      volume: (existingCandle.volume || 0) + 1
    },
    isNewCandle: false
  };
}

