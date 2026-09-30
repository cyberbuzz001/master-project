import { pool, query, queryOne, execute, withTransaction } from '../db/schema';
import { RMS } from './RMS';
import { VirtualWalletLedger } from './VirtualWalletLedger';
import { ExecutionEngine, isIndianMarketOpen } from './ExecutionEngine';
import { generateUUID } from '../utils/crypto';
import { SafetyLock } from '../services/SafetyLock';
import { redis } from '../db/redis';
import { logAuditAction } from '../middleware/audit';
import { emitAdminOrderEvent } from '../utils/adminEventBus';
import { calculateHedgedPortfolioMargin, PortfolioLegInput } from './MarginMath';

/** Internal-only actor tokens for SubmitOrderDTO.systemActor — never sourced from any HTTP request body. */
export const SYSTEM_ACTOR_RMS_AUTO_SQUAREOFF = 'RMS_AUTO_SQUAREOFF';

export interface SubmitOrderDTO {
  userId: string;
  instrumentToken: string;
  exchange: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  triggerPrice?: number;
  orderType: 'MARKET' | 'LIMIT' | 'SL' | 'SL_M';
  productType: 'MIS' | 'CNC' | 'NRML';
  idempotencyKey?: string;
  /** Tags who generated this order. Defaults to 'USER' when omitted. */
  source?: string;
  /** Free-text reason, e.g. 'MIS_CUTOFF'. Only meaningful alongside a non-'USER' source. */
  reason?: string;
  systemActor?: string;
  isAmo?: boolean;
  basketId?: string;
}

export interface SubmitBasketDTO {
  userId: string;
  legs: Array<{
    instrumentToken: string;
    exchange: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    price: number;
    orderType: 'MARKET' | 'LIMIT';
    productType: 'MIS' | 'CNC' | 'NRML';
  }>;
  basketTag?: string;
  idempotencyKey?: string;
}

export interface BasketOrderResult {
  success: boolean;
  basketId?: string;
  orderIds?: string[];
  totalMarginRequired?: number;
  nakedMarginRequired?: number;
  marginBenefit?: number;
  spreadsDetected?: string[];
  error?: string;
}

export class OMS {
  public static async submitOrder(dto: SubmitOrderDTO): Promise<{ success: boolean; orderId?: string; error?: string }> {
    // Safety assertion: fail-closed guard — no real money can be placed
    SafetyLock.assertSimulationOnly('OMS.submitOrder');

    // 0. Ensure user ID exists in users table to prevent FK constraint failure,
    // and re-check account status here too — defense-in-depth for any caller
    // that reaches submitOrder without going through the route-level check.
    let userRow = await queryOne<any>('SELECT id, status, risk_restriction FROM users WHERE id = $1', [dto.userId]);
    if (!userRow) {
      const fallbackUser = await queryOne<any>('SELECT id, status, risk_restriction FROM users WHERE email = $1 OR username = $2 LIMIT 1', [dto.userId, dto.userId]);
      if (fallbackUser) {
        dto.userId = fallbackUser.id;
        userRow = fallbackUser;
      } else {
        return { success: false, error: 'ORDER_REJECTED: User account does not exist in database. Please re-login.' };
      }
    }
    if (userRow.status !== 'ACTIVE') {
      if (dto.systemActor === SYSTEM_ACTOR_RMS_AUTO_SQUAREOFF) {
        await logAuditAction(
          'SYSTEM', 'SYSTEM', 'RMS_STATUS_GATE_BYPASS', 'USER', dto.userId,
          { status: userRow.status }, { systemActor: dto.systemActor, symbol: dto.symbol, side: dto.side, quantity: dto.quantity },
          '127.0.0.1'
        );
      } else {
        return { success: false, error: 'ORDER_REJECTED: Account is suspended or disabled' };
      }
    }

    // 1. Distributed Atomic Idempotency Lock (Multi-Node Race Condition Guard)
    let lockAcquired = false;
    const lockKey = dto.idempotencyKey ? `lock:order:${dto.idempotencyKey}` : null;

    if (lockKey) {
      lockAcquired = await redis.acquireLock(lockKey, 10, dto.userId);
      if (!lockAcquired) {
        // Another concurrent request with the same idempotency key is in-flight.
        // Wait briefly (100ms) and check for the completed order in DB.
        await new Promise(r => setTimeout(r, 100));
        const existing = await queryOne<any>(
          'SELECT order_id, status FROM orders WHERE idempotency_key = $1 AND user_id = $2',
          [dto.idempotencyKey, dto.userId]
        );
        if (existing) {
          return { success: true, orderId: existing.order_id };
        }
        return { success: false, error: 'ORDER_REJECTED: Duplicate in-flight order request detected. Please retry.' };
      }

      // Check if this idempotency key was already completed in DB
      const existing = await queryOne<any>(
        'SELECT order_id, status FROM orders WHERE idempotency_key = $1 AND user_id = $2',
        [dto.idempotencyKey, dto.userId]
      );
      if (existing) {
        await redis.releaseLock(lockKey);
        return { success: true, orderId: existing.order_id };
      }
    }

    try {
      // P0-9 FIX: crypto.randomUUID() instead of Date.now()
      const dbOrderId     = 'ord_' + generateUUID();
      const publicOrderId = 'ORD' + generateUUID().slice(0, 8).toUpperCase();

    // 1. Pre-trade RMS validation
    const rmsResult = await RMS.validateOrder({
      userId:          dto.userId,
      instrumentToken: dto.instrumentToken,
      exchange:        dto.exchange,
      symbol:          dto.symbol,
      side:            dto.side,
      quantity:        dto.quantity,
      price:           dto.price,
      orderType:       dto.orderType,
      productType:     dto.productType,
      riskRestriction: userRow.risk_restriction,
      systemActor:     dto.systemActor,
    });

    if (!rmsResult.passed) {
      // Log rejected order to DB
      await execute(
        `INSERT INTO orders (id, order_id, user_id, instrument_token, exchange, symbol, side, quantity, price, trigger_price, order_type, product_type, status, rejection_reason, idempotency_key, source, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'REJECTED', $13, $14, $15, $16)`,
        [
          dbOrderId, publicOrderId, dto.userId, dto.instrumentToken,
          dto.exchange, dto.symbol, dto.side, dto.quantity, dto.price,
          dto.triggerPrice || 0, dto.orderType, dto.productType,
          rmsResult.reason, dto.idempotencyKey || null,
          dto.source || 'USER', dto.reason || null
        ]
      );

      // Record order event
      await this.recordOrderEvent(dbOrderId, null, 'REJECTED', rmsResult.reason || 'RMS rejected');

      return { success: false, error: rmsResult.reason };
    }

    // 2. Save the order, then recompute the authoritative used_margin
    // (positions + every still-pending order, this one now included) —
    // atomically, so a margin-rejected order never lands in the table as an
    // unfunded phantom row. The wallet row is locked for the duration of
    // this transaction (inside recomputeUsedMarginForUser), which is what
    // actually guards against two concurrent submissions for the same user
    // both passing RMS's pre-check against the same stale used_margin
    // snapshot — replacing blockMargin's increment-based lock with the same
    // serialization guarantee.
    try {
      await withTransaction(async (client) => {
        // Authoritative row-locked CNC holdings reservation guard
        if (dto.side === 'SELL' && dto.productType === 'CNC') {
          await RMS.reserveCncHoldingsOrThrow(client, dto.userId, dto.symbol, dto.quantity);
        }

        await client.query(
          `INSERT INTO orders (id, order_id, user_id, instrument_token, exchange, symbol, side, quantity, price, trigger_price, order_type, product_type, status, idempotency_key, source, reason)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'ACCEPTED', $13, $14, $15)`,
          [
            dbOrderId, publicOrderId, dto.userId, dto.instrumentToken,
            dto.exchange, dto.symbol, dto.side, dto.quantity, dto.price,
            dto.triggerPrice || 0, dto.orderType, dto.productType,
            dto.idempotencyKey || null,
            dto.source || 'USER', dto.reason || null
          ]
        );

        const newUsedMargin = await VirtualWalletLedger.recomputeUsedMarginForUser(dto.userId, client);
        const walletRow = await client.query('SELECT cash_balance FROM virtual_wallets WHERE user_id = $1', [dto.userId]);
        const cashBalance = walletRow.rows.length ? parseFloat(walletRow.rows[0].cash_balance) : 0;

        const isRmsActor = dto.systemActor === SYSTEM_ACTOR_RMS_AUTO_SQUAREOFF || dto.source === 'RMS';
        const isPureSquareOff = rmsResult.isPureSquareOff === true || (rmsResult.openingQty ?? dto.quantity) === 0;

        if (!isRmsActor && !isPureSquareOff && newUsedMargin > cashBalance) {
          throw new Error(`ORDER_REJECTED: Insufficient buying power. Required: ₹${newUsedMargin.toFixed(2)}, Available: ₹${cashBalance.toFixed(2)}`);
        }
      });
    } catch (err: any) {
      return { success: false, error: err.message || 'ORDER_REJECTED: Margin or holdings check failed' };
    }

    // Record order event
    await this.recordOrderEvent(dbOrderId, null, 'ACCEPTED', 'RMS passed, margin blocked');

    const pendingOrderObj = {
      id: dbOrderId,
      order_id: publicOrderId,
      user_id: dto.userId,
      instrument_token: dto.instrumentToken,
      exchange: dto.exchange,
      symbol: dto.symbol,
      side: dto.side,
      quantity: dto.quantity,
      price: dto.price,
      trigger_price: dto.triggerPrice || 0,
      order_type: dto.orderType,
      product_type: dto.productType,
      status: 'ACCEPTED',
      created_at: new Date()
    };

    // Register into high-speed in-memory matching engine for sub-millisecond fills
    ExecutionEngine.registerPendingOrder(pendingOrderObj);

    emitAdminOrderEvent(dto.userId, 'ORDER_CREATED', {
      id: dbOrderId, order_id: publicOrderId, user_id: dto.userId, symbol: dto.symbol,
      side: dto.side, quantity: dto.quantity, price: dto.price, order_type: dto.orderType,
      product_type: dto.productType, status: 'ACCEPTED', source: dto.source || 'USER',
    });

    // 4. Trigger execution match cycle (async, non-blocking in production)
    if (process.env.NODE_ENV !== 'test') {
      setTimeout(() => ExecutionEngine.processPendingOrders(), 50);
    }

    return { success: true, orderId: publicOrderId };
  } catch (err: any) {
    console.error('[OMS.submitOrder] Exception:', err.message);
    return { success: false, error: err.message || 'ORDER_SUBMISSION_ERROR' };
  } finally {
    if (lockKey && lockAcquired) {
      await redis.releaseLock(lockKey).catch(() => {});
    }
  }
}

  public static async cancelOrder(orderId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    const order = await queryOne<any>(
      'SELECT * FROM orders WHERE (order_id = $1 OR id = $1) AND user_id = $2',
      [orderId, userId]
    );

    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    if (!['ACCEPTED', 'PENDING', 'OPEN', 'TRIGGER_PENDING'].includes(order.status)) {
      return { success: false, error: `Order cannot be cancelled in state ${order.status}` };
    }

    // Unregister from in-memory matching index immediately
    ExecutionEngine.unregisterPendingOrder(order.id);

    await withTransaction(async (client) => {
      await client.query(`UPDATE orders SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1`, [order.id]);
      // The cancelled order no longer matches the pending-status filter, so
      // it naturally drops out of the recomputed sum — no separate release
      // amount to calculate (that hand-computed amount is what used to go
      // out of sync with what was actually blocked).
      await VirtualWalletLedger.recomputeUsedMarginForUser(userId, client);
    });

    await this.recordOrderEvent(order.id, order.status, 'CANCELLED', 'User cancelled order');

    emitAdminOrderEvent(userId, 'ORDER_UPDATED', { ...order, status: 'CANCELLED' });

    return { success: true };
  }

  public static async modifyOrder(
    orderId: string,
    userId: string,
    newPrice: number,
    newQuantity?: number
  ): Promise<{ success: boolean; error?: string }> {
    const order = await queryOne<any>(
      'SELECT * FROM orders WHERE (order_id = $1 OR id = $1) AND user_id = $2',
      [orderId, userId]
    );

    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    if (order.status !== 'ACCEPTED' && order.status !== 'PENDING') {
      return { success: false, error: `Order cannot be modified in state ${order.status}` };
    }

    const price = newPrice > 0 ? newPrice : parseFloat(order.price);
    const quantity = newQuantity && newQuantity > 0 ? newQuantity : parseInt(order.quantity, 10);

    // A modify can enlarge price/quantity well past what was originally
    // margin-checked at placement — re-validate atomically rather than
    // trusting the original acceptance to still cover it.
    try {
      await withTransaction(async (client) => {
        await client.query(`UPDATE orders SET price = $1, quantity = $2, updated_at = NOW() WHERE id = $3`, [price, quantity, order.id]);

        const newUsedMargin = await VirtualWalletLedger.recomputeUsedMarginForUser(userId, client);
        const walletRow = await client.query('SELECT cash_balance FROM virtual_wallets WHERE user_id = $1', [userId]);
        const cashBalance = walletRow.rows.length ? parseFloat(walletRow.rows[0].cash_balance) : 0;

        const existingPos = await client.query(
          'SELECT net_qty FROM positions WHERE user_id = $1 AND symbol = $2 AND product_type = $3',
          [userId, order.symbol, order.product_type]
        );
        const currentNetQty = existingPos.rows.length ? parseInt(existingPos.rows[0].net_qty, 10) : 0;
        const isOpposite = (currentNetQty > 0 && order.side === 'SELL') || (currentNetQty < 0 && order.side === 'BUY');
        const isPureSquareOff = isOpposite && quantity <= Math.abs(currentNetQty);

        if (!isPureSquareOff && newUsedMargin > cashBalance) {
          throw new Error(`MODIFY_REJECTED: Modification requires ₹${newUsedMargin.toFixed(2)} margin, exceeding available funds of ₹${cashBalance.toFixed(2)}`);
        }
      });
    } catch (err: any) {
      return { success: false, error: err.message || 'MODIFY_FAILED: Margin check failed' };
    }

    await this.recordOrderEvent(order.id, order.status, order.status, `Order modified: price=${price}, qty=${quantity}`);

    const updatedOrder = { ...order, price, quantity };
    ExecutionEngine.registerPendingOrder(updatedOrder);

    emitAdminOrderEvent(userId, 'ORDER_UPDATED', updatedOrder);

    return { success: true };
  }

  public static async getUserOrders(userId: string, limit: number = 100, offset: number = 0, todayOnly: boolean = true): Promise<any[]> {
    if (todayOnly) {
      return query(
        'SELECT * FROM orders WHERE user_id = $1 AND created_at >= CURRENT_DATE ORDER BY created_at DESC LIMIT $2 OFFSET $3',
        [userId, limit, offset]
      );
    }
    return query(
      'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [userId, limit, offset]
    );
  }

  private static async recordOrderEvent(
    orderId: string,
    fromStatus: string | null,
    toStatus: string,
    reason: string
  ): Promise<void> {
    try {
      await execute(
        `INSERT INTO order_events (id, order_id, from_status, to_status, reason, actor)
         VALUES ($1, $2, $3, $4, $5, 'SYSTEM')`,
        ['evt_' + generateUUID(), orderId, fromStatus, toStatus, reason]
      );
    } catch (err: any) {
      console.error('[OMS] Failed to record order event:', err.message);
    }
  }

  /**
   * Atomic Multi-Leg Basket Order Execution
   * Validates combined hedged portfolio margin and executes all legs in a single transaction.
   */
  public static async submitBasketOrder(dto: SubmitBasketDTO): Promise<BasketOrderResult> {
    SafetyLock.assertSimulationOnly('OMS.submitBasketOrder');

    if (!dto.legs || !Array.isArray(dto.legs) || dto.legs.length === 0) {
      return { success: false, error: 'Basket must contain at least 1 leg' };
    }

    // 0. User verification
    const userRow = await queryOne<any>('SELECT id, status, risk_restriction FROM users WHERE id = $1', [dto.userId]);
    if (!userRow || userRow.status !== 'ACTIVE') {
      return { success: false, error: 'ORDER_REJECTED: User account is inactive or not found' };
    }

    // 1. Compute hedged margin for the basket
    const hedgedCalc = calculateHedgedPortfolioMargin(dto.legs);
    const requiredBasketMargin = hedgedCalc.totalMarginRequired;

    // 2. Check user buying power
    const wallet = await VirtualWalletLedger.getWallet(dto.userId);
    const buyingPower = wallet ? wallet.buyingPower : 0;
    if (buyingPower < requiredBasketMargin) {
      return {
        success: false,
        error: `ORDER_REJECTED: Insufficient basket margin. Required: ₹${requiredBasketMargin.toFixed(2)}, Available: ₹${buyingPower.toFixed(2)}`,
        totalMarginRequired: requiredBasketMargin,
        nakedMarginRequired: hedgedCalc.nakedMarginRequired,
        marginBenefit: hedgedCalc.marginBenefit
      };
    }

    const basketId = 'BSK_' + generateUUID().slice(0, 8).toUpperCase();
    const createdOrderIds: string[] = [];
    const pendingOrdersToRegister: any[] = [];

    try {
      await withTransaction(async (client) => {
        for (const leg of dto.legs) {
          const dbOrderId = 'ord_' + generateUUID();
          const publicOrderId = 'ORD' + generateUUID().slice(0, 8).toUpperCase();
          const initialStatus = 'ACCEPTED';

          // CNC sell reserve check
          if (leg.side === 'SELL' && leg.productType === 'CNC') {
            await RMS.reserveCncHoldingsOrThrow(client, dto.userId, leg.symbol, leg.quantity);
          }

          await client.query(
            `INSERT INTO orders (
              id, order_id, user_id, instrument_token, exchange, symbol, side,
              quantity, price, trigger_price, order_type, product_type, status,
              source, reason, basket_id
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, 0, $10, $11, $12, 'BASKET', $13, $14
            )`,
            [
              dbOrderId, publicOrderId, dto.userId, leg.instrumentToken,
              leg.exchange, leg.symbol, leg.side, leg.quantity, leg.price,
              leg.orderType, leg.productType, initialStatus,
              dto.basketTag || 'Strategy Basket Order', basketId
            ]
          );

          createdOrderIds.push(publicOrderId);

          pendingOrdersToRegister.push({
            id: dbOrderId,
            order_id: publicOrderId,
            user_id: dto.userId,
            instrument_token: leg.instrumentToken,
            exchange: leg.exchange,
            symbol: leg.symbol,
            side: leg.side,
            quantity: leg.quantity,
            price: leg.price,
            trigger_price: 0,
            order_type: leg.orderType,
            product_type: leg.productType,
            status: initialStatus,
            created_at: new Date()
          });
        }

        // Recompute user used_margin once atomically after all legs are recorded
        await VirtualWalletLedger.recomputeUsedMarginForUser(dto.userId, client);
      });
    } catch (err: any) {
      return { success: false, error: err.message || 'Basket atomic execution failed' };
    }

    // Register all pending orders into matching engine
    pendingOrdersToRegister.forEach(ord => {
      ExecutionEngine.registerPendingOrder(ord);
      this.recordOrderEvent(ord.id, null, 'ACCEPTED', `Basket leg placed in ${basketId}`).catch(() => {});
      emitAdminOrderEvent(dto.userId, 'ORDER_CREATED', { ...ord, basket_id: basketId });
    });

    // Trigger match cycle
    if (process.env.NODE_ENV !== 'test') {
      setTimeout(() => ExecutionEngine.processPendingOrders(), 50);
    }

    return {
      success: true,
      basketId,
      orderIds: createdOrderIds,
      totalMarginRequired: requiredBasketMargin,
      nakedMarginRequired: hedgedCalc.nakedMarginRequired,
      marginBenefit: hedgedCalc.marginBenefit,
      spreadsDetected: hedgedCalc.spreadsDetected
    };
  }
}
