import { query, queryOne, execute } from '../db/schema';
import { marginEngineService } from './MarginEngineService';
import { VirtualWalletLedger } from '../trading/VirtualWalletLedger';
import { MarketDataEngine } from '../marketData/MarketDataEngine';
import { generateUUID } from '../utils/crypto';

export interface ReconciliationDiscrepancy {
  userId: string;
  symbol: string;
  productType: string;
  netQty: number;
  entryPrice: number;
  currentLtp: number;
  requiredMargin: number;
  availableBuyingPower: number;
  shortfall: number;
  status: 'RESOLVED' | 'FLAGGED' | 'CRITICAL';
}

export class MarginReconciliationJob {
  private static instance: MarginReconciliationJob;
  private isRunning: boolean = false;
  private intervalTimer: NodeJS.Timeout | null = null;

  private constructor() {}

  public static getInstance(): MarginReconciliationJob {
    if (!MarginReconciliationJob.instance) {
      MarginReconciliationJob.instance = new MarginReconciliationJob();
    }
    return MarginReconciliationJob.instance;
  }

  public start(intervalMs: number = 3600000): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`[MarginReconciliation] 🔍 Post-Trade Margin Sweep active (Interval: ${intervalMs / 60000} mins)`);

    this.intervalTimer = setInterval(() => {
      this.runSweep().catch(err => console.error('[MarginReconciliation] Sweep error:', err.message));
    }, intervalMs);
  }

  public stop(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    this.isRunning = false;
    console.log('[MarginReconciliation] Sweep stopped.');
  }

  public async runSweep(): Promise<{ sweptPositions: number; discrepanciesFound: number }> {
    console.log('[MarginReconciliation] 🧹 Starting nightly/periodic open position margin reconciliation sweep...');

    // 1. Fetch all open positions across all users
    const openPositions = await query<any>(
      `SELECT * FROM positions WHERE net_qty != 0`
    );

    let discrepanciesFound = 0;

    for (const pos of openPositions) {
      try {
        const netQty = parseInt(pos.net_qty, 10);
        if (netQty === 0) continue;

        const side = netQty > 0 ? 'BUY' : 'SELL';
        const absQty = Math.abs(netQty);

        // Fetch live tick from MarketDataEngine
        const tick = MarketDataEngine.getInstance().getCachedTick(pos.symbol);
        const ltp = tick && tick.ltp > 0 ? tick.ltp : parseFloat(pos.ltp || pos.average_price || '100');

        // Determine option details
        let optionType: 'CE' | 'PE' | 'XX' = 'XX';
        let strike = 0;
        let underlying = pos.symbol;

        const optRegex = /(?:^(?:NFO|BFO|NSE|BSE)_)?([A-Z]+)[_\s\d-]*?(\d+(?:\.\d+)?)[_\s]*(CE|PE)$/i;
        const symMatch = (pos.symbol || '').match(optRegex);
        if (symMatch) {
          underlying = symMatch[1].toUpperCase();
          strike = parseFloat(symMatch[2]);
          optionType = symMatch[3].toUpperCase() as 'CE' | 'PE';
        }

        // Calculate authoritative fresh required margin
        const freshQuote = await marginEngineService.calculateQuote({
          userId: pos.user_id,
          exchange: pos.exchange || 'NSE',
          underlying,
          strike,
          optionType,
          side,
          quantity: absQty,
          price: ltp,
          productType: pos.product_type
        });

        const wallet = await VirtualWalletLedger.getWallet(pos.user_id);
        const buyingPower = wallet ? wallet.buyingPower : 0;
        const usedMargin = wallet ? wallet.usedMargin : 0;

        // If required margin exceeds total wallet capital + cushion
        const shortfall = Math.max(0, freshQuote.requiredMargin - (buyingPower + usedMargin));

        if (shortfall > 1000) { // Discrepancy > ₹1,000 threshold
          discrepanciesFound++;
          console.warn(`[MarginReconciliation:FLAGGED] ⚠️ Position ${pos.symbol} (User: ${pos.user_id}) under-margined! Required: ₹${freshQuote.requiredMargin}, Shortfall: ₹${shortfall}`);

          // Persist audit discrepancy log
          await execute(
            `INSERT INTO rms_reconciliation_audit (
               id, user_id, symbol, net_qty, current_ltp, required_margin, buying_power, shortfall, status, created_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
            [
              'rec_' + generateUUID(),
              pos.user_id,
              pos.symbol,
              netQty,
              ltp,
              freshQuote.requiredMargin,
              buyingPower,
              shortfall,
              shortfall > 50000 ? 'CRITICAL' : 'FLAGGED'
            ]
          ).catch(() => {});
        }
      } catch (err: any) {
        console.error(`[MarginReconciliation] Error evaluating position ${pos.id}:`, err.message);
      }
    }

    console.log(`[MarginReconciliation] ✅ Sweep complete. Evaluated ${openPositions.length} positions. Discrepancies flagged: ${discrepanciesFound}`);
    return { sweptPositions: openPositions.length, discrepanciesFound };
  }
}

export const marginReconciliationJob = MarginReconciliationJob.getInstance();
