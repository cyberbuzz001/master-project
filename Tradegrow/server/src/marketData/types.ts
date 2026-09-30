export type TickSource = 'live' | 'guard_feed' | 'synthetic_skew' | 'cached_stale' | 'market_closed' | 'dhan' | 'fyers' | 'angelone';

export interface MarketTick {
  instrumentToken: string;
  exchange: string;
  symbol: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change: number;
  changePercent: number;
  bid: number;
  ask: number;
  bidQty: number;
  askQty: number;
  timestamp: number;
  source?: TickSource;
  isSynthetic?: boolean;
}

export interface Candle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OptionContractDetails {
  instrumentToken: string;
  tradingSymbol?: string;
  ltp: number;
  bid?: number;
  ask?: number;
  change: number;
  changePercent?: number;
  volume: number;
  openInterest: number;
  openInterestChange?: number;
  iv: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  classification?: 'ITM' | 'ATM' | 'OTM';
  source?: TickSource;
  isSynthetic?: boolean;
}

export interface OptionChainItem {
  strikePrice: number;
  expiry: string;
  isAtm?: boolean;
  ce: OptionContractDetails;
  pe: OptionContractDetails;
}

export type TickCallback = (tick: MarketTick) => void;
