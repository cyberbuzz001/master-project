/**
 * RmsLossMonitor.ts
 * Continuous polling engine for the six-tier RMS risk thresholds
 * (50/60/70/80/90/100% unrealized-loss-as-%-of-required-margin). See the
 * Phase 2 section of the RMS overhaul plan for the full design rationale —
 * notably why this polls every few seconds rather than hooking the tick
 * pipeline directly (that chain is fully synchronous end-to-end; a slow
 * handler there would freeze live pricing for the whole platform).
 */
import { query, queryOne, execute } from '../db/schema';
import { redis } from '../db/redis';
import { logAuditAction } from '../middleware/audit';
import { adminEventBus } from '../utils/adminEventBus';
import { createAdminNotification } from '../utils/adminNotifications';
import { OMS } from './OMS';
import { executeSquareOff, recordRiskEvent } from './RmsSquareOffAction';
import {
  marginForLeg, resolveOptionDetails, resolveSpotPrice, getMarginParams,
  resolveUnrealizedPnlForPosition, ZERO_CHARGES,
} from './MarginMath';

const CYCLE_LOCK_KEY = 'lock:rms:loss-monitor-cycle';
const SQUAREOFF_EVENT_TYPE = 'RMS_LOSS_SQUARE_OFF';
const SQUAREOFF_REASON = 'LOSS_THRESHOLD';
const FAILED_ATTEMPT_COOLDOWN_MS = 30000;
const DEGRADED_CHECK_EVERY_N_CYCLES = 20;
const DEGRADED_THRESHOLD_FRACTION = 0.5;
const SWEEP_EVERY_N_CYCLES = 50;

interface RiskTier {
  tier_name: string;
  threshold_pct: number;
  severity: string;
  action: 'LOG' | 'RESTRICT' | 'SQUAREOFF' | 'SUSPEND';
  sort_order: number;
}

let timeoutHandle: NodeJS.Timeout | null = null;
let running = false;

// In-memory only — acceptable for a single-instance app (see plan). Re-set
// from scratch on every cycle's fresh position fetch, so a restart just
// means "everything looks like a fresh crossing once," not unsafe.
const lastActionedTier = new Map<string, number>(); // positionId -> sort_order
const squareOffCooldownUntil = new Map<string, number>(); // positionId -> epoch ms

let cachedTiers: { tiers: RiskTier[]; expiresAt: number } | null = null;
let cycleCount = 0;
let unpricedStreak = 0;
let degradedAlertSent = false;

async function getConfig(): Promise<{ enabled: boolean; mode: 'SIMULATION' | 'LIVE'; intervalMs: number }> {
  const rows = await query<any>(
    `SELECT key, value FROM system_settings WHERE key IN ('RMS_MODE','RMS_LOSS_MONITOR_ENABLED','RMS_LOSS_MONITOR_INTERVAL_MS')`
  );
  const map = new Map(rows.map((r: any) => [r.key, r.value]));
  return {
    enabled: (map.get('RMS_LOSS_MONITOR_ENABLED') || 'true') === 'true',
    mode: map.get('RMS_MODE') === 'LIVE' ? 'LIVE' : 'SIMULATION',
    intervalMs: parseInt(map.get('RMS_LOSS_MONITOR_INTERVAL_MS') || '3000', 10) || 3000,
  };
}

async function getTiers(): Promise<RiskTier[]> {
  if (cachedTiers && Date.now() < cachedTiers.expiresAt) return cachedTiers.tiers;
  const tiers = await query<RiskTier>('SELECT * FROM rms_risk_tiers ORDER BY sort_order ASC');
  cachedTiers = { tiers, expiresAt: Date.now() + 60000 };
  return tiers;
}

/** Highest tier whose threshold_pct is at or below lossPct, or null if below every tier. */
function highestTierCrossed(tiers: RiskTier[], lossPct: number): RiskTier | null {
  let best: RiskTier | null = null;
  for (const t of tiers) {
    if (lossPct >= t.threshold_pct) best = t;
  }
  return best;
}

async function suspendAccount(userId: string, reasonDetail: string, mode: 'SIMULATION' | 'LIVE'): Promise<void> {
  if (mode !== 'LIVE') {
    await logAuditAction('SYSTEM', 'SYSTEM', 'RMS_HARD_BREACH_SUSPEND_SIMULATED', 'USER', userId, null, { reasonDetail }, '127.0.0.1');
    return;
  }
  await execute(
    `UPDATE users SET status = 'SUSPENDED', suspended_reason = $1, suspended_by = 'SYSTEM', suspended_at = NOW(), updated_at = NOW() WHERE id = $2`,
    [reasonDetail, userId]
  );
  await logAuditAction('SYSTEM', 'SYSTEM', 'RMS_HARD_BREACH_SUSPEND_EXECUTED', 'USER', userId, null, { reasonDetail }, '127.0.0.1');
  adminEventBus.emitUserEvent('USER_STATUS_UPDATED', userId, { status: 'SUSPENDED', reason: reasonDetail, suspendedBy: 'SYSTEM' });
  await createAdminNotification('RMS_HARD_BREACH_SUSPEND', userId, { reasonDetail, severity: 'CRITICAL' });
}

async function cancelAllOtherOrders(userId: string, exceptSymbol: string, exceptProductType: string): Promise<void> {
  const orders = await query<any>(
    `SELECT order_id FROM orders WHERE user_id = $1 AND status IN ('ACCEPTED','PENDING','EXECUTING') AND NOT (symbol = $2 AND product_type = $3)`,
    [userId, exceptSymbol, exceptProductType]
  );
  for (const o of orders) {
    await OMS.cancelOrder(o.order_id, userId);
  }
}

/** Exported for direct invocation — manual admin testing/verification, mirroring RmsAutoSquareOffEngine.run(). */
export async function runCycle(): Promise<void> {
  const { enabled, mode } = await getConfig();
  cycleCount++;

  if (!enabled) return;

  const lockAcquired = await redis.acquireLock(CYCLE_LOCK_KEY, 10, 'rms-loss-monitor');
  if (!lockAcquired) return; // another cycle (or a slow previous one) is still running

  try {
    const tiers = await getTiers();
    const positions = await query<any>(`SELECT * FROM positions WHERE net_qty != 0`);

    const seenIds = new Set<string>();
    let unpricedThisCycle = 0;
    let scopedCount = 0;

    for (const pos of positions) {
      const netQty = parseInt(pos.net_qty, 10);
      seenIds.add(pos.id);

      if (netQty === 0) {
        lastActionedTier.delete(pos.id);
        squareOffCooldownUntil.delete(pos.id);
        continue;
      }

      const side: 'BUY' | 'SELL' = netQty > 0 ? 'BUY' : 'SELL';
      const quantity = Math.abs(netQty);
      const optionDetails = resolveOptionDetails(pos.symbol, null);

      // Leverage-scope rule: only MIS (any instrument), or option-SELL
      // (writing) positions on any product type, carry a leverage-derived
      // required margin. CNC/NRML non-option (or option-BUY) positions have
      // requiredMargin == full notional, making a "% of margin lost" tier
      // meaningless (would need a ~100% price collapse to ever fire).
      const inScope = pos.product_type === 'MIS' || (!!optionDetails && side === 'SELL');
      if (!inScope) continue;
      scopedCount++;

      let spotPrice: number | undefined;
      let marginParams = { spanMarginRate: 0, exposureMarginRate: 0, additionalMarginRate: 0 };
      if (optionDetails && side === 'SELL') {
        spotPrice = resolveSpotPrice(optionDetails.underlying).price;
        marginParams = await getMarginParams(optionDetails.underlying);
      }
      const price = parseFloat(pos.ltp) > 0 ? parseFloat(pos.ltp) : parseFloat(pos.average_price || '0');
      const requiredMargin = marginForLeg({
        productType: pos.product_type, side, quantity, price,
        optionType: optionDetails?.optionType, strike: optionDetails?.strike,
        spotPrice, marginParams, charges: ZERO_CHARGES,
      }).requiredMargin;

      if (requiredMargin <= 0) continue;

      const { ltp, unrealizedPnl } = resolveUnrealizedPnlForPosition({
        symbol: pos.symbol, netQty, averagePrice: parseFloat(pos.average_price), dbLtp: parseFloat(pos.ltp || 0),
      });

      if (ltp <= 0) {
        // Genuinely no usable price this cycle — never treat as zero loss.
        // Leave any existing tier state untouched; just count it for the
        // platform-level degraded check below.
        unpricedThisCycle++;
        continue;
      }

      const lossPct = unrealizedPnl < 0 ? (Math.abs(unrealizedPnl) / requiredMargin) * 100 : 0;
      const tier = highestTierCrossed(tiers, lossPct);
      const currentSortOrder = tier?.sort_order ?? 0;
      const previousSortOrder = lastActionedTier.get(pos.id) ?? 0;

      if (currentSortOrder <= previousSortOrder) {
        continue; // no new escalation; stays silent (or already actioned) at this level
      }
      lastActionedTier.set(pos.id, currentSortOrder);

      if (!tier) continue; // currentSortOrder can't be >0 without a tier, but keeps TS happy

      const exitSide: 'BUY' | 'SELL' = netQty > 0 ? 'SELL' : 'BUY';
      const exitQty = Math.abs(netQty);

      if (tier.action === 'LOG') {
        await recordRiskEvent(`RMS_LOSS_TIER_${tier.tier_name}`, mode !== 'LIVE', pos, exitSide, exitQty, {
          severity: tier.severity, lossPct: Number(lossPct.toFixed(2)), requiredMargin, unrealizedPnl,
        });
        continue;
      }

      if (tier.action === 'RESTRICT') {
        if (mode === 'LIVE') {
          await execute(`UPDATE users SET risk_restriction = 'REDUCE_ONLY', updated_at = NOW() WHERE id = $1 AND risk_restriction IS DISTINCT FROM 'REDUCE_ONLY'`, [pos.user_id]);
        }
        await recordRiskEvent(`RMS_LOSS_TIER_${tier.tier_name}`, mode !== 'LIVE', pos, exitSide, exitQty, {
          severity: tier.severity, lossPct: Number(lossPct.toFixed(2)), requiredMargin, unrealizedPnl,
        });
        continue;
      }

      // SQUAREOFF or SUSPEND from here — both need the position closed.
      const cooldownUntil = squareOffCooldownUntil.get(pos.id);
      if (cooldownUntil && Date.now() < cooldownUntil) {
        continue; // recently failed; back off rather than retry-storm
      }

      const pendingRmsOrder = await queryOne<any>(
        `SELECT id FROM orders WHERE user_id = $1 AND symbol = $2 AND product_type = $3 AND source = 'RMS' AND status IN ('ACCEPTED','PENDING','EXECUTING') LIMIT 1`,
        [pos.user_id, pos.symbol, pos.product_type]
      );
      if (pendingRmsOrder) {
        continue; // already in flight (from this monitor or the EOD engine) — let it resolve
      }

      const result = await executeSquareOff(pos, { mode, reason: SQUAREOFF_REASON, eventType: SQUAREOFF_EVENT_TYPE });
      if (result.status === 'FAILED') {
        squareOffCooldownUntil.set(pos.id, Date.now() + FAILED_ATTEMPT_COOLDOWN_MS);
      }

      if (tier.action === 'SUSPEND' && (result.status === 'SUBMITTED' || result.status === 'SIMULATED' || result.status === 'SKIPPED')) {
        if (mode === 'LIVE') {
          await cancelAllOtherOrders(pos.user_id, pos.symbol, pos.product_type);
        }
        await suspendAccount(pos.user_id, `RMS_HARD_BREACH: unrealized loss reached ${lossPct.toFixed(1)}% of required margin on ${pos.symbol}`, mode);
      }
    }

    // Defensive sweep: drop any tracked position id that no longer exists at
    // all (positions closed and never re-touched by this loop's inline clear).
    if (cycleCount % SWEEP_EVERY_N_CYCLES === 0) {
      for (const id of Array.from(lastActionedTier.keys())) {
        if (!seenIds.has(id)) { lastActionedTier.delete(id); squareOffCooldownUntil.delete(id); }
      }
    }

    // Degraded-feed detection: don't let "couldn't price it" look like "fine".
    if (scopedCount > 0 && unpricedThisCycle / scopedCount >= DEGRADED_THRESHOLD_FRACTION) {
      unpricedStreak++;
    } else {
      unpricedStreak = 0;
      degradedAlertSent = false;
    }
    if (unpricedStreak >= DEGRADED_CHECK_EVERY_N_CYCLES && !degradedAlertSent) {
      degradedAlertSent = true;
      await execute(
        `INSERT INTO risk_events (id, customer_id, event_type, severity, details) VALUES ($1, NULL, 'RMS_LOSS_MONITOR_DEGRADED', 'HIGH', $2)`,
        ['rev_' + Date.now().toString(36) + Math.random().toString(36).slice(2), JSON.stringify({ unpricedThisCycle, scopedCount, cycleCount })]
      ).catch((err: any) => console.error('[RmsLossMonitor] Failed to record degraded event:', err.message));
      await createAdminNotification('RMS_LOSS_MONITOR_DEGRADED', null, { severity: 'CRITICAL', unpricedThisCycle, scopedCount, cycleCount });
      console.warn(`[RmsLossMonitor] Loss monitor appears to be running blind — ${unpricedThisCycle}/${scopedCount} in-scope positions have no usable price across ${DEGRADED_CHECK_EVERY_N_CYCLES}+ cycles.`);
    }
  } catch (err: any) {
    console.error('[RmsLossMonitor] Cycle error:', err.message);
  } finally {
    await redis.releaseLock(CYCLE_LOCK_KEY).catch(() => {});
  }
}

async function scheduleNextCycle(): Promise<void> {
  const { intervalMs } = await getConfig().catch(() => ({ enabled: true, mode: 'SIMULATION' as const, intervalMs: 3000 }));
  timeoutHandle = setTimeout(async () => {
    await runCycle().catch((err) => console.error('[RmsLossMonitor] Unhandled cycle error:', err.message));
    scheduleNextCycle();
  }, intervalMs);
}

export function startRmsLossMonitor(): void {
  if (running) return;
  running = true;
  console.log('[RmsLossMonitor] Starting continuous loss-tier monitor.');
  scheduleNextCycle();
}

export function stopRmsLossMonitor(): void {
  if (timeoutHandle) clearTimeout(timeoutHandle);
  running = false;
}
