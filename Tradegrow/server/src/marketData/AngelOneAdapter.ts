import { IMarketDataProvider } from './IMarketDataProvider';
import { MarketTick, Candle, OptionChainItem, TickCallback } from './types';
import { SafetyLock } from '../services/SafetyLock';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { OptionChainEngine } from './OptionChainEngine';
import { GreeksEngine } from './GreeksEngine';
import { nseOptionChainService } from './NseOptionChainService';

export class AngelOneAdapter implements IMarketDataProvider {
  public readonly name = 'ANGEL_ONE';
  private healthy = false;
  private childProc: ChildProcess | null = null;
  private chainProc: ChildProcess | null = null;
  private timer: NodeJS.Timeout | null = null;
  private chainTimer: NodeJS.Timeout | null = null;
  private callbacks: Set<TickCallback> = new Set();
  private tickCache: Map<string, MarketTick> = new Map();

  private optionChainData: any = null;
  private chainFilePath: string = '';
  private lastTickTime: number = 0;

  public isHealthy(): boolean {
    return this.healthy && this.lastTickTime > 0 && (Date.now() - this.lastTickTime < 15000);
  }

  public async initialize(): Promise<void> {
    console.log('[AngelOneAdapter] Initializing Angel One adapter (non-blocking startup)...');
    SafetyLock.assertSimulationOnly('AngelOneAdapter.initialize');

    setImmediate(() => {
      this.startServices();
    });
  }

  private startServices(): void {

    // ── Locate scripts & data files ──────────────────────────────────────
    let tickerScript = path.resolve(__dirname, 'angel_ticker.py');
    if (!fs.existsSync(tickerScript)) {
      tickerScript = path.resolve(__dirname, '../../src/marketData/angel_ticker.py');
    }
    let chainScript = path.resolve(__dirname, 'angel_option_chain.py');
    if (!fs.existsSync(chainScript)) {
      chainScript = path.resolve(__dirname, '../../src/marketData/angel_option_chain.py');
    }

    // Resolve angel_ticks.json path dynamically across multiple locations
    const possibleTicksPaths = [
      path.resolve(process.cwd(), 'server/data/angel_ticks.json'),
      path.resolve(__dirname, '../../server/data/angel_ticks.json'),
      path.resolve(__dirname, '../../data/angel_ticks.json'),
      path.resolve(__dirname, '../data/angel_ticks.json'),
    ];

    // Resolve angel_option_chain.json path dynamically across multiple locations
    const possibleChainPaths = [
      path.resolve(process.cwd(), 'server/data/angel_option_chain.json'),
      path.resolve(__dirname, '../../server/data/angel_option_chain.json'),
      path.resolve(__dirname, '../../data/angel_option_chain.json'),
      path.resolve(__dirname, '../data/angel_option_chain.json'),
    ];
    this.chainFilePath = possibleChainPaths.find(p => fs.existsSync(p)) || possibleChainPaths[0];
    try {
      fs.mkdirSync(path.dirname(this.chainFilePath), { recursive: true });
    } catch (_) {}

    const pythonCmd = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');

    // Resolve ticks file path once
    const ticksFilePath = possibleTicksPaths.find(p => fs.existsSync(p)) || possibleTicksPaths[0];

    try {
      // ── Spawn live price ticker ──────────────────────────────────────
      const hasAngelCreds = process.env.ANGEL_ONE_API_KEY || process.env.SMARTAPI_API_KEY;
      if (hasAngelCreds && fs.existsSync(tickerScript)) {
        this.childProc = spawn(pythonCmd, [tickerScript], { env: { ...process.env }, stdio: 'inherit' });
        this.childProc.on('error', (err) => {
          console.warn('[AngelOneAdapter] Ticker process error:', err.message);
          this.healthy = false;
        });
        this.healthy = true;
      } else {
        console.log('[AngelOneAdapter] Angel One credentials not configured or script missing. Standing by.');
        this.healthy = true;
      }

      // Poll angel_ticks.json for real-time Angel One quotes (500ms for 2 updates/sec)
      this.timer = setInterval(async () => {
        try {
          if (fs.existsSync(ticksFilePath)) {
            const raw = await fs.promises.readFile(ticksFilePath, 'utf-8');
            if (raw) {
              const data = JSON.parse(raw);
              const entries = Object.entries<MarketTick>(data);
              if (entries.length > 0) {
                this.lastTickTime = Date.now();
                this.healthy = true;
                for (const [token, tick] of entries) {
                  this.tickCache.set(token, tick);
                  this.callbacks.forEach(cb => cb(tick));
                }
              }
            }
          }
        } catch (_) {}
      }, 500);

      // ── Spawn option chain WebSocket fetcher (angel_option_ws.py) ─────────
      const wsChainScript = fs.existsSync(path.resolve(__dirname, 'angel_option_ws.py'))
        ? path.resolve(__dirname, 'angel_option_ws.py')
        : path.resolve(__dirname, '../../src/marketData/angel_option_ws.py');

      const spawnChainScript = () => {
        if (!hasAngelCreds) {
          console.log('[AngelOneAdapter] Angel One credentials not present — Option Chain WS running in standby mode.');
          return;
        }
        if (fs.existsSync(wsChainScript)) {
          console.log('[AngelOneAdapter] Spawning Option Chain WebSocket process (SmartWebSocketV2)...');
          this.chainProc = spawn(pythonCmd, [wsChainScript], { env: { ...process.env }, stdio: 'inherit' });
          this.chainProc.on('error', (err) => {
            console.warn('[AngelOneAdapter] Option chain WS process error:', err.message);
          });
        } else {
          console.warn('[AngelOneAdapter] angel_option_ws.py not found — no live option chain');
        }
      };

      // Delay 15s so ticker auth completes first (Angel One rate-limits concurrent logins)
      setTimeout(spawnChainScript, 15000);

      // Poll angel_option_chain.json every 500ms (2x per second)
      this.chainTimer = setInterval(async () => {
        if (fs.existsSync(this.chainFilePath)) {
          try {
            const raw = await fs.promises.readFile(this.chainFilePath, 'utf-8');
            if (raw) {
              const parsed = JSON.parse(raw);
              this.optionChainData = parsed;
              this.processOptionChainTicks(parsed);
            }
          } catch (_) {}
        }
      }, 500);

      // ── Start NSE OI fetcher (OI, PCR, Max Pain every 60s) ─────────────
      nseOptionChainService.start();

    } catch (err: any) {
      console.error('[AngelOneAdapter] Failed to spawn Angel ticker process:', err.message);
      this.healthy = false;
    }
  }

  public subscribe(instrumentTokens: string[], callback: TickCallback): void {
    SafetyLock.assertSimulationOnly('AngelOneAdapter.subscribe');
    this.callbacks.add(callback);
  }

  public unsubscribe(instrumentTokens: string[]): void {
    // Unsubscribe logic
  }

  public async getQuote(instrumentToken: string): Promise<MarketTick | null> {
    return this.tickCache.get(instrumentToken) || null;
  }

  public async getHistoricalCandles(instrumentToken: string, timeframe: string, count: number): Promise<Candle[]> {
    SafetyLock.assertSimulationOnly('AngelOneAdapter.getHistoricalCandles');

    // CRITICAL: Snapshot the live tick LTP right now — the last candle's close
    // must equal this exact value so it connects seamlessly to the live WebSocket tick.
    const tick = this.tickCache.get(instrumentToken);
    const anchorLtp = tick ? tick.ltp : 1000.0;
    const volatility = anchorLtp * 0.0008; // 0.08% per candle — realistic noise

    const candles: Candle[] = [];
    const now = Math.floor(Date.now() / 1000);
    const intervalSeconds = timeframe === '1m' ? 60 : timeframe === '5m' ? 300 :
                            timeframe === '15m' ? 900 : timeframe === '1h' ? 3600 : 86400;

    // Walk BACKWARDS from anchorLtp so the last candle close == anchorLtp exactly
    let currentClose = anchorLtp;
    for (let i = count; i >= 0; i--) {
      const candleTime = now - (i * intervalSeconds);
      const isLast = (i === 0);

      const close = isLast ? anchorLtp : Number(currentClose.toFixed(2));
      const openDelta = (Math.random() - 0.49) * volatility * 2;
      const open = isLast
        ? Number((anchorLtp - (Math.random() * volatility)).toFixed(2))
        : Number((close - openDelta).toFixed(2));

      const high = Number((Math.max(open, close) + Math.random() * volatility).toFixed(2));
      const low  = Number((Math.min(open, close) - Math.random() * volatility).toFixed(2));
      const volume = Math.floor(Math.random() * 50000) + 1000;

      candles.push({ time: candleTime, open, high, low, close, volume });
      currentClose = open; // walk backwards: next iteration's close = this open
    }

    return candles; // chronological, last close == anchorLtp
  }

  public async getOptionChain(symbol: string, expiry: string): Promise<OptionChainItem[]> {
    SafetyLock.assertSimulationOnly('AngelOneAdapter.getOptionChain');

    const sym = (symbol || 'NIFTY').toUpperCase();
    const niftyTick  = this.tickCache.get('NSE_NIFTY50');
    const bankTick   = this.tickCache.get('NSE_BANKNIFTY');
    const sensexTick = this.tickCache.get('BSE_SENSEX');
    const finTick    = this.tickCache.get('NSE_FINNIFTY');
    const spotPrice  = (sym.includes('SENSEX') || sym.includes('BSX'))
      ? (sensexTick?.ltp  || 78710)
      : sym.includes('BANK')
      ? (bankTick?.ltp    || 52000)
      : sym.includes('FIN')
      ? (finTick?.ltp     || 23500)
      : (niftyTick?.ltp   || 24500);

    // ── If live option chain data is available, use it ──────────────────────
    if (this.optionChainData?.chains?.[sym]?.[expiry]) {
      const chainData = this.optionChainData.chains[sym][expiry];
      const spot = chainData.spot || spotPrice;
      const rows: OptionChainItem[] = [];
      const nseSummary = nseOptionChainService.getSummary(sym);

      for (const row of chainData.rows) {
        const strike = row.strikePrice;
        const timeToExpiry = Math.max(1, Math.ceil(
          (new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )) / 365.0;

        // Merge NSE OI & IV if available (refreshed every 60s)
        const nseData = nseSummary ? nseOptionChainService.getOiForStrike(sym, strike) : null;

        // Use NSE IV when available (more accurate), fallback to smile approximation
        const step = sym === 'SENSEX' ? 100 : 50;
        const ceIv = (nseData?.ceIv && nseData.ceIv > 0) ? nseData.ceIv : (sym === 'SENSEX' ? 21.0 : 14.5) + Math.abs(strike - Math.round(spot / step) * step) / step * 0.2;
        const peIv = (nseData?.peIv && nseData.peIv > 0) ? nseData.peIv : ceIv + 0.5;

        const ceGreeks = GreeksEngine.calculateGreeks(spot, strike, timeToExpiry, true,  ceIv / 100);
        const peGreeks = GreeksEngine.calculateGreeks(spot, strike, timeToExpiry, false, peIv / 100);

        const ceBsPrice = GreeksEngine.calculateOptionPrice(spot, strike, timeToExpiry, true,  ceIv / 100);
        const peBsPrice = GreeksEngine.calculateOptionPrice(spot, strike, timeToExpiry, false, peIv / 100);

        const ceLtp = (row.ce?.ltp && row.ce.ltp > 0) ? row.ce.ltp : Math.max(0.05, Number(ceBsPrice.toFixed(2)));
        const peLtp = (row.pe?.ltp && row.pe.ltp > 0) ? row.pe.ltp : Math.max(0.05, Number(peBsPrice.toFixed(2)));

        // OI / volume come from NSE, else the live WS field, else 0.
        // Randomised OI and volume were previously invented here — traders read OI and
        // volume as conviction signals, so fabricating them is actively misleading.
        // 0 renders as "--" in the UI, which is truthful about the data being unavailable.
        const ceOi = nseData?.ceOi || row.ce?.oi || 0;
        const peOi = nseData?.peOi || row.pe?.oi || 0;
        const ceVol = row.ce?.volume || 0;
        const peVol = row.pe?.volume || 0;

        rows.push({
          strikePrice: strike,
          expiry,
          ce: {
            instrumentToken: row.ce?.token || `${sym === 'SENSEX' ? 'BFO' : 'NFO'}_${sym}_${strike}_CE`,
            ltp:   ceLtp,
            change: row.ce?.change || 0,
            volume: ceVol,
            openInterest: ceOi,
            iv:    ceGreeks.iv,
            delta: ceGreeks.delta,
            gamma: ceGreeks.gamma,
            theta: ceGreeks.theta,
            vega:  ceGreeks.vega,
          },
          pe: {
            instrumentToken: row.pe?.token || `${sym === 'SENSEX' ? 'BFO' : 'NFO'}_${sym}_${strike}_PE`,
            ltp:   peLtp,
            change: row.pe?.change || 0,
            volume: peVol,
            openInterest: peOi,
            iv:    peGreeks.iv,
            delta: peGreeks.delta,
            gamma: peGreeks.gamma,
            theta: peGreeks.theta,
            vega:  peGreeks.vega,
          },
        });
      }

      if (rows.length > 0) return rows;
    }

    const res = await OptionChainEngine.generateOptionChain({ symbol: sym, spotPrice, expiry });
    return res.chain;
  }


  /** Returns real expiry dates from Instrument Master for a given symbol */

  public getOptionExpiries(symbol: string): string[] {
    const sym = (symbol || 'NIFTY').toUpperCase();
    const expiries: string[] = this.optionChainData?.expiries?.[sym] || [];
    // If no real data yet, return synthetic weekly expiries
    if (expiries.length === 0) {
      const dates: string[] = [];
      const base = new Date();
      for (let w = 0; w < 5; w++) {
        const d = new Date(base);
        d.setDate(d.getDate() + (7 - d.getDay() + 4) % 7 + w * 7); // next Thursday
        dates.push(d.toISOString().slice(0, 10));
      }
      return dates;
    }
    return expiries;
  }

  // EXPLICIT SAFETY BARRIER
  public placeBrokerOrder(): void {
    SafetyLock.assertSimulationOnly('AngelOneAdapter.placeBrokerOrder');
    throw new Error('REAL-MONEY TRADING IS DISABLED. Real broker order placement is forbidden.');
  }

  private processOptionChainTicks(chainData: any): void {
    if (!chainData?.chains) return;
    const ts = chainData.updatedAt || Date.now();

    for (const [sym, expiries] of Object.entries<any>(chainData.chains)) {
      for (const [exp, expObj] of Object.entries<any>(expiries || {})) {
        if (!expObj?.rows) continue;
        for (const row of expObj.rows) {
          const segment = sym === 'SENSEX' ? 'BFO' : 'NFO';
          const strike = row.strikePrice;

          // CE
          if (row.ce && row.ce.token && row.ce.ltp > 0) {
            const tokenStr = String(row.ce.token);
            const ltp = parseFloat(row.ce.ltp);
            const tsSym = row.ce.tradingSymbol || `${sym}${strike}CE`;
            const tick: MarketTick = {
              instrumentToken: `${segment}_${tokenStr}`,
              exchange: segment,
              symbol: tsSym,
              ltp,
              open: ltp,
              high: ltp,
              low: ltp,
              close: ltp,
              volume: parseInt(row.ce.volume || '0', 10),
              change: parseFloat(row.ce.change || '0'),
              changePercent: parseFloat(row.ce.change || '0'),
              bid: Number((ltp * 0.995).toFixed(2)),
              ask: Number((ltp * 1.005).toFixed(2)),
              bidQty: 100,
              askQty: 100,
              timestamp: ts,
            };

            this.tickCache.set(`${segment}_${tokenStr}`, tick);
            this.tickCache.set(tokenStr, tick);
            this.tickCache.set(`${segment}_${sym}_${strike}_CE`, tick);
            this.tickCache.set(tsSym, tick);

            this.callbacks.forEach(cb => cb(tick));
          }

          // PE
          if (row.pe && row.pe.token && row.pe.ltp > 0) {
            const tokenStr = String(row.pe.token);
            const ltp = parseFloat(row.pe.ltp);
            const tsSym = row.pe.tradingSymbol || `${sym}${strike}PE`;
            const tick: MarketTick = {
              instrumentToken: `${segment}_${tokenStr}`,
              exchange: segment,
              symbol: tsSym,
              ltp,
              open: ltp,
              high: ltp,
              low: ltp,
              close: ltp,
              volume: parseInt(row.pe.volume || '0', 10),
              change: parseFloat(row.pe.change || '0'),
              changePercent: parseFloat(row.pe.change || '0'),
              bid: Number((ltp * 0.995).toFixed(2)),
              ask: Number((ltp * 1.005).toFixed(2)),
              bidQty: 100,
              askQty: 100,
              timestamp: ts,
            };

            this.tickCache.set(`${segment}_${tokenStr}`, tick);
            this.tickCache.set(tokenStr, tick);
            this.tickCache.set(`${segment}_${sym}_${strike}_PE`, tick);
            this.tickCache.set(tsSym, tick);

            this.callbacks.forEach(cb => cb(tick));
          }
        }
      }
    }
  }

  public destroy(): void {
    if (this.timer)      clearInterval(this.timer);
    if (this.chainTimer) clearInterval(this.chainTimer);
    if (this.childProc)  this.childProc.kill();
    if (this.chainProc)  this.chainProc.kill();
  }
}
