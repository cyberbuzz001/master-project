export type ChartType = 'Candlestick' | 'Bar' | 'Line' | 'Area';

export type Timeframe = '1m' | '3m' | '5m' | '10m' | '15m' | '30m' | '1h' | '4h' | '1D' | '1W' | '1M';

export interface CandleData {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface IndicatorConfig {
  id: string;
  name: string;
  type: 'SMA' | 'EMA' | 'WMA' | 'BOLLINGER' | 'RSI' | 'MACD' | 'VWAP' | 'ATR';
  period?: number;
  source?: 'close' | 'open' | 'high' | 'low';
  color?: string;
  stdDev?: number;
  fastPeriod?: number;
  slowPeriod?: number;
  signalPeriod?: number;
  enabled: boolean;
}

export interface OrderMarker {
  id: string;
  time: number;
  side: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  status: string;
}

export interface PositionMarker {
  symbol: string;
  side: 'LONG' | 'SHORT';
  averagePrice: number;
  quantity: number;
  unrealizedPnl: number;
}
