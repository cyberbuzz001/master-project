/**
 * ExpirySettlementEngine.ts
 * 
 * Automated Contract Expiry Settlement Engine for TradeGrow.
 * 
 * Automatically settles and squares off expired derivative contracts (Options & Futures)
 * across all product types (NRML, MIS, CNC) upon market close (15:30 IST) on their expiry date,
 * or retroactively on server boot/runtime detection.
 * 
 * Settlement Rules:
 *  - Call Option (CE): ITM -> max(0, Spot - Strike), OTM/ATM -> ₹0.00 (Worthless)
 *  - Put Option (PE): ITM -> max(0, Strike - Spot), OTM/ATM -> ₹0.00 (Worthless)
 *  - Futures: Settles against the underlying spot closing price
 *  - Positions are cleanly closed (net_qty = 0), realized P&L is credited/debited to virtual wallet,
 *    used margin is freed from first principles, resting orders are cancelled, and closed_trades record is stored.
 */

import { query, queryOne, execute, withTransaction } from '../db/schema';
import { redis } from '../db/redis';
import { MarketDataEngine } from '../marketData/MarketDataEngine';
import { resolveOptionDetails, resolveSpotPrice } from './MarginMath';
import { VirtualWalletLedger } from './VirtualWalletLedger';
import { ExpiryCalendarService } from '../services/ExpiryCalendarService';
import { generateUUID } from '../utils/crypto';
import { logAuditAction } from '../middleware/audit';
import { recordRiskEvent } from './RmsSquareOffAction';
import { emitAdminTradeEvent, emitAdminPositionUpdate, emitAdminFundsUpdate } from '../utils/adminEventBus';

const RUN_LOCK_KEY = 'lock:expiry-settlement-run';
const RUN_LOCK_TTL_SECONDS = 60;

export interface ExpirySettlementRecord {
  positionId: string;
  userId: string;
  symbol: string;
  exchange: string;
  productType: string;
  netQty: number;
  entryPrice: number;
  expiryDate: string;
  spotPrice: number;
  settlementPrice: number;
  realizedPnl: number;
  exitReason: string;
  status: 'SETTLED' | 'SKIPPED' | 'FAILED';
  error?: string;
}

export interface ExpirySettlementSummary {
  ranAt: string;
  enabled: boolean;
  totalScanned: number;
  settledCount: number;
  skippedCount: number;
  failedCount: number;
  settlements: ExpirySettlementRecord[];
}

export class ExpirySettlementEngine {
  /**
   * Main entry point to run contract expiry settlement.
   * Can be invoked by scheduled cron at 15:30 IST, server startup, or manual admin API trigger.
   */
  public static async settleExpiredContracts(force: boolean = false): Promise<ExpirySettlementSummary> {
    const ranAt = new Date().toISOString();
    const lockAcquired = await redis.acquireLock(RUN_LOCK_KEY, RUN_LOCK_TTL_SECONDS, 'expiry-engine');
    if (!lockAcquired && !force) {
      console.log('[ExpirySettlementEngine] Another settlement cycle holds the lock — skipping.');
      return { ranAt, enabled: true, totalScanned: 0, settledCount: 0, skippedCount: 0, failedCount: 0, settlements: [] };
    }

    try {
      // Check system configuration
      const settingRow = await queryOne<any>(
        `SELECT value FROM system_settings WHERE key = 'EXPIRY_SETTLEMENT_ENABLED'`
      );
      const enabled = (settingRow?.value || 'true') !== 'false';
      if (!enabled && !force) {
        console.log('[ExpirySettlementEngine] Disabled via EXPIRY_SETTLEMENT_ENABLED — skipping run.');
        return { ranAt, enabled: false, totalScanned: 0, settledCount: 0, skippedCount: 0, failedCount: 0, settlements: [] };
      }

      const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
      const now = new Date();
      // IST is UTC+5.5 hours
      const nowISTHours = ((now.getUTCHours() + 5) % 24) + ((now.getUTCMinutes() + 30) >= 60 ? 1 : 0) + (((now.getUTCMinutes() + 30) % 60) / 60);
      const isPastMarketClose = nowISTHours >= 15.5; // 15:30 IST or later
      const isMarketHours = MarketDataEngine.isMarketHours();

      const openPositions = await query<any>(
        `SELECT * FROM positions WHERE net_qty != 0 ORDER BY updated_at ASC`
      );

      console.log(`[ExpirySettlementEngine] Scanning ${openPositions.length} open position(s) for expired contracts (Today IST: ${todayIST}, Past 15:30: ${isPastMarketClose})...`);

      const settlements: ExpirySettlementRecord[] = [];
      let settledCount = 0;
      let skippedCount = 0;
      let failedCount = 0;

      for (const pos of openPositions) {
        const netQty = parseInt(pos.net_qty, 10);
        if (netQty === 0) continue;

        const optionDetails = resolveOptionDetails(pos.symbol, null);
        const isFuture = pos.symbol.toUpperCase().includes('FUT');
        const isDerivative = Boolean(optionDetails || isFuture);

        // Plain equities do not expire (unless MIS intraday, which is handled by RMS cutoff engine)
        if (!isDerivative) {
          skippedCount++;
          continue;
        }

        try {
          // Resolve contract expiry date for this specific position
          const expiryDate = await ExpiryCalendarService.getInstance().resolveContractExpiryDate(
            pos.symbol,
            pos.updated_at
          );

          // Check if the contract is expired:
          // 1. Contract expiry was on a previous calendar day (expiryDate < todayIST)
          // 2. Contract expiry is today, and we are past market close (15:30 IST) or market is closed
          // 3. Or force settlement requested
          const isExpired = force || (expiryDate < todayIST) || (expiryDate === todayIST && (isPastMarketClose || !isMarketHours));

          if (!isExpired) {
            skippedCount++;
            continue;
          }

          console.log(`[ExpirySettlementEngine] ⌛ Settling expired contract: User ${pos.user_id} | ${pos.symbol} (${pos.product_type}) | Qty: ${netQty} | Expiry: ${expiryDate}`);

          // Calculate authoritative settlement price
          let underlying = '';
          if (optionDetails) {
            underlying = optionDetails.underlying;
          } else if (isFuture) {
            const inst = await queryOne<any>(
              'SELECT name, symbol FROM instruments WHERE instrument_token = $1 OR symbol = $2 LIMIT 1',
              [pos.instrument_token || pos.symbol, pos.symbol]
            );
            if (inst && inst.name) {
              underlying = inst.name.toUpperCase().trim();
            } else {
              // Strip exchange prefix and date patterns (e.g. RELIANCE24SEPFUT -> RELIANCE)
              underlying = pos.symbol
                .replace(/^(NSE_|BSE_|NFO_|BFO_)/, '')
                .replace(/(?:\d{1,2}[A-Z]{3}\d{2}|\d{2}[A-Z]{3}|\d{4}-\d{2}-\d{2})?[-_]?FUT.*/i, '')
                .trim();
            }
          }

          const resolvedSpot = resolveSpotPrice(underlying);
          const isIndex = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX', 'BANKEX'].includes(underlying);
          let spotPrice = resolvedSpot.price;
          // Prevent non-index stock futures from settling at hardcoded Nifty index fallback (23825)
          if (!isIndex && resolvedSpot.source === 'cached_stale' && resolvedSpot.price === 23825) {
            const posPrice = parseFloat(pos.average_price) || parseFloat(pos.buy_price) || parseFloat(pos.sell_price) || 0;
            if (posPrice > 0) {
              spotPrice = posPrice;
            }
          }
          let settlementPrice = 0.00;

          if (optionDetails) {
            const strike = optionDetails.strike;
            if (optionDetails.optionType === 'CE') {
              // Call Option Intrinsic Value
              settlementPrice = Math.max(0.00, spotPrice - strike);
            } else {
              // Put Option Intrinsic Value
              settlementPrice = Math.max(0.00, strike - spotPrice);
            }
          } else if (isFuture) {
            // Futures settle at underlying spot closing price
            settlementPrice = spotPrice;
          }

          settlementPrice = Number(settlementPrice.toFixed(2));

          const entryPrice = parseFloat(pos.average_price) > 0
            ? parseFloat(pos.average_price)
            : (netQty > 0 ? parseFloat(pos.buy_price || '0') : parseFloat(pos.sell_price || '0'));

          const closedQty = Math.abs(netQty);
          const realizedPnlDelta = netQty > 0
            ? Number((closedQty * (settlementPrice - entryPrice)).toFixed(2))
            : Number((closedQty * (entryPrice - settlementPrice)).toFixed(2));

          const exitSide: 'BUY' | 'SELL' = netQty > 0 ? 'SELL' : 'BUY';
          const entrySide: 'BUY' | 'SELL' = netQty > 0 ? 'BUY' : 'SELL';
          const exitReason = settlementPrice === 0 ? 'EXPIRED_WORTHLESS' : 'EXPIRY_SETTLEMENT';
          const execId = 'exc_exp_' + generateUUID();
          const tradeId = 'trd_exp_' + generateUUID();

          // Execute settlement atomically
          await withTransaction(async (client) => {
            // 1. Cancel any active resting orders on this position
            await client.query(
              `UPDATE orders 
               SET status = 'CANCELLED', updated_at = NOW() 
               WHERE user_id = $1 AND symbol = $2 AND status IN ('ACCEPTED', 'PENDING', 'OPEN', 'EXECUTING')`,
              [pos.user_id, pos.symbol]
            );

            // 2. Insert into closed_trades for permanent P&L audit trail
            await client.query(
              `INSERT INTO closed_trades (
                 id, user_id, position_id, instrument_token, symbol, exchange, product_type,
                 entry_side, exit_side, quantity, entry_price, exit_price, gross_pnl, charges, net_pnl,
                 exit_reason, exit_order_id, execution_id, closed_at
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 0.0, $14, $15, $16, $17, NOW())
               ON CONFLICT (execution_id) DO NOTHING`,
              [
                tradeId,
                pos.user_id,
                pos.id,
                `EXP_${pos.exchange}_${pos.symbol}`,
                pos.symbol,
                pos.exchange,
                pos.product_type,
                entrySide,
                exitSide,
                closedQty,
                entryPrice,
                settlementPrice,
                realizedPnlDelta,
                realizedPnlDelta,
                'EXPIRY', // Standard DB check constraint token
                null,
                execId
              ]
            );

            // 3. Flatten position to net_qty = 0
            const currentBuyQty = parseInt(pos.buy_qty || '0', 10);
            const currentSellQty = parseInt(pos.sell_qty || '0', 10);
            const finalQty = Math.max(currentBuyQty, currentSellQty, closedQty);
            const prevRealizedPnl = parseFloat(pos.realized_pnl || '0');
            const totalRealizedPnl = prevRealizedPnl + realizedPnlDelta;

            await client.query(
              `UPDATE positions
               SET buy_qty = $1, sell_qty = $2, net_qty = 0, ltp = $3,
                   realized_pnl = $4, unrealized_pnl = 0.00, updated_at = NOW()
               WHERE id = $5`,
              [finalQty, finalQty, settlementPrice, totalRealizedPnl, pos.id]
            );

            // 4. Settle Virtual Money Ledger: Adjust cash balance & recompute used margin
            await VirtualWalletLedger.settleTradeExecutionInTransaction(
              client,
              pos.user_id,
              exitSide,
              closedQty * settlementPrice,
              closedQty * entryPrice,
              realizedPnlDelta,
              'EXPIRY_SETTLEMENT'
            );
          });

          // 5. Record risk event & audit logs
          await recordRiskEvent('EXPIRY_SETTLEMENT', false, pos, exitSide, closedQty, {
            expiryDate,
            spotPrice,
            settlementPrice,
            realizedPnlDelta,
            exitReason,
            reason: `Contract Expired on ${expiryDate} — Settled @ ₹${settlementPrice.toFixed(2)}`
          });

          // 6. Notify connected clients & Admin Event Bus
          emitAdminTradeEvent(pos.user_id, {
            tradeId,
            symbol: pos.symbol,
            side: exitSide,
            quantity: closedQty,
            price: settlementPrice,
            exitReason: 'EXPIRY',
            realizedPnl: realizedPnlDelta,
          });
          emitAdminPositionUpdate(pos.user_id, []);
          emitAdminFundsUpdate(pos.user_id, null);

          settledCount++;
          settlements.push({
            positionId: pos.id,
            userId: pos.user_id,
            symbol: pos.symbol,
            exchange: pos.exchange,
            productType: pos.product_type,
            netQty,
            entryPrice,
            expiryDate,
            spotPrice,
            settlementPrice,
            realizedPnl: realizedPnlDelta,
            exitReason,
            status: 'SETTLED'
          });

          console.log(`[ExpirySettlementEngine] ✅ Successfully settled ${pos.symbol} (User: ${pos.user_id}) | Realized P&L: ₹${realizedPnlDelta.toFixed(2)} | Settlement Price: ₹${settlementPrice}`);
        } catch (posErr: any) {
          failedCount++;
          console.error(`[ExpirySettlementEngine] ❌ Error settling position ${pos.id} (${pos.symbol}):`, posErr.message);
          settlements.push({
            positionId: pos.id,
            userId: pos.user_id,
            symbol: pos.symbol,
            exchange: pos.exchange,
            productType: pos.product_type,
            netQty,
            entryPrice: 0,
            expiryDate: '',
            spotPrice: 0,
            settlementPrice: 0,
            realizedPnl: 0,
            exitReason: 'EXPIRY_FAILED',
            status: 'FAILED',
            error: posErr.message
          });
        }
      }

      console.log(`[ExpirySettlementEngine] Settlement complete. Scanned: ${openPositions.length} | Settled: ${settledCount} | Skipped: ${skippedCount} | Failed: ${failedCount}`);

      return {
        ranAt,
        enabled,
        totalScanned: openPositions.length,
        settledCount,
        skippedCount,
        failedCount,
        settlements
      };
    } finally {
      await redis.releaseLock(RUN_LOCK_KEY).catch(() => {});
    }
  }

  /**
   * Diagnostic helper to inspect open positions and their expiry dates without settling
   */
  public static async getExpiryStatus(): Promise<any[]> {
    const openPositions = await query<any>(
      `SELECT * FROM positions WHERE net_qty != 0 ORDER BY updated_at ASC`
    );
    const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

    const results = [];
    for (const pos of openPositions) {
      const optionDetails = resolveOptionDetails(pos.symbol, null);
      const isFuture = pos.symbol.toUpperCase().includes('FUT');
      const isDerivative = Boolean(optionDetails || isFuture);
      const expiryDate = isDerivative
        ? await ExpiryCalendarService.getInstance().resolveContractExpiryDate(pos.symbol, pos.updated_at)
        : null;

      const isExpired = expiryDate ? expiryDate < todayIST : false;

      results.push({
        positionId: pos.id,
        userId: pos.user_id,
        symbol: pos.symbol,
        exchange: pos.exchange,
        productType: pos.product_type,
        netQty: parseInt(pos.net_qty, 10),
        averagePrice: parseFloat(pos.average_price),
        ltp: parseFloat(pos.ltp),
        isDerivative,
        expiryDate,
        isExpired,
        todayIST,
        updatedAt: pos.updated_at
      });
    }

    return results;
  }
}
