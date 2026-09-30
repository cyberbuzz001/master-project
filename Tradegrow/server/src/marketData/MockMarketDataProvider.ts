import { IMarketDataProvider } from './IMarketDataProvider';
import { MarketTick, Candle, OptionChainItem, TickCallback } from './types';

interface InternalStockState {
  token: string;
  exchange: string;
  symbol: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export class MockMarketDataProvider implements IMarketDataProvider {
  public readonly name = 'MOCK_ENGINE';
  private healthy = true;
  private timer: NodeJS.Timeout | null = null;
  private callbacks: Map<string, Set<TickCallback>> = new Map();

  private stockStates: Map<string, InternalStockState> = new Map([
    ['NSE_NIFTY50', { token: 'NSE_NIFTY50', exchange: 'NSE', symbol: 'NIFTY 50', ltp: 24563.00, open: 24572.70, high: 24677.60, low: 24533.55, close: 24614.90, volume: 1548000 }],
    ['NSE_BANKNIFTY', { token: 'NSE_BANKNIFTY', exchange: 'NSE', symbol: 'BANKNIFTY', ltp: 57500.0, open: 57400.0, high: 57800.0, low: 57200.0, close: 57350.0, volume: 920000 }],
    ['BSE_SENSEX', { token: 'BSE_SENSEX', exchange: 'BSE', symbol: 'SENSEX', ltp: 80599.78, open: 80350.20, high: 80720.50, low: 80210.10, close: 80015.00, volume: 1200000 }],
    ['NSE_RELIANCE', { token: 'NSE_RELIANCE', exchange: 'NSE', symbol: 'RELIANCE', ltp: 1284.70, open: 1285.70, high: 1299.00, low: 1284.40, close: 1290.90, volume: 3420000 }],
    ['NSE_TCS', { token: 'NSE_TCS', exchange: 'NSE', symbol: 'TCS', ltp: 2426.30, open: 2415.00, high: 2440.00, low: 2410.00, close: 2420.00, volume: 1120000 }],
    ['NSE_INFY', { token: 'NSE_INFY', exchange: 'NSE', symbol: 'INFY', ltp: 1170.90, open: 1165.00, high: 1180.00, low: 1160.00, close: 1168.00, volume: 2410000 }],
    ['NSE_HDFCBANK', { token: 'NSE_HDFCBANK', exchange: 'NSE', symbol: 'HDFCBANK', ltp: 734.90, open: 732.00, high: 740.00, low: 730.00, close: 733.00, volume: 5410000 }],
    ['NSE_ICICIBANK', { token: 'NSE_ICICIBANK', exchange: 'NSE', symbol: 'ICICIBANK', ltp: 1445.30, open: 1442.00, high: 1449.90, low: 1433.00, close: 1435.40, volume: 3890000 }],
    ['NSE_TATAMOTORS', { token: 'NSE_TATAMOTORS', exchange: 'NSE', symbol: 'TATAMOTORS', ltp: 348.30, open: 344.50, high: 350.00, low: 343.50, close: 339.75, volume: 4120000 }],
    ['NFO_NIFTY_24500_CE', { token: 'NFO_NIFTY_24500_CE', exchange: 'NFO', symbol: 'NIFTY24500CE', ltp: 185.0, open: 160.0, high: 210.0, low: 145.0, close: 165.0, volume: 854000 }],
    ['NFO_NIFTY_24500_PE', { token: 'NFO_NIFTY_24500_PE', exchange: 'NFO', symbol: 'NIFTY24500PE', ltp: 110.0, open: 130.0, high: 145.0, low: 95.0, close: 128.0, volume: 620000 }],

    // MCX Commodities Underlyings & Active Options
    ['MCX_CRUDEOIL', { token: 'MCX_CRUDEOIL', exchange: 'MCX', symbol: 'CRUDEOIL', ltp: 7318.00, open: 7300.00, high: 7380.00, low: 7280.00, close: 7295.00, volume: 154200 }],
    ['MCX_GOLD', { token: 'MCX_GOLD', exchange: 'MCX', symbol: 'GOLD', ltp: 151198.00, open: 150800.00, high: 151500.00, low: 150500.00, close: 150900.00, volume: 42000 }],
    ['MCX_GOLDM', { token: 'MCX_GOLDM', exchange: 'MCX', symbol: 'GOLDM', ltp: 149710.00, open: 149500.00, high: 150200.00, low: 149000.00, close: 149200.00, volume: 84000 }],
    ['MCX_SILVERM', { token: 'MCX_SILVERM', exchange: 'MCX', symbol: 'SILVERM', ltp: 235000.00, open: 234000.00, high: 236500.00, low: 233500.00, close: 234200.00, volume: 68000 }],
    ['MCX_NATURALGAS', { token: 'MCX_NATURALGAS', exchange: 'MCX', symbol: 'NATURALGAS', ltp: 215.50, open: 212.00, high: 218.00, low: 210.00, close: 213.20, volume: 240000 }],
    ['MCX_COPPER', { token: 'MCX_COPPER', exchange: 'MCX', symbol: 'COPPER', ltp: 845.00, open: 841.00, high: 849.00, low: 839.00, close: 842.50, volume: 92000 }],

    ['MCX_CRUDEOIL_7400_PE', { token: 'MCX_CRUDEOIL_7400_PE', exchange: 'MCX', symbol: 'CRUDEOIL7400PE', ltp: 354.20, open: 340.00, high: 380.00, low: 320.00, close: 348.00, volume: 36723 }],
    ['MCX_CRUDEOIL_7000_PE', { token: 'MCX_CRUDEOIL_7000_PE', exchange: 'MCX', symbol: 'CRUDEOIL7000PE', ltp: 155.20, open: 140.00, high: 175.00, low: 130.00, close: 148.00, volume: 36197 }],
    ['MCX_CRUDEOIL_7300_PE', { token: 'MCX_CRUDEOIL_7300_PE', exchange: 'MCX', symbol: 'CRUDEOIL7300PE', ltp: 297.00, open: 280.00, high: 320.00, low: 270.00, close: 290.00, volume: 31333 }],
    ['MCX_CRUDEOIL_7200_PE', { token: 'MCX_CRUDEOIL_7200_PE', exchange: 'MCX', symbol: 'CRUDEOIL7200PE', ltp: 244.50, open: 230.00, high: 265.00, low: 220.00, close: 238.00, volume: 28798 }],
    ['MCX_CRUDEOIL_7500_PE', { token: 'MCX_CRUDEOIL_7500_PE', exchange: 'MCX', symbol: 'CRUDEOIL7500PE', ltp: 419.20, open: 400.00, high: 440.00, low: 385.00, close: 410.00, volume: 19850 }],
    ['MCX_GOLD_140000_PE', { token: 'MCX_GOLD_140000_PE', exchange: 'MCX', symbol: 'GOLD140000PE', ltp: 424.00, open: 410.00, high: 450.00, low: 395.00, close: 415.00, volume: 1042 }],
    ['MCX_GOLDM_140000_PE', { token: 'MCX_GOLDM_140000_PE', exchange: 'MCX', symbol: 'GOLDM140000PE', ltp: 452.00, open: 435.00, high: 475.00, low: 420.00, close: 440.00, volume: 10134 }],
    ['MCX_GOLD_145000_PE', { token: 'MCX_GOLD_145000_PE', exchange: 'MCX', symbol: 'GOLD145000PE', ltp: 1064.00, open: 1020.00, high: 1110.00, low: 990.00, close: 1040.00, volume: 901 }],
    ['MCX_SILVERM_210000_PE', { token: 'MCX_SILVERM_210000_PE', exchange: 'MCX', symbol: 'SILVERM210000PE', ltp: 838.00, open: 800.00, high: 880.00, low: 780.00, close: 820.00, volume: 12211 }],
    ['MCX_CRUDEOIL_6500_PE', { token: 'MCX_CRUDEOIL_6500_PE', exchange: 'MCX', symbol: 'CRUDEOIL6500PE', ltp: 40.20, open: 35.00, high: 52.00, low: 30.00, close: 38.00, volume: 18564 }],
    ['MCX_NATURALGAS_220_CE', { token: 'MCX_NATURALGAS_220_CE', exchange: 'MCX', symbol: 'NATURALGAS220CE', ltp: 14.80, open: 12.00, high: 18.00, low: 10.00, close: 13.50, volume: 15420 }],
    ['MCX_COPPER_850_CE', { token: 'MCX_COPPER_850_CE', exchange: 'MCX', symbol: 'COPPER850CE', ltp: 22.40, open: 19.00, high: 26.00, low: 16.00, close: 21.00, volume: 8430 }]
  ]);

  public isHealthy(): boolean {
    return this.healthy;
  }

  public async initialize(): Promise<void> {
    console.log('[MockMarketDataProvider] Starting simulated real-time market data stream (350ms interval / ~3x per sec)...');
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.generateTicks(), 350);
  }

  public stop(): void {
    console.log('[MockMarketDataProvider] Stopping simulated market data stream...');
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private createDynamicState(token: string): void {
    const optMatch = token.match(/^(?:(NFO|BFO|NSE|BSE|MCX)_)?([A-Z0-9]+?)(?:_)?(\d+(?:\.\d+)?)(?:_)?(CE|PE)$/i);
    if (optMatch) {
      const prefix = optMatch[1] || (optMatch[2].includes('SENSEX') ? 'BFO' : 'NFO');
      const underlying = optMatch[2].toUpperCase().replace(/^(NFO|BFO|NSE|BSE)_/, '');
      const strike = parseFloat(optMatch[3]);
      const optionType = optMatch[4].toUpperCase();

      const spotToken = underlying === 'SENSEX' ? 'BSE_SENSEX' : underlying === 'BANKNIFTY' ? 'NSE_BANKNIFTY' : underlying === 'FINNIFTY' ? 'NSE_FINNIFTY' : underlying === 'MIDCPNIFTY' ? 'NSE_MIDCPNIFTY' : 'NSE_NIFTY50';
      const spot = this.stockStates.get(spotToken)?.ltp || (underlying === 'SENSEX' ? 80599.78 : underlying === 'BANKNIFTY' ? 57500 : 24563.0);

      const isCE = optionType === 'CE';
      const intrinsic = isCE ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
      const distance = Math.abs(spot - strike);
      const timeValue = Math.max(2, (underlying === 'SENSEX' ? 280 : underlying === 'BANKNIFTY' ? 200 : 110) * Math.exp(-distance / (underlying === 'SENSEX' ? 600 : underlying === 'BANKNIFTY' ? 450 : 220)));
      let ltp = Math.max(0.05, intrinsic + timeValue);
      // Round to NSE tick size of 0.05 paise
      ltp = Number((Math.round(ltp * 20) / 20).toFixed(2));

      this.stockStates.set(token, {
        token,
        exchange: prefix.startsWith('B') ? 'BFO' : 'NFO',
        symbol: `${underlying}${strike}${optionType}`,
        ltp,
        open: Number((Math.round(ltp * 0.98 * 20) / 20).toFixed(2)),
        high: Number((Math.round(ltp * 1.05 * 20) / 20).toFixed(2)),
        low: Number((Math.round(ltp * 0.95 * 20) / 20).toFixed(2)),
        close: ltp,
        volume: Math.floor(Math.random() * 100000) + 10000,
      });
    } else {
      this.stockStates.set(token, {
        token,
        exchange: token.startsWith('BSE_') ? 'BSE' : 'NSE',
        symbol: token,
        ltp: 500.0,
        open: 495.0,
        high: 510.0,
        low: 490.0,
        close: 498.0,
        volume: 50000,
      });
    }
  }

  public subscribe(instrumentTokens: string[], callback: TickCallback): void {
    for (const token of instrumentTokens) {
      if (!token) continue;
      if (!this.stockStates.has(token)) {
        this.createDynamicState(token);
      }
      if (!this.callbacks.has(token)) {
        this.callbacks.set(token, new Set());
      }
      this.callbacks.get(token)!.add(callback);

      const state = this.stockStates.get(token);
      if (state) {
        callback(this.buildTick(state));
      }
    }
  }

  public unsubscribe(instrumentTokens: string[]): void {
    for (const token of instrumentTokens) {
      this.callbacks.delete(token);
    }
  }

  public async getQuote(instrumentToken: string): Promise<MarketTick | null> {
    const state = this.stockStates.get(instrumentToken);
    if (!state) return null;
    return this.buildTick(state);
  }

  public async getHistoricalCandles(instrumentToken: string, timeframe: string, count: number = 100): Promise<Candle[]> {
    const state = this.stockStates.get(instrumentToken);
    if (!state) return [];

    // CRITICAL: Snapshot the LTP right now (before the 1-second tick timer
    // changes it). Every candle is built backwards from this anchor so the
    // last candle's close == the live WebSocket tick price exactly.
    const anchorLtp = state.ltp;
    const volatility = anchorLtp * 0.0008; // 0.08% per candle — realistic intraday noise
    const intervalSeconds = timeframe === '1m' ? 60 : timeframe === '5m' ? 300 :
                            timeframe === '15m' ? 900 : timeframe === '1h' ? 3600 : 86400;
    const now = Math.floor(Date.now() / 1000);

    const candles: Candle[] = [];
    let currentClose = anchorLtp; // Walk backwards from today's live price

    for (let i = count; i >= 0; i--) {
      const candleTime = now - (i * intervalSeconds);
      const isLast = (i === 0);

      const close = isLast ? anchorLtp : Number(currentClose.toFixed(2));

      // Realistic open: small random deviation from previous close
      const openDelta = (Math.random() - 0.49) * volatility * 2;
      const open = isLast
        ? Number((anchorLtp - (Math.random() * volatility)).toFixed(2))  // last open slightly below anchor
        : Number((close - openDelta).toFixed(2));

      const high = Number((Math.max(open, close) + Math.random() * volatility).toFixed(2));
      const low  = Number((Math.min(open, close) - Math.random() * volatility).toFixed(2));
      const volume = Math.floor(Math.random() * 50000) + 1000;

      candles.push({ time: candleTime, open, high, low, close, volume });

      // Walk backwards: next candle's close = this candle's open
      currentClose = open;
    }

    return candles; // Returned chronologically (oldest → newest, last close = anchorLtp)
  }

  public async getOptionChain(symbol: string, expiry: string): Promise<OptionChainItem[]> {
    const spotPrice = this.stockStates.get('NSE_NIFTY50')?.ltp || 24500;
    const strikes = [24300, 24400, 24500, 24600, 24700];

    return strikes.map(strike => {
      const ceLtp = Math.max(5, (spotPrice - strike) + 120 + Math.random() * 10);
      const peLtp = Math.max(5, (strike - spotPrice) + 120 + Math.random() * 10);

      return {
        strikePrice: strike,
        expiry: expiry || '2026-08-28',
        ce: {
          instrumentToken: `NFO_NIFTY_${strike}_CE`,
          ltp: Number(ceLtp.toFixed(2)),
          change: Number(((Math.random() - 0.5) * 15).toFixed(2)),
          volume: Math.floor(Math.random() * 200000),
          openInterest: Math.floor(Math.random() * 1500000),
          iv: 14.5,
          delta: spotPrice > strike ? 0.65 : 0.35,
          gamma: 0.002,
          theta: -12.4,
          vega: 18.2
        },
        pe: {
          instrumentToken: `NFO_NIFTY_${strike}_PE`,
          ltp: Number(peLtp.toFixed(2)),
          change: Number(((Math.random() - 0.5) * 15).toFixed(2)),
          volume: Math.floor(Math.random() * 180000),
          openInterest: Math.floor(Math.random() * 1400000),
          iv: 15.2,
          delta: spotPrice < strike ? -0.65 : -0.35,
          gamma: 0.002,
          theta: -11.8,
          vega: 17.8
        }
      };
    });
  }

  private generateTicks(): void {
    // 1. Update spot indices first
    const spotMap = new Map<string, number>();
    const indices = ['NSE_NIFTY50', 'NSE_BANKNIFTY', 'BSE_SENSEX', 'NSE_FINNIFTY', 'NSE_MIDCPNIFTY'];
    for (const idxToken of indices) {
      const state = this.stockStates.get(idxToken);
      if (state) {
        // Micro-step in multiples of 0.05
        const stepTicks = Math.floor(Math.random() * 9) - 4; // -4 to +4 steps
        const delta = stepTicks * 0.05;
        state.ltp = Number((Math.round((state.ltp + delta) * 20) / 20).toFixed(2));
        state.high = Math.max(state.high, state.ltp);
        state.low = Math.min(state.low, state.ltp);
        state.volume += Math.floor(Math.random() * 100) + 10;
        spotMap.set(idxToken, state.ltp);
      }
    }

    // 2. Update all active assets and option strikes
    for (const [token, state] of this.stockStates.entries()) {
      if (indices.includes(token)) {
        // Already updated
      } else {
        const optMatch = token.match(/^(?:(NFO|BFO|NSE|BSE|MCX)_)?([A-Z0-9]+?)(?:_)?(\d+(?:\.\d+)?)(?:_)?(CE|PE)$/i);
        if (optMatch) {
          const underlying = optMatch[2].toUpperCase().replace(/^(NFO|BFO|NSE|BSE)_/, '');
          const strike = parseFloat(optMatch[3]);
          const isCE = optMatch[4].toUpperCase() === 'CE';

          const spotToken = underlying === 'SENSEX' ? 'BSE_SENSEX' : underlying === 'BANKNIFTY' ? 'NSE_BANKNIFTY' : underlying === 'FINNIFTY' ? 'NSE_FINNIFTY' : underlying === 'MIDCPNIFTY' ? 'NSE_MIDCPNIFTY' : 'NSE_NIFTY50';
          const spot = spotMap.get(spotToken) || (underlying === 'SENSEX' ? 80599.78 : underlying === 'BANKNIFTY' ? 57500 : 24563.0);

          // Broker-grade option tick fluctuation
          const stepMultiplier = Math.floor(Math.random() * 5) - 2; // -2 to +2 steps of 0.05
          const priceChange = stepMultiplier * 0.05;

          const newLtp = state.ltp + priceChange;
          state.ltp = Number(Math.max(0.05, Math.round(newLtp * 20) / 20).toFixed(2));
          state.high = Math.max(state.high, state.ltp);
          state.low = Math.min(state.low, state.ltp);
          state.volume += Math.floor(Math.random() * 25) + 5;
        } else {
          const stepTicks = Math.floor(Math.random() * 5) - 2;
          const delta = stepTicks * 0.05;
          state.ltp = Number(Math.max(0.05, Math.round((state.ltp + delta) * 20) / 20).toFixed(2));
          state.high = Math.max(state.high, state.ltp);
          state.low = Math.min(state.low, state.ltp);
          state.volume += Math.floor(Math.random() * 50) + 1;
        }
      }

      const tick = this.buildTick(state);
      const cbs = this.callbacks.get(token);
      if (cbs) {
        cbs.forEach(cb => cb(tick));
      }
    }
  }

  private buildTick(state: InternalStockState): MarketTick {
    const change = Number((state.ltp - state.close).toFixed(2));
    const changePercent = state.close > 0 ? Number(((change / state.close) * 100).toFixed(2)) : 0;
    const bid = Number(Math.max(0.05, state.ltp - 0.05).toFixed(2));
    const ask = Number((state.ltp + 0.05).toFixed(2));

    return {
      instrumentToken: state.token,
      exchange: state.exchange,
      symbol: state.symbol,
      ltp: state.ltp,
      open: state.open,
      high: state.high,
      low: state.low,
      close: state.close,
      volume: state.volume,
      change,
      changePercent,
      bid,
      ask,
      bidQty: Math.floor(Math.random() * 500) + 50,
      askQty: Math.floor(Math.random() * 500) + 50,
      timestamp: Date.now()
    };
  }

  public destroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }
}
