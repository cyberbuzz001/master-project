import { MarketDataEngine } from '../marketData/MarketDataEngine';

export interface ReconciliationReport {
  timestamp: number;
  tokensChecked: number;
  passedCount: number;
  alertCount: number;
  missingCount: number;
  results: Array<{
    symbol: string;
    token: string;
    cachedLtp: number;
    referenceLtp: number;
    diffPct: number;
    status: 'MATCH' | 'DIVERGENCE_ALERT' | 'MISSING_DATA';
  }>;
}

export class ReconciliationMonitorService {
  private static instance: ReconciliationMonitorService;
  private timer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private lastReport: ReconciliationReport | null = null;

  public static getInstance(): ReconciliationMonitorService {
    if (!ReconciliationMonitorService.instance) {
      ReconciliationMonitorService.instance = new ReconciliationMonitorService();
    }
    return ReconciliationMonitorService.instance;
  }

  public start(intervalMs: number = 60000): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`[ReconciliationMonitor] Starting continuous price feed reconciliation monitor (${intervalMs / 1000}s interval)...`);
    
    // Run initial check after 10s warmup
    setTimeout(() => this.runReconciliationCheck(), 10000);
    this.timer = setInterval(() => this.runReconciliationCheck(), intervalMs);
  }

  public stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.isRunning = false;
    console.log('[ReconciliationMonitor] Stopped price feed reconciliation monitor.');
  }

  public async runReconciliationCheck(): Promise<ReconciliationReport> {
    const engine = MarketDataEngine.getInstance();
    // These were raw Dhan numeric security IDs (e.g. NSE_99926000), which
    // SymbologyNormalizer has no logic to resolve to the symbol-based keys
    // (NSE_NIFTY50, NSE_RELIANCE, ...) the tick cache is actually populated
    // under — every sample here always missed, silently, since this file was
    // written: every cycle logged "0/5 matched, 0 alerts" whether the feed
    // was perfectly healthy or badly diverged, because MISSING_DATA and a
    // genuinely clean check both produce alertCount=0. Switched to the same
    // canonical token format used everywhere else in this codebase.
    const sampleTokens = [
      { symbol: 'NIFTY 50', token: 'NSE_NIFTY50' },
      { symbol: 'BANKNIFTY', token: 'NSE_BANKNIFTY' },
      { symbol: 'SENSEX', token: 'BSE_SENSEX' },
      { symbol: 'FINNIFTY', token: 'NSE_FINNIFTY' },
      { symbol: 'RELIANCE', token: 'NSE_RELIANCE' },
    ];

    const results: ReconciliationReport['results'] = [];
    let passedCount = 0;
    let alertCount = 0;
    let missingCount = 0;

    for (const sample of sampleTokens) {
      const cached = engine.getCachedTick(sample.token) || engine.getCachedTick(sample.token.replace(/^([A-Z]+_)/, ''));

      if (!cached) {
        missingCount++;
        results.push({
          symbol: sample.symbol,
          token: sample.token,
          cachedLtp: 0,
          referenceLtp: 0,
          diffPct: 0,
          status: 'MISSING_DATA',
        });
        continue;
      }

      let referenceTick = null;
      try {
        referenceTick = await engine.getQuote(sample.token);
      } catch (_) {}

      const refLtp = referenceTick ? referenceTick.ltp : cached.ltp;
      const cachedLtp = cached.ltp;
      const diffPct = refLtp > 0 ? Number((Math.abs(cachedLtp - refLtp) / refLtp * 100).toFixed(2)) : 0;

      const isAlert = diffPct > 0.50; // Threshold 0.50%
      const status = isAlert ? 'DIVERGENCE_ALERT' : 'MATCH';

      if (isAlert) {
        alertCount++;
        console.warn(`[ReconciliationMonitor] 🚨 DIVERGENCE ALERT: ${sample.symbol} (${sample.token}) | WS Cache: ₹${cachedLtp} vs Reference: ₹${refLtp} (Diff: ${diffPct}%)`);
      } else {
        passedCount++;
      }

      results.push({
        symbol: sample.symbol,
        token: sample.token,
        cachedLtp,
        referenceLtp: refLtp,
        diffPct,
        status,
      });
    }

    this.lastReport = {
      timestamp: Date.now(),
      tokensChecked: sampleTokens.length,
      passedCount,
      alertCount,
      missingCount,
      results,
    };

    // Surfaced separately from alertCount deliberately: a MISSING_DATA result
    // (no cached tick at all for a sample token) previously fell through
    // completely silently — indistinguishable in this log line from a
    // genuinely clean check, which is exactly how this monitor's sample
    // tokens sat unresolvable for as long as they did without anyone
    // noticing. If this ever prints a nonzero missing count again, something
    // is wrong with either the sample list or the feed itself, not just "no
    // divergence found."
    if (missingCount > 0) {
      console.warn(`[ReconciliationMonitor] ⚠️  ${missingCount}/${sampleTokens.length} sample tokens had no cached tick at all (feed down, or a stale/incorrect token key).`);
    }
    console.log(`[ReconciliationMonitor] Check complete. ${passedCount}/${sampleTokens.length} matched cleanly. Alerts: ${alertCount}. Missing: ${missingCount}.`);
    return this.lastReport;
  }

  public getLastReport(): ReconciliationReport | null {
    return this.lastReport;
  }
}

export const reconciliationMonitor = ReconciliationMonitorService.getInstance();
