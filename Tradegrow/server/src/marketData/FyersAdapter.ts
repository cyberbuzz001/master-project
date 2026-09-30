import WebSocket from 'ws';
import { IMarketDataProvider } from './IMarketDataProvider';
import { MarketTick, Candle, OptionChainItem, TickCallback } from './types';
import { SafetyLock } from '../services/SafetyLock';
import { OptionChainEngine } from './OptionChainEngine';
import { SymbologyNormalizer } from './SymbologyNormalizer';

export class FyersAdapter implements IMarketDataProvider {
  public readonly name = 'FYERS';
  private healthy = false;
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private pollIntervalTimer: NodeJS.Timeout | null = null;
  private callbacks: Set<TickCallback> = new Set();
  private tickCache: Map<string, MarketTick> = new Map();
  private subscribedTokens: Set<string> = new Set();
  private lastTickTime = 0;

  private appId: string;
  private secretKey: string;
  private accessToken: string;
  private redirectUri: string;
  private baseUrl = 'https://api-t1.fyers.in';
  private wsUrl = 'wss://socket.fyers.in/socket/v2/data';

  // Common Fyers Symbols Mapping
  private static SYMBOL_MAP: Record<string, string> = {
    'NSE_NIFTY50': 'NSE:NIFTY50-INDEX',
    'NSE_BANKNIFTY': 'NSE:NIFTYBANK-INDEX',
    'BSE_SENSEX': 'BSE:SENSEX-INDEX',
    'NSE_FINNIFTY': 'NSE:FINNIFTY-INDEX',
    'NSE_MIDCPNIFTY': 'NSE:MIDCPNIFTY-INDEX',
    'NSE_RELIANCE': 'NSE:RELIANCE-EQ',
    'NSE_TCS': 'NSE:TCS-EQ',
    'NSE_INFY': 'NSE:INFY-EQ',
    'NSE_HDFCBANK': 'NSE:HDFCBANK-EQ',
    'NSE_ICICIBANK': 'NSE:ICICIBANK-EQ',
    'NSE_TATAMOTORS': 'NSE:TATAMOTORS-EQ',
    'MCX_CRUDEOIL': 'MCX:CRUDEOIL-COMM',
    'MCX_GOLD': 'MCX:GOLD-COMM',
    'MCX_GOLDM': 'MCX:GOLDM-COMM',
    'MCX_SILVERM': 'MCX:SILVERM-COMM',
    'MCX_NATURALGAS': 'MCX:NATURALGAS-COMM',
    'MCX_COPPER': 'MCX:COPPER-COMM'
  };

  // Reverse mapping from Fyers symbol back to internal token
  private static REVERSE_SYMBOL_MAP: Record<string, string> = {};

  // Reference prices for fallback / off-market simulation
  private static REFERENCE_PRICES: Record<string, { ltp: number; open: number; high: number; low: number; close: number }> = {
    'NSE_NIFTY50': { ltp: 24595.55, open: 24572.70, high: 24606.15, low: 24515.15, close: 24383.60 },
    'NSE_BANKNIFTY': { ltp: 57785.80, open: 57569.60, high: 57853.30, low: 57465.95, close: 57264.85 },
    'BSE_SENSEX': { ltp: 80599.78, open: 80350.20, high: 80720.50, low: 80210.10, close: 80015.00 },
    'NSE_FINNIFTY': { ltp: 26120.40, open: 26050.00, high: 26180.00, low: 26010.00, close: 25980.00 },
    'NSE_MIDCPNIFTY': { ltp: 13240.50, open: 13190.00, high: 13290.00, low: 13150.00, close: 13120.00 },
    'NSE_RELIANCE': { ltp: 1310.10, open: 1315.20, high: 1315.80, low: 1308.80, close: 1307.80 },
    'NSE_TCS': { ltp: 2428.50, open: 2383.90, high: 2436.50, low: 2383.00, close: 2365.60 },
    'NSE_INFY': { ltp: 1158.20, open: 1145.10, high: 1161.80, low: 1138.10, close: 1130.10 },
    'NSE_HDFCBANK': { ltp: 753.65, open: 753.05, high: 756.85, low: 750.25, close: 748.15 },
    'NSE_ICICIBANK': { ltp: 1445.30, open: 1442.00, high: 1449.90, low: 1433.00, close: 1435.40 },
    'NSE_TATAMOTORS': { ltp: 348.30, open: 344.50, high: 350.00, low: 343.50, close: 339.75 },
    'MCX_CRUDEOIL': { ltp: 6350.00, open: 6310.00, high: 6400.00, low: 6280.00, close: 6320.00 },
    'MCX_GOLD': { ltp: 72450.00, open: 72100.00, high: 72600.00, low: 72050.00, close: 72200.00 },
    'MCX_GOLDM': { ltp: 72380.00, open: 72000.00, high: 72500.00, low: 71950.00, close: 72100.00 },
    'MCX_SILVERM': { ltp: 84200.00, open: 83900.00, high: 84600.00, low: 83700.00, close: 84000.00 },
    'MCX_NATURALGAS': { ltp: 215.40, open: 212.00, high: 218.50, low: 210.20, close: 213.00 },
    'MCX_COPPER': { ltp: 845.80, open: 840.00, high: 852.00, low: 838.50, close: 842.10 }
  };

  static {
    // Populate reverse mapping table
    for (const [internalToken, fyersSym] of Object.entries(FyersAdapter.SYMBOL_MAP)) {
      FyersAdapter.REVERSE_SYMBOL_MAP[fyersSym] = internalToken;
    }
  }

  constructor() {
    this.appId = process.env.FYERS_APP_ID || '';
    this.secretKey = process.env.FYERS_SECRET_KEY || '';
    this.accessToken = process.env.FYERS_ACCESS_TOKEN || '';
    this.redirectUri = process.env.FYERS_REDIRECT_URI || 'http://localhost:5000/api/v1/auth/fyers/callback';
  }

  public isHealthy(): boolean {
    return this.healthy && (this.lastTickTime === 0 || Date.now() - this.lastTickTime < 60000);
  }

  public getAccessToken(): string {
    return this.accessToken;
  }

  public async setAccessToken(newToken: string): Promise<void> {
    console.log('[FyersAdapter] 🔄 Hot-swapping Fyers access token...');
    this.accessToken = newToken;
    this.appId = process.env.FYERS_APP_ID || this.appId;
    await this.connectWebSocket();
    console.log('[FyersAdapter] ✅ Access token updated and WebSocket reconnected.');
  }

  public async initialize(): Promise<void> {
    // DISABLED: Fyers provider is not in use. Prevents WebSocket crash-reconnect storms.
    console.log('[FyersAdapter] ⏭️  Fyers initialize() skipped — provider disabled. Using Dhan-only mode.');
    this.healthy = false;
  }

  public stop(): void {
    console.log('[FyersAdapter] Stopping Fyers Market Data Adapter...');
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.pollIntervalTimer) {
      clearInterval(this.pollIntervalTimer);
      this.pollIntervalTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.removeAllListeners();
        this.ws.close();
      } catch (_) {}
      this.ws = null;
    }
    this.healthy = false;
  }

  private seedReferenceTicks(): void {
    for (const [token, ref] of Object.entries(FyersAdapter.REFERENCE_PRICES)) {
      const tick: MarketTick = {
        instrumentToken: token,
        exchange: token.startsWith('BSE') ? 'BSE' : token.startsWith('MCX') ? 'MCX' : 'NSE',
        symbol: token.replace(/^(NSE_|BSE_|MCX_)/, ''),
        ltp: ref.ltp,
        open: ref.open,
        high: ref.high,
        low: ref.low,
        close: ref.close,
        volume: 100000,
        change: Number((ref.ltp - ref.close).toFixed(2)),
        changePercent: Number((((ref.ltp - ref.close) / ref.close) * 100).toFixed(2)),
        bid: Number((ref.ltp - 0.05).toFixed(2)),
        ask: Number((ref.ltp + 0.05).toFixed(2)),
        bidQty: 100,
        askQty: 100,
        timestamp: Date.now(),
        source: 'fyers'
      };
      this.tickCache.set(token, tick);
    }
  }

  /**
   * Translates internal token (e.g. 'NSE_NIFTY50') to Fyers symbol ('NSE:NIFTY50-INDEX')
   */
  public tokenToFyersSymbol(token: string): string {
    if (FyersAdapter.SYMBOL_MAP[token]) {
      return FyersAdapter.SYMBOL_MAP[token];
    }
    if (token.startsWith('NSE_')) return `NSE:${token.replace('NSE_', '')}-EQ`;
    if (token.startsWith('BSE_')) return `BSE:${token.replace('BSE_', '')}-EQ`;
    if (token.startsWith('MCX_')) return `MCX:${token.replace('MCX_', '')}-COMM`;
    if (token.startsWith('NFO_')) {
      // e.g. NFO_NIFTY_24500_CE -> NSE:NIFTY...
      const parts = token.replace('NFO_', '').split('_');
      if (parts.length >= 3) {
        return `NSE:${parts[0]}${parts[1]}${parts[2]}`;
      }
    }
    return token;
  }

  /**
   * Translates Fyers symbol ('NSE:NIFTY50-INDEX') to internal token ('NSE_NIFTY50')
   */
  public fyersSymbolToToken(fyersSymbol: string): string {
    if (FyersAdapter.REVERSE_SYMBOL_MAP[fyersSymbol]) {
      return FyersAdapter.REVERSE_SYMBOL_MAP[fyersSymbol];
    }
    const clean = fyersSymbol.replace(':', '_').replace('-INDEX', '').replace('-EQ', '').replace('-COMM', '');
    return clean;
  }

  private reconnectAttempts = 0;

  /**
   * Connect to Fyers v3 Data WebSocket
   */
  private async connectWebSocket(): Promise<void> {
    if (!this.appId || !this.accessToken) {
      console.warn('[FyersAdapter] Cannot connect WebSocket: Missing AppId or Access Token');
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      try {
        this.ws.removeAllListeners();
        this.ws.close();
      } catch (_) {}
      this.ws = null;
    }

    try {
      const authHeader = `${this.appId}:${this.accessToken}`;
      console.log(`[FyersAdapter] Connecting to Fyers Data Socket: ${this.wsUrl}...`);

      this.ws = new WebSocket(this.wsUrl, {
        headers: {
          'Authorization': authHeader
        },
        timeout: 10000
      });

      this.ws.on('open', () => {
        console.log('[FyersAdapter] ✅ Connected to Fyers Data Socket WebSocket Server!');
        this.healthy = true;
        this.reconnectAttempts = 0;
        this.lastTickTime = Date.now();

        // Subscribe to initial default tokens
        const tokensToSubscribe = Array.from(this.subscribedTokens.size > 0 ? this.subscribedTokens : Object.keys(FyersAdapter.SYMBOL_MAP));
        this.sendSubscription(tokensToSubscribe);

        // Start ping heartbeat
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
              this.ws.ping();
            } catch (_) {}
          }
        }, 10000);
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        this.handleIncomingMessage(data);
      });

      this.ws.on('error', (err) => {
        console.error('[FyersAdapter] WebSocket Error:', err.message);
        this.healthy = false;
      });

      this.ws.on('close', (code, reason) => {
        this.healthy = false;
        if (this.heartbeatTimer) {
          clearInterval(this.heartbeatTimer);
          this.heartbeatTimer = null;
        }
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }

        const backoffDelay = Math.min(60000, 5000 * Math.pow(1.5, Math.min(this.reconnectAttempts++, 6)));
        console.warn(`[FyersAdapter] WebSocket closed (code=${code}, reason=${reason?.toString() || 'None'}). Reconnecting in ${(backoffDelay / 1000).toFixed(0)}s...`);
        this.reconnectTimer = setTimeout(() => {
          this.connectWebSocket();
        }, backoffDelay);
      });

    } catch (err: any) {
      console.error('[FyersAdapter] Failed creating WebSocket instance:', err.message);
      this.healthy = false;
    }
  }

  private sendSubscription(tokens: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const fyersSymbols = tokens.map(t => this.tokenToFyersSymbol(t));

    const subPayload = {
      T: 'SUB_DATA',
      SUB_T: 1,
      symbol: fyersSymbols,
      data_type: 'SymbolUpdate'
    };

    try {
      this.ws.send(JSON.stringify(subPayload));
      console.log(`[FyersAdapter] Subscribed to ${fyersSymbols.length} symbols on Fyers Data Socket.`);
    } catch (err: any) {
      console.error('[FyersAdapter] Error sending subscription:', err.message);
    }
  }

  private handleIncomingMessage(rawData: WebSocket.Data): void {
    try {
      this.lastTickTime = Date.now();

      let messageStr: string;
      if (typeof rawData === 'string') {
        messageStr = rawData;
      } else if (Buffer.isBuffer(rawData)) {
        messageStr = rawData.toString('utf8');
      } else {
        return;
      }

      // Check if message is JSON format
      if (messageStr.startsWith('{') || messageStr.startsWith('[')) {
        const parsed = JSON.parse(messageStr);
        this.processParsedPayload(parsed);
      }
    } catch (err: any) {
      // Binary or non-standard frame ignored gracefully
    }
  }

  private processParsedPayload(parsed: any): void {
    if (!parsed) return;

    // Handle single quote update or batch array
    const updates = Array.isArray(parsed) ? parsed : (parsed.d || [parsed]);

    for (const item of updates) {
      const symbol = item.symbol || item.n || item.v?.symbol;
      if (!symbol) continue;

      const val = item.v || item;
      const ltp = parseFloat(val.lp || val.ltp || val.last_price || '0');
      if (!ltp || isNaN(ltp)) continue;

      const token = this.fyersSymbolToToken(symbol);
      const open = parseFloat(val.open_price || val.open || ltp.toString());
      const high = parseFloat(val.high_price || val.high || ltp.toString());
      const low = parseFloat(val.low_price || val.low || ltp.toString());
      const prevClose = parseFloat(val.prev_close_price || val.close || ltp.toString());
      const change = parseFloat(val.ch || (ltp - prevClose).toFixed(2));
      const changePercent = parseFloat(val.chp || (((change) / (prevClose || 1)) * 100).toFixed(2));

      const tick: MarketTick = {
        instrumentToken: token,
        exchange: symbol.split(':')[0] || (token.startsWith('BSE') ? 'BSE' : token.startsWith('MCX') ? 'MCX' : 'NSE'),
        symbol: token.replace(/^(NSE_|BSE_|MCX_)/, ''),
        ltp,
        open,
        high,
        low,
        close: prevClose,
        volume: parseInt(val.volume || val.vol_traded_today || '1000', 10),
        change,
        changePercent,
        bid: parseFloat(val.bid || (ltp - 0.05).toFixed(2)),
        ask: parseFloat(val.ask || (ltp + 0.05).toFixed(2)),
        bidQty: parseInt(val.bidQty || '100', 10),
        askQty: parseInt(val.askQty || '100', 10),
        timestamp: Date.now(),
        source: 'fyers'
      };

      this.tickCache.set(token, tick);

      // Also set cache under aliases
      const aliases = SymbologyNormalizer.normalizeToken(token);
      for (const alias of aliases) {
        this.tickCache.set(alias, tick);
      }

      this.callbacks.forEach(cb => cb(tick));
    }
  }

  /**
   * Fallback & Off-market REST quote poller
   */
  private startPeriodicQuotePoll(): void {
    if (this.pollIntervalTimer) clearInterval(this.pollIntervalTimer);

    this.pollIntervalTimer = setInterval(async () => {
      // If we have live credentials, fetch batch quotes from REST API
      if (this.appId && this.accessToken) {
        try {
          const targetTokens = Array.from(this.subscribedTokens.size > 0 ? this.subscribedTokens : Object.keys(FyersAdapter.SYMBOL_MAP));
          const symbols = targetTokens.slice(0, 50).map(t => this.tokenToFyersSymbol(t)).join(',');

          const url = `${this.baseUrl}/data/quotes?symbols=${encodeURIComponent(symbols)}`;
          const res = await fetch(url, {
            headers: {
              'Authorization': `${this.appId}:${this.accessToken}`
            }
          });

          if (res.ok) {
            const data = await res.json();
            if (data.s === 'ok' && data.d) {
              this.processParsedPayload(data.d);
              this.healthy = true;
              return;
            }
          }
        } catch (_) {}
      }

      // NO SYNTHETIC TICK EMISSION.
      //
      // This block previously ran a random-walk price generator over hardcoded
      // REFERENCE_PRICES every 2 seconds whenever the real quote fetch failed, emitting
      // the results through the normal callback path tagged `source: 'fyers'`. Downstream
      // consumers — the option chain, RMS, P&L, the UI's LIVE badge — had no way to tell
      // those invented prices from real ones.
      //
      // When the provider cannot supply real quotes it is marked unhealthy and emits
      // nothing; MarketDataEngine.getFeedHealth() then reports STALE/DISCONNECTED and the
      // UI shows that honestly instead of animating fabricated price movement.
      this.healthy = false;
    }, 2000);
  }

  public subscribe(instrumentTokens: string[], callback: TickCallback): void {
    SafetyLock.assertSimulationOnly('FyersAdapter.subscribe');
    this.callbacks.add(callback);

    const newTokens: string[] = [];
    for (const token of instrumentTokens) {
      if (!this.subscribedTokens.has(token)) {
        this.subscribedTokens.add(token);
        newTokens.push(token);
      }
    }

    if (newTokens.length > 0) {
      this.sendSubscription(newTokens);
    }
  }

  public unsubscribe(instrumentTokens: string[]): void {
    for (const token of instrumentTokens) {
      this.subscribedTokens.delete(token);
    }
  }

  public async getQuote(instrumentToken: string): Promise<MarketTick | null> {
    SafetyLock.assertSimulationOnly('FyersAdapter.getQuote');

    const cached = this.tickCache.get(instrumentToken);
    if (cached) return cached;

    if (this.appId && this.accessToken) {
      try {
        const symbol = this.tokenToFyersSymbol(instrumentToken);
        const url = `${this.baseUrl}/data/quotes?symbols=${encodeURIComponent(symbol)}`;
        const res = await fetch(url, {
          headers: {
            'Authorization': `${this.appId}:${this.accessToken}`
          }
        });

        if (res.ok) {
          const data = await res.json();
          if (data.s === 'ok' && data.d && data.d[0]) {
            this.processParsedPayload([data.d[0]]);
            return this.tickCache.get(instrumentToken) || null;
          }
        }
      } catch (err: any) {
        console.warn(`[FyersAdapter] Error fetching quote for ${instrumentToken}:`, err.message);
      }
    }

    const ref = FyersAdapter.REFERENCE_PRICES[instrumentToken];
    if (ref) {
      const tick: MarketTick = {
        instrumentToken,
        exchange: instrumentToken.startsWith('BSE') ? 'BSE' : instrumentToken.startsWith('MCX') ? 'MCX' : 'NSE',
        symbol: instrumentToken.replace(/^(NSE_|BSE_|MCX_)/, ''),
        ltp: ref.ltp,
        open: ref.open,
        high: ref.high,
        low: ref.low,
        close: ref.close,
        volume: 25000,
        change: Number((ref.ltp - ref.close).toFixed(2)),
        changePercent: Number((((ref.ltp - ref.close) / ref.close) * 100).toFixed(2)),
        bid: Number((ref.ltp - 0.05).toFixed(2)),
        ask: Number((ref.ltp + 0.05).toFixed(2)),
        bidQty: 100,
        askQty: 100,
        timestamp: Date.now(),
        source: 'fyers'
      };
      this.tickCache.set(instrumentToken, tick);
      return tick;
    }

    return null;
  }

  public async getHistoricalCandles(instrumentToken: string, timeframe: string, count: number = 100): Promise<Candle[]> {
    SafetyLock.assertSimulationOnly('FyersAdapter.getHistoricalCandles');

    const quote = await this.getQuote(instrumentToken);
    const anchorLtp = quote ? quote.ltp : 24500.0;

    // If live Fyers credentials present, try fetching real historical data
    if (this.appId && this.accessToken) {
      try {
        const symbol = this.tokenToFyersSymbol(instrumentToken);
        const resolution = timeframe === '1m' ? '1' : timeframe === '5m' ? '5' : timeframe === '15m' ? '15' : timeframe === '1h' ? '60' : '1D';

        const rangeTo = new Date().toISOString().slice(0, 10);
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - (timeframe === '1D' ? count * 1.5 : 10));
        const rangeFrom = fromDate.toISOString().slice(0, 10);

        const url = `${this.baseUrl}/data/history?symbol=${encodeURIComponent(symbol)}&resolution=${resolution}&date_format=1&range_from=${rangeFrom}&range_to=${rangeTo}&cont_flag=1`;
        const res = await fetch(url, {
          headers: {
            'Authorization': `${this.appId}:${this.accessToken}`
          }
        });

        if (res.ok) {
          const data = await res.json();
          if (data.s === 'ok' && Array.isArray(data.candles) && data.candles.length > 0) {
            return data.candles.slice(-count).map((c: any[]) => ({
              time: c[0],
              open: c[1],
              high: c[2],
              low: c[3],
              close: c[4],
              volume: c[5]
            }));
          }
        }
      } catch (err: any) {
        console.warn(`[FyersAdapter] Real history fetch error for ${instrumentToken}:`, err.message);
      }
    }

    // NO SYNTHETIC FALLBACK — see the equivalent note in DhanAdapter.getHistoricalCandles().
    // Random-walk candles "anchored to live LTP" still constitute invented price history:
    // every open/high/low and every volume figure was fabricated, and nothing downstream
    // could distinguish them from real exchange data.
    console.warn(`[FyersAdapter] No historical candles available for ${instrumentToken} (${timeframe}); returning empty series.`);
    return [];
  }

  public async getOptionChain(symbol: string, expiry: string): Promise<OptionChainItem[]> {
    SafetyLock.assertSimulationOnly('FyersAdapter.getOptionChain');

    let spotPrice = 24595.55;
    const quote = await this.getQuote(`NSE_${symbol.toUpperCase()}`);
    if (quote) {
      spotPrice = quote.ltp;
    } else if (symbol.includes('BANK')) {
      spotPrice = 57785.80;
    } else if (symbol.includes('SENSEX')) {
      spotPrice = 80599.78;
    }

    const res = await OptionChainEngine.generateOptionChain({ symbol, spotPrice, expiry });
    return res.chain;
  }

  // EXPLICIT SAFETY BARRIER
  public placeBrokerOrder(): void {
    SafetyLock.assertSimulationOnly('FyersAdapter.placeBrokerOrder');
    throw new Error('REAL-MONEY TRADING IS DISABLED. Real broker order placement is forbidden.');
  }
}
