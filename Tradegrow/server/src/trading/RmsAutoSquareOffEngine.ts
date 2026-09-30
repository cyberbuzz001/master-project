/**
 * RmsAutoSquareOffEngine.ts
 * Scheduled MIS auto square-off — the backend behind the client UI's
 * "15:15 IST auto square-off" banner, which previously had nothing wired up
 * to it. Runs SIMULATION-first (system_settings.RMS_MODE) before any real
 * order is ever submitted; see the Phase 1 section of the RMS overhaul plan
 * for the full design rationale.
 */
import { query } from '../db/schema';
import { redis } from '../db/redis';
import { MarketDataEngine } from '../marketData/MarketDataEngine';
import { executeSquareOff } from './RmsSquareOffAction';

const RUN_LOCK_KEY = 'lock:rms:auto-square-off-run';
const RUN_LOCK_TTL_SECONDS = 300;
const EVENT_TYPE = 'RMS_AUTO_SQUARE_OFF';
const REASON = 'MIS_CUTOFF';

export interface SquareOffResult {
  userId: string;
  symbol: string;
  exchange: string;
  productType: string;
  netQty: number;
  exitSide: 'BUY' | 'SELL';
  exitQty: number;
  status: 'SIMULATED' | 'SUBMITTED' | 'SKIPPED' | 'FAILED';
  orderId?: string;
  error?: string;
}

export interface SquareOffRunSummary {
  ranAt: string;
  mode: 'SIMULATION' | 'LIVE';
  enabled: boolean;
  marketOpen: boolean;
  lockAcquired: boolean;
  processed: number;
  skipped: number;
  failed: number;
  results: SquareOffResult[];
}

async function getConfig(): Promise<{
  enabled: boolean;
  mode: 'SIMULATION' | 'LIVE';
  time: string;
  productTypes: string[];
}> {
  const rows = await query<any>(
    `SELECT key, value FROM system_settings WHERE key IN ('RMS_MODE','MIS_AUTO_SQUARE_OFF_ENABLED','MIS_AUTO_SQUARE_OFF_TIME','MIS_AUTO_SQUARE_OFF_PRODUCT_TYPES')`
  );
  const map = new Map(rows.map((r: any) => [r.key, r.value]));
  const mode = map.get('RMS_MODE') === 'LIVE' ? 'LIVE' : 'SIMULATION';
  const enabled = (map.get('MIS_AUTO_SQUARE_OFF_ENABLED') || 'true') === 'true';
  const time = map.get('MIS_AUTO_SQUARE_OFF_TIME') || '15:15';
  const productTypes = (map.get('MIS_AUTO_SQUARE_OFF_PRODUCT_TYPES') || 'MIS')
    .split(',').map((s: string) => s.trim()).filter(Boolean);
  return { enabled, mode, time, productTypes };
}

export class RmsAutoSquareOffEngine {
  public static async run(targetExchange?: 'EQUITY' | 'COMMODITY' | 'ALL'): Promise<SquareOffRunSummary> {
    const ranAt = new Date().toISOString();
    const { enabled, mode, productTypes } = await getConfig();

    const segment = targetExchange === 'COMMODITY' ? 'COMMODITY' : 'EQUITY';
    const marketOpen = MarketDataEngine.isMarketHours(segment);

    if (!enabled) {
      console.log(`[RmsAutoSquareOffEngine] Disabled via MIS_AUTO_SQUARE_OFF_ENABLED — skipping run for ${targetExchange || 'ALL'}.`);
      return { ranAt, mode, enabled, marketOpen, lockAcquired: false, processed: 0, skipped: 0, failed: 0, results: [] };
    }

    const lockKey = targetExchange ? `${RUN_LOCK_KEY}:${targetExchange}` : RUN_LOCK_KEY;
    const lockAcquired = await redis.acquireLock(lockKey, RUN_LOCK_TTL_SECONDS, 'rms-engine');
    if (!lockAcquired) {
      console.log(`[RmsAutoSquareOffEngine] Another run already holds the lock (${lockKey}) — skipping.`);
      return { ranAt, mode, enabled, marketOpen, lockAcquired: false, processed: 0, skipped: 0, failed: 0, results: [] };
    }

    const results: SquareOffResult[] = [];
    let processed = 0, skipped = 0, failed = 0;

    try {
      let queryStr = `SELECT * FROM positions WHERE product_type = ANY($1::text[]) AND net_qty != 0`;
      const queryParams: any[] = [productTypes];

      if (targetExchange === 'EQUITY') {
        queryStr += ` AND (exchange IS NULL OR exchange != 'MCX')`;
      } else if (targetExchange === 'COMMODITY') {
        queryStr += ` AND exchange = 'MCX'`;
      }

      const positions = await query<any>(queryStr, queryParams);

      console.log(`[RmsAutoSquareOffEngine] Target=${targetExchange || 'ALL'}, Mode=${mode}. Found ${positions.length} open position(s) across [${productTypes.join(',')}].`);

      for (const pos of positions) {
        const netQty = parseInt(pos.net_qty, 10);
        if (netQty === 0) continue;

        try {
          const result = await executeSquareOff(pos, { mode, reason: REASON, eventType: EVENT_TYPE });
          if (result.status === 'SIMULATED' || result.status === 'SUBMITTED') processed++;
          else if (result.status === 'SKIPPED') skipped++;
          else failed++;
          results.push({
            userId: pos.user_id, symbol: pos.symbol, exchange: pos.exchange, productType: pos.product_type,
            netQty: result.netQty, exitSide: result.exitSide, exitQty: result.exitQty,
            status: result.status, orderId: result.orderId, error: result.error,
          });
        } catch (err: any) {
          failed++;
          console.error(`[RmsAutoSquareOffEngine] Error processing position ${pos.id}:`, err.message);
          results.push({
            userId: pos.user_id, symbol: pos.symbol, exchange: pos.exchange, productType: pos.product_type,
            netQty, exitSide: netQty > 0 ? 'SELL' : 'BUY', exitQty: Math.abs(netQty),
            status: 'FAILED', error: err.message,
          });
        }
      }
    } finally {
      await redis.releaseLock(lockKey).catch(() => {});
    }

    console.log(`[RmsAutoSquareOffEngine] Run complete. mode=${mode} processed=${processed} skipped=${skipped} failed=${failed}`);
    return { ranAt, mode, enabled, marketOpen, lockAcquired: true, processed, skipped, failed, results };
  }
}
