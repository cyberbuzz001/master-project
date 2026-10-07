import { IMarketDataProvider } from './IMarketDataProvider';
import { AngelOneAdapter } from './AngelOneAdapter';
import { DhanAdapter } from './DhanAdapter';
import { FyersAdapter } from './FyersAdapter';
import { MockMarketDataProvider } from './MockMarketDataProvider';
import { MarketTick, Candle, OptionChainItem, TickCallback } from './types';
import { redis } from '../db/redis';
import { generateUUID } from '../utils/crypto';

export class MarketDataEngine {
  private static instance: MarketDataEngine;
  private instanceId: string = generateUUID();
  private providers: Map<string, IMarketDataProvider> = new Map();
  private activeProvider: IMarketDataProvider;
  private dhanProvider: DhanAdapter;
  private fyersProvider: FyersAdapter;
  private angelOneProvider: AngelOneAdapter;
  private mockProvider: MockMarketDataProvider;

  private tickCache: Map<string, MarketTick> = new Map();
  private globalCallbacks: Set<TickCallback> = new Set();
  private subscribedTokens: Set<string> = new Set();

  // ── Auto-Failover Telemetry & State ──────────────────────────────────────
  private lastDhanTickTime: number = 0;
  private failoverActive: boolean = false;
  private failoverTimer: NodeJS.Timeout | null = null;
  private configuredProviderName: string = 'DHAN';

  private constructor() {
    this.mockProvider = new MockMarketDataProvider();
    this.angelOneProvider = new AngelOneAdapter();
    this.dhanProvider = new DhanAdapter();
    this.fyersProvider = new FyersAdapter();

    this.providers.set(this.dhanProvider.name, this.dhanProvider);
    this.providers.set('DHAN', this.dhanProvider);

    this.configuredProviderName = 'DHAN';
    this.activeProvider = this.dhanProvider;

    // Subscribe to Redis pub/sub for tick broadcasts only in multi-node cluster deployments
    if (process.env.CLUSTER_MODE === 'true') {
      redis.subscribe('market:ticks', (msg: string) => {
        try {
          const payload: any = JSON.parse(msg);
          // Ignore self-published frames to avoid double fan-out loop
          if (payload._origin && payload._origin === this.instanceId) return;

          const tick: MarketTick = payload;
          this.setCachedTick(tick);
          this.globalCallbacks.forEach(cb => cb(tick));
        } catch (_) {}
      });
    }
  }

  public static getInstance(): MarketDataEngine {
    if (!MarketDataEngine.instance) {
      MarketDataEngine.instance = new MarketDataEngine();
    }
    return MarketDataEngine.instance;
  }

  /**
   * Evaluates if current time is within Indian Market hours:
   * - EQUITY: 9:15 AM - 3:30 PM IST (Mon-Fri)
   * - COMMODITY / MCX: 9:00 AM - 11:30 PM IST (Mon-Fri)
   */
  public static isMarketHours(segment: 'EQUITY' | 'COMMODITY' | string = 'EQUITY'): boolean {
    const now = new Date();
    const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
    const istDate = new Date(utcMs + (330 * 60000));

    const day = istDate.getDay(); // 0 = Sun, 6 = Sat
    if (day === 0 || day === 6) return false; // Weekend

    const hours = istDate.getHours();
    const minutes = istDate.getMinutes();
    const timeInMins = hours * 60 + minutes;

    const seg = (segment || 'EQUITY').toUpperCase();
    if (seg === 'COMMODITY' || seg === 'MCX' || seg === 'MCX_COMM') {
      // 9:00 AM = 540 mins, 11:30 PM = 1410 mins (extended to 11:55 PM / 1435 during US DST)
      return timeInMins >= 540 && timeInMins <= 1435;
    }

    // 9:15 AM = 555 mins, 3:30 PM = 930 mins
    return timeInMins >= 555 && timeInMins <= 930;
  }

  public async initialize(): Promise<void> {
    this.configuredProviderName = 'DHAN';
    console.log(`[MarketDataEngine] 🚀 Initializing Market Data Engine (Dhan HQ API v2 Exclusive)...`);

    const defaultTokens = [
      'NSE_NIFTY50', 'NSE_BANKNIFTY', 'BSE_SENSEX', 'NSE_FINNIFTY', 'NSE_MIDCPNIFTY',
      'NSE_RELIANCE', 'NSE_TCS', 'NSE_INFY', 'NSE_HDFCBANK', 'NSE_ICICIBANK', 'NSE_TATAMOTORS',
      'MCX_CRUDEOIL', 'MCX_GOLD', 'MCX_SILVER', 'MCX_NATURALGAS', 'MCX_COPPER', 'MCX_GOLDM', 'MCX_SILVERM',
    ];

    defaultTokens.forEach(t => this.subscribedTokens.add(t));

    // Hydrate local cache from persistent Redis tick store
    try {
      for (const tok of defaultTokens) {
        const cachedRaw = await redis.get(`tick:${tok}`);
        if (cachedRaw) {
          const tick: MarketTick = JSON.parse(cachedRaw);
          if (tick && tick.ltp > 0) {
            this.setCachedTick(tick);
          }
        }
      }
    } catch (_) {}

    // Connect ONLY to Dhan HQ API v2 broker feed (NO MOCK, NO FALLBACK)
    try {
      const { setDhanAdapterRef } = require('../utils/dhanTokenRefresh');
      setDhanAdapterRef(this.dhanProvider);

      // Register tick callback BEFORE initialize() so pre-seeded quotes immediately populate cache
      this.dhanProvider.subscribe(Array.from(this.subscribedTokens), (tick) => {
        this.lastDhanTickTime = Date.now();
        this.failoverActive = false;
        this.broadcastTick(tick);
      });

      await this.dhanProvider.initialize();

      // Seed any quotes received during Dhan initialization into cache & Redis
      for (const tick of this.dhanProvider.getAllCachedTicks()) {
        this.broadcastTick(tick);
      }
    } catch (err: any) {
      console.warn('[MarketDataEngine] Dhan initialization warning:', err.message);
    }
    this.activeProvider = this.dhanProvider;

    console.log(`[MarketDataEngine] ✅ Engine Ready | Active: DHAN (Exclusive Live Feed) | Tokens: ${this.subscribedTokens.size} | Cached: ${this.tickCache.size}`);
  }

  private handleFallbackTick(_tick: MarketTick): void {
    // Disabled: Strictly Dhan live market prices only (zero fallback pricing).
    return;
  }

  private startFailoverMonitor(): void {
    // Disabled: Strictly Dhan live market prices only.
    if (this.failoverTimer) {
      clearInterval(this.failoverTimer);
      this.failoverTimer = null;
    }
  }

  private lastRedisWriteByToken: Map<string, number> = new Map();

  /**
   * Broadcasts tick to local cache, Redis circular buffer, and all client WebSocket listeners.
   * Dispatches immediately to local in-memory subscribers (0ms latency), and throttles
   * Redis pipeline writes to 250ms per token to prevent TCP socket buffer saturation and memory leaks.
   */
  private broadcastTick(tick: MarketTick): void {
    this.setCachedTick(tick);
    this.globalCallbacks.forEach(cb => cb(tick));

    const now = Date.now();
    const lastWrite = this.lastRedisWriteByToken.get(tick.instrumentToken) || 0;
    if (now - lastWrite >= 250) {
      this.lastRedisWriteByToken.set(tick.instrumentToken, now);
      redis.set(`tick:${tick.instrumentToken}`, JSON.stringify(tick), 3600).catch(() => {});
      redis.rpushTrim(
        `market:ticks:${tick.instrumentToken}`,
        JSON.stringify({
          ltp: tick.ltp,
          timestamp: tick.timestamp || now,
          volume: tick.volume,
          open: tick.open,
          high: tick.high,
          low: tick.low,
          close: tick.close
        }),
        500
      ).catch(() => {});

      if (process.env.CLUSTER_MODE === 'true') {
        redis.publish('market:ticks', JSON.stringify({ ...tick, _origin: this.instanceId })).catch(() => {});
      }
    }
  }

  /**
   * Retrieves buffered tick history from Redis circular list
   */
  public async getTickHistory(token: string, limit = 500): Promise<Array<{ ltp: number; timestamp: number; volume?: number; open?: number; high?: number; low?: number; close?: number }>> {
    if (!token) return [];
    try {
      const rawList = await redis.lrange(`market:ticks:${token}`, -Math.min(limit, 1000), -1);
      return rawList.map(item => {
        try {
          return JSON.parse(item);
        } catch {
          return null;
        }
      }).filter(Boolean);
    } catch {
      return [];
    }
  }

  public getDhanAdapter(): DhanAdapter {
    return this.dhanProvider;
  }

  public getActiveProviderName(): string {
    return this.activeProvider ? this.activeProvider.name : 'DHAN';
  }

  public getHybridStatus(): Record<string, any> {
    const now = Date.now();
    return {
      mode: 'DHAN_ONLY',
      primaryLiveStream: 'DHAN',
      historicalCandlesProvider: 'DHAN',
      optionGreeksProvider: 'DHAN / OptionChainEngine',
      failoverActive: false,
      lastDhanTickMsAgo: this.lastDhanTickTime > 0 ? now - this.lastDhanTickTime : -1,
      subscribedTokenCount: this.subscribedTokens.size
    };
  }

  public getFeedHealth(): Record<string, any> {
    const now = Date.now();
    const marketOpen = MarketDataEngine.isMarketHours();
    const quietMs = this.lastDhanTickTime > 0 ? (now - this.lastDhanTickTime) : Infinity;

    let status: 'LIVE' | 'STALE' | 'CLOSED' | 'DISCONNECTED' = 'DISCONNECTED';
    if (!marketOpen) {
      status = 'CLOSED';
    } else if (quietMs <= 15000) {
      status = 'LIVE';
    } else if (quietMs < 60000) {
      status = 'STALE';
    } else {
      status = 'DISCONNECTED';
    }

    return {
      ...this.getHybridStatus(),
      status,
      marketOpen,
      provider: 'DHAN'
    };
  }

  public getPipelineMetrics(): Record<string, any> {
    return {
      activeProvider: this.getActiveProviderName(),
      cachedTicksCount: this.tickCache.size,
      subscribedTokensCount: this.subscribedTokens.size,
      providerConnections: 1,
      refCountedTokens: this.subscribedTokens.size,
      failoverActive: this.failoverActive
    };
  }

  public async switchPrimaryProvider(providerName: string): Promise<boolean> {
    const targetName = providerName.toUpperCase();
    const provider = this.providers.get(targetName) || this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Market Data Provider '${providerName}' is not recognized.`);
    }

    console.log(`[MarketDataEngine] 🔄 Switching Primary Provider to '${provider.name}'`);
    this.configuredProviderName = targetName;
    this.activeProvider = provider;
    this.failoverActive = (targetName === 'MOCK' || targetName === 'MOCK_ENGINE');
    process.env.PRIMARY_MARKET_DATA_PROVIDER = targetName;

    try {
      if (typeof provider.initialize === 'function') {
        await provider.initialize();
      }
      provider.subscribe(Array.from(this.subscribedTokens), (tick: MarketTick) => {
        if (targetName === 'DHAN') this.lastDhanTickTime = Date.now();
        this.broadcastTick(tick);
      });
    } catch (err: any) {
      console.warn(`[MarketDataEngine] Warning when switching to ${targetName}:`, err.message);
    }

    return true;
  }

  public updateProviderCredentials(keys: Record<string, string>): void {
    if (keys.FYERS_APP_ID) process.env.FYERS_APP_ID = keys.FYERS_APP_ID;
    if (keys.FYERS_SECRET_KEY) process.env.FYERS_SECRET_KEY = keys.FYERS_SECRET_KEY;
    if (keys.FYERS_TOTP_SECRET) process.env.FYERS_TOTP_SECRET = keys.FYERS_TOTP_SECRET;
    if (keys.FYERS_PIN) process.env.FYERS_PIN = keys.FYERS_PIN;
    if (keys.FYERS_CLIENT_ID) process.env.FYERS_CLIENT_ID = keys.FYERS_CLIENT_ID;
    if (keys.FYERS_ACCESS_TOKEN) process.env.FYERS_ACCESS_TOKEN = keys.FYERS_ACCESS_TOKEN;
    if (keys.FYERS_REDIRECT_URI) process.env.FYERS_REDIRECT_URI = keys.FYERS_REDIRECT_URI;

    if (keys.ANGELONE_API_KEY) {
      process.env.ANGELONE_API_KEY = keys.ANGELONE_API_KEY;
      process.env.SMARTAPI_API_KEY = keys.ANGELONE_API_KEY;
    }
    if (keys.ANGELONE_CLIENT_ID) {
      process.env.ANGELONE_CLIENT_ID = keys.ANGELONE_CLIENT_ID;
      process.env.SMARTAPI_CLIENT_CODE = keys.ANGELONE_CLIENT_ID;
    }
    if (keys.ANGELONE_CLIENT_SECRET) {
      process.env.ANGELONE_CLIENT_SECRET = keys.ANGELONE_CLIENT_SECRET;
      process.env.SMARTAPI_PASSWORD = keys.ANGELONE_CLIENT_SECRET;
    }
    if (keys.ANGELONE_TOTP_SECRET) {
      process.env.ANGELONE_TOTP_SECRET = keys.ANGELONE_TOTP_SECRET;
      process.env.SMARTAPI_TOTP_SECRET = keys.ANGELONE_TOTP_SECRET;
    }

    if (keys.DHAN_CLIENT_ID) process.env.DHAN_CLIENT_ID = keys.DHAN_CLIENT_ID;
    if (keys.DHAN_TOTP_SECRET) process.env.DHAN_TOTP_SECRET = keys.DHAN_TOTP_SECRET;
    if (keys.DHAN_PIN) process.env.DHAN_PIN = keys.DHAN_PIN;
    if (keys.DHAN_ACCESS_TOKEN) process.env.DHAN_ACCESS_TOKEN = keys.DHAN_ACCESS_TOKEN;
    if (keys.DHAN_API_KEY) process.env.DHAN_API_KEY = keys.DHAN_API_KEY;
    if (keys.DHAN_API_SECRET) process.env.DHAN_API_SECRET = keys.DHAN_API_SECRET;
  }

  public setCachedTick(tick: MarketTick): void {
    if (!tick || !tick.instrumentToken) return;
    const existing = this.tickCache.get(tick.instrumentToken);
    if (existing && existing.timestamp && tick.timestamp && tick.timestamp < existing.timestamp) {
      return; // Reject out-of-order stale tick
    }
    this.tickCache.set(tick.instrumentToken, tick);
    try {
      const { SymbologyNormalizer } = require('./SymbologyNormalizer');
      const aliases = SymbologyNormalizer.normalizeToken(tick.instrumentToken);
      for (const alias of aliases) {
        this.tickCache.set(alias, tick);
      }
    } catch (_) {}
  }

  public getCachedTick(instrumentToken: string): MarketTick | undefined {
    if (!instrumentToken) return undefined;
    const direct = this.tickCache.get(instrumentToken);
    if (direct) return direct;

    try {
      const { SymbologyNormalizer } = require('./SymbologyNormalizer');
      const aliases = SymbologyNormalizer.normalizeToken(instrumentToken);
      for (const alias of aliases) {
        const match = this.tickCache.get(alias);
        if (match) return match;
      }
    } catch (_) {}
    return undefined;
  }

  public async getQuote(instrumentToken: string): Promise<MarketTick | null> {
    const cached = this.getCachedTick(instrumentToken);
    if (cached) return cached;

    try {
      const tick = await this.dhanProvider.getQuote(instrumentToken);
      if (tick) {
        this.setCachedTick(tick);
        return tick;
      }
    } catch (_) {}

    return null;
  }

  public getAllCachedTicks(): MarketTick[] {
    return Array.from(this.tickCache.values());
  }

  public subscribe(tokens: string[]): void {
    if (!tokens || tokens.length === 0) return;
    tokens.forEach(t => this.subscribedTokens.add(t));

    try {
      this.dhanProvider.subscribe(tokens, (tick: MarketTick) => {
        this.lastDhanTickTime = Date.now();
        this.broadcastTick(tick);
      });
    } catch (_) {}
  }

  public unsubscribe(tokens: string[]): void {
    if (!tokens || tokens.length === 0) return;
    tokens.forEach(t => this.subscribedTokens.delete(t));
    try {
      this.dhanProvider.unsubscribe(tokens);
    } catch (_) {}
  }

  public onTick(callback: TickCallback): void {
    this.globalCallbacks.add(callback);
  }

  /**
   * Historical Candles — Dhan HQ API exclusive (no synthetic/mock fallback)
   */
  public async getHistoricalCandles(instrumentToken: string, timeframe: string, count: number): Promise<Candle[]> {
    try {
      const candles = await this.dhanProvider.getHistoricalCandles(instrumentToken, timeframe, count);
      if (candles && candles.length > 0) return candles;
    } catch (_) {}
    return [];
  }

  /**
   * Option Chain — Dhan HQ API exclusive (no synthetic/mock fallback)
   */
  public async getOptionChain(symbol: string, expiry: string): Promise<OptionChainItem[]> {
    try {
      const chain = await this.dhanProvider.getOptionChain(symbol, expiry);
      if (chain && chain.length > 0) return chain;
    } catch (_) {}
    return [];
  }

  public getOptionExpiries(symbol: string): string[] {
    const dhanProvider = this.dhanProvider as any;
    if (typeof dhanProvider.getOptionExpiries === 'function') {
      return dhanProvider.getOptionExpiries(symbol);
    }
    return [];
  }
}
