import { MarketTick, Candle, OptionChainItem, TickCallback } from './types';

export interface IMarketDataProvider {
  name: string;
  isHealthy(): boolean;
  initialize(): Promise<void>;
  stop?(): void;
  subscribe(instrumentTokens: string[], callback: TickCallback): void;
  unsubscribe(instrumentTokens: string[]): void;
  getQuote(instrumentToken: string): Promise<MarketTick | null>;
  getHistoricalCandles(instrumentToken: string, timeframe: string, count: number): Promise<Candle[]>;
  getOptionChain(symbol: string, expiry: string): Promise<OptionChainItem[]>;
}
