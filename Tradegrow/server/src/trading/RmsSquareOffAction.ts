/**
 * RmsSquareOffAction.ts
 * Shared per-position square-off action, used by both the scheduled EOD
 * cutoff engine (RmsAutoSquareOffEngine) and the continuous loss-tier
 * monitor (RmsLossMonitor) — extracted so both call the exact same
 * cancel-resting-orders-then-submit-fresh-MARKET-order logic instead of a
 * second copy. See the Phase 2 section of the RMS overhaul plan.
 */
import { query, queryOne, execute } from '../db/schema';
import { logAuditAction } from '../middleware/audit';
import { OMS, SYSTEM_ACTOR_RMS_AUTO_SQUAREOFF } from './OMS';
import { resolveOptionDetails } from './MarginMath';
import { generateUUID } from '../utils/crypto';
import { createAdminNotification } from '../utils/adminNotifications';

export interface SquareOffActionResult {
  status: 'SIMULATED' | 'SUBMITTED' | 'SKIPPED' | 'FAILED';
  netQty: number;
  exitSide: 'BUY' | 'SELL';
  exitQty: number;
  orderId?: string;
  error?: string;
}

/**
 * Resolves a real instrument_token for a position row. Never fabricates one —
 * `orders.instrument_token` is NOT NULL and downstream tick lookups depend on
 * it being correct, so a failure here must skip the position loudly rather
 * than guess (this is exactly the class of bug Phase 0 found once already
 * with bare-symbol collisions across an underlying's many listed contracts).
 */
export async function resolveInstrumentTokenForPosition(pos: any): Promise<string | null> {
  const optionDetails = resolveOptionDetails(pos.symbol, null);
  if (optionDetails) {
    const row = await queryOne<any>(
      `SELECT instrument_token FROM instruments
       WHERE symbol = $1 AND strike = $2 AND option_type = $3
       ORDER BY (exchange = $4) DESC, active DESC, expiry DESC NULLS LAST
       LIMIT 1`,
      [optionDetails.underlying, optionDetails.strike, optionDetails.optionType, pos.exchange]
    );
    return row?.instrument_token || null;
  }
  const row = await queryOne<any>(
    `SELECT instrument_token FROM instruments WHERE symbol = $1 AND exchange = $2 ORDER BY active DESC LIMIT 1`,
    [pos.symbol, pos.exchange]
  );
  return row?.instrument_token || null;
}

/**
 * Writes the paired risk_events + audit_logs record for an automated RMS
 * action. `eventType` distinguishes the calling engine (e.g. Phase 1's
 * 'RMS_AUTO_SQUARE_OFF' vs Phase 2's 'RMS_LOSS_SQUARE_OFF') so existing
 * consumers of the Phase 1 string keep working unchanged.
 */
export async function recordRiskEvent(
  eventType: string,
  simulated: boolean,
  pos: any,
  exitSide: 'BUY' | 'SELL',
  exitQty: number,
  extra: Record<string, any>
): Promise<void> {
  await execute(
    `INSERT INTO risk_events (id, customer_id, event_type, severity, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      'rev_' + generateUUID(),
      pos.user_id,
      eventType,
      extra.severity || 'MEDIUM',
      JSON.stringify({
        simulated,
        symbol: pos.symbol,
        exchange: pos.exchange,
        productType: pos.product_type,
        netQty: pos.net_qty,
        exitSide,
        exitQty,
        ...extra,
      }),
    ]
  ).catch((err: any) => console.error('[RmsSquareOffAction] Failed to record risk_event:', err.message));

  await logAuditAction(
    'SYSTEM', 'SYSTEM',
    simulated ? `${eventType}_SIMULATED` : `${eventType}_EXECUTED`,
    'POSITION', pos.id,
    null,
    { symbol: pos.symbol, exitSide, exitQty, ...extra },
    '127.0.0.1'
  );

  // Only HIGH/CRITICAL risk events become a persistent admin notification — the
  // 50/60% LOG-tier events (LOW/MEDIUM severity) fire per-position, per-crossing,
  // across every active trader and would flood the alert feed with routine noise
  // that's already fully captured in risk_events/RiskCommandCenter's history.
  const severity = extra.severity || 'MEDIUM';
  if (severity === 'HIGH' || severity === 'CRITICAL') {
    await createAdminNotification(eventType, pos.user_id, {
      severity, simulated, symbol: pos.symbol, exitSide, exitQty, ...extra,
    });
  }
}

/**
 * Cancels any resting orders on this exact position, re-reads net_qty fresh,
 * and (in LIVE mode) submits one MARKET order to flatten it. In SIMULATION
 * mode, reports what would happen — including how many resting orders would
 * be cancelled — without cancelling anything or touching the order pipeline;
 * cancelling is a real, user-visible side effect that SIMULATION must not have.
 */
export async function executeSquareOff(
  pos: any,
  opts: { mode: 'SIMULATION' | 'LIVE'; reason: string; eventType: string }
): Promise<SquareOffActionResult> {
  const netQty = parseInt(pos.net_qty, 10);
  const exitSide: 'BUY' | 'SELL' = netQty > 0 ? 'SELL' : 'BUY';
  const exitQty = Math.abs(netQty);

  const restingOrders = await query<any>(
    `SELECT order_id FROM orders WHERE user_id = $1 AND symbol = $2 AND product_type = $3 AND status IN ('ACCEPTED','PENDING','EXECUTING')`,
    [pos.user_id, pos.symbol, pos.product_type]
  );

  if (opts.mode === 'SIMULATION') {
    console.log(`[RMS:SIMULATION] WOULD SQUARE OFF | User: ${pos.user_id} | Position: ${pos.symbol} | Qty: ${exitQty} | Side: ${exitSide} | Would cancel ${restingOrders.length} resting order(s) | Reason: ${opts.reason}`);
    await recordRiskEvent(opts.eventType, true, pos, exitSide, exitQty, { restingOrdersWouldCancel: restingOrders.length, reason: opts.reason });
    return { status: 'SIMULATED', netQty, exitSide, exitQty };
  }

  // LIVE mode from here. Cancel any resting orders on this exact position
  // first, then re-read net_qty fresh — a stuck LIMIT/SL order that will
  // never fill must not be able to block forced closure, and a stale
  // resting order filling concurrently with a fresh MARKET order could
  // otherwise flip the position instead of flattening it.
  for (const ro of restingOrders) {
    await OMS.cancelOrder(ro.order_id, pos.user_id);
  }

  const freshPos = await queryOne<any>('SELECT net_qty FROM positions WHERE id = $1', [pos.id]);
  const freshNetQty = freshPos ? parseInt(freshPos.net_qty, 10) : netQty;
  if (freshNetQty === 0) {
    return { status: 'SKIPPED', netQty: 0, exitSide, exitQty: 0 };
  }
  const freshExitSide: 'BUY' | 'SELL' = freshNetQty > 0 ? 'SELL' : 'BUY';
  const freshExitQty = Math.abs(freshNetQty);

  const instrumentToken = await resolveInstrumentTokenForPosition(pos);
  if (!instrumentToken) {
    await recordRiskEvent(opts.eventType, false, pos, freshExitSide, freshExitQty, {
      severity: 'CRITICAL', reason: opts.reason,
      error: 'Could not resolve instrument_token — data quality issue, needs manual review',
    });
    return { status: 'FAILED', netQty: freshNetQty, exitSide: freshExitSide, exitQty: freshExitQty, error: 'instrument_token not resolved' };
  }

  const submitResult = await OMS.submitOrder({
    userId: pos.user_id,
    instrumentToken,
    exchange: pos.exchange,
    symbol: pos.symbol,
    side: freshExitSide,
    quantity: freshExitQty,
    price: 0,
    orderType: 'MARKET',
    productType: pos.product_type,
    source: 'RMS',
    reason: opts.reason,
    systemActor: SYSTEM_ACTOR_RMS_AUTO_SQUAREOFF,
  });

  if (submitResult.success) {
    await recordRiskEvent(opts.eventType, false, pos, freshExitSide, freshExitQty, { orderId: submitResult.orderId, reason: opts.reason });
    return { status: 'SUBMITTED', netQty: freshNetQty, exitSide: freshExitSide, exitQty: freshExitQty, orderId: submitResult.orderId };
  }

  await recordRiskEvent(opts.eventType, false, pos, freshExitSide, freshExitQty, { severity: 'HIGH', error: submitResult.error, reason: opts.reason });
  return { status: 'FAILED', netQty: freshNetQty, exitSide: freshExitSide, exitQty: freshExitQty, error: submitResult.error };
}
