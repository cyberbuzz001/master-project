import { query, queryOne, execute, withTransaction } from '../db/schema';
import { MarketDataEngine } from '../marketData/MarketDataEngine';
import { MarketTick } from '../marketData/types';
import { VirtualWalletLedger } from './VirtualWalletLedger';
import { PortfolioService } from './PortfolioService';
import { generateUUID } from '../utils/crypto';
import { SymbologyNormalizer } from '../marketData/SymbologyNormalizer';
import { GreeksEngine } from '../marketData/GreeksEngine';
import { emitAdminOrderEvent, emitAdminTradeEvent, emitAdminPositionUpdate, emitAdminFundsUpdate } from '../utils/adminEventBus';
import { gttEngine } from './GttEngine';
import { priceAlertEngine } from './PriceAlertEngine';

export function isIndianMarketOpen(): boolean {
  const now = new Date();
  const utcHours = now.getUTCHours();
  const utcMinutes = now.getUTCMinutes();
  const istMinutes = (utcHours * 60 + utcMinutes + 330) % 1440;
  const day = now.getUTCDay();
  if (day === 0 || day === 6) return false;
  return istMinutes >= 555 && istMinutes <= 930;
}

export class ExecutionEngine {
  private static timer: NodeJS.Timeout | null = null;
  private static repairTimer: NodeJS.Timeout | null = null;
  private static isSubscribedToTicks = false;

  // ── High-Speed In-Memory Pending Order Index ──────────────────────────────
  // Keyed by normalized token/symbol -> Map<orderId, orderObj>
  private static pendingOrdersByToken = new Map<string, Map<string, any>>();

  public static start(): void {
    console.log('[ExecutionEngine] Starting Event-Driven & In-Memory Matching Engine...');
    if (this.timer) clearInterval(this.timer);
    if (this.repairTimer) clearInterval(this.repairTimer);

    // Initialize GTT trigger engine and Price Alert engine
    void gttEngine.initialize();
    void priceAlertEngine.initialize();

    // Auto-heal any orphaned EXECUTING orders on startup
    execute(
      `UPDATE orders SET status = 'ACCEPTED', updated_at = NOW() 
       WHERE status = 'EXECUTING' AND id NOT IN (SELECT order_id FROM executions)`
    ).catch(() => {});
    execute(
      `UPDATE orders SET status = 'FILLED', filled_quantity = quantity, updated_at = NOW() 
       WHERE status = 'EXECUTING' AND id IN (SELECT order_id FROM executions)`
    ).catch(() => {});

    // Hook directly into real-time MarketDataEngine tick stream for sub-millisecond fills & triggers
    if (!this.isSubscribedToTicks) {
      MarketDataEngine.getInstance().onTick((tick: MarketTick) => {
        this.onMarketTick(tick);
        void gttEngine.onMarketTick(tick);
        void priceAlertEngine.onMarketTick(tick);
      });
      this.isSubscribedToTicks = true;
    }

    // Run passive background safety & reconciliation cycle every 500ms
    this.timer = setInterval(() => {
      this.processPendingOrders().catch(err => {
        if (process.env.DEBUG_ORDER_ENGINE === 'true') {
          console.error('[ExecutionEngine] Reconciliation cycle warning:', err.message);
        }
      });
    }, 500);

    // Run position audit/repair every 60 seconds
    this.repairTimer = setInterval(() => {
      PortfolioService.auditAndRepairAllPositions().catch(() => {});
    }, 60000);
  }

  public static stop(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.repairTimer) clearInterval(this.repairTimer);
  }

  /**
   * Register a pending order into the high-speed in-memory matching tree.
   */
  public static registerPendingOrder(order: any): void {
    if (!order || !order.id) return;
    const tokens = [
      order.instrument_token,
      order.symbol,
      ...(order.symbol ? SymbologyNormalizer.normalizeToken(order.symbol) : []),
      ...(order.instrument_token ? SymbologyNormalizer.normalizeToken(order.instrument_token) : [])
    ].filter(Boolean);

    tokens.forEach(t => {
      if (!this.pendingOrdersByToken.has(t)) {
        this.pendingOrdersByToken.set(t, new Map());
      }
      this.pendingOrdersByToken.get(t)!.set(order.id, order);
    });
  }

  /**
   * Remove a completed/cancelled order from the in-memory matching tree.
   */
  public static unregisterPendingOrder(orderId: string): void {
    if (!orderId) return;
    this.pendingOrdersByToken.forEach(orderMap => {
      orderMap.delete(orderId);
    });
  }

  /**
   * High-Speed Event-Driven Tick Handler:
   * Matches pending orders immediately upon incoming Dhan live tick arrival (<500μs).
   */
  public static onMarketTick(tick: MarketTick): void {
    if (!tick || !tick.instrumentToken || tick.ltp <= 0) return;

    const possibleKeys = [
      tick.instrumentToken,
      ...SymbologyNormalizer.normalizeToken(tick.instrumentToken)
    ];

    const matchedOrders: any[] = [];

    for (const key of possibleKeys) {
      const orderMap = this.pendingOrdersByToken.get(key);
      if (orderMap && orderMap.size > 0) {
        orderMap.forEach((order) => {
          if (!order.isEvaluating) {
            matchedOrders.push(order);
          }
        });
      }
    }

    if (matchedOrders.length === 0) return;

    const ltp = tick.ltp;
    const bidPrice = tick.bid && tick.bid > 0 ? tick.bid : ltp;
    const askPrice = tick.ask && tick.ask > 0 ? tick.ask : ltp;

    for (const order of matchedOrders) {
      const price = parseFloat(order.price || '0');
      const trigPrice = parseFloat(order.trigger_price || '0');
      let executePrice: number | null = null;

      if (order.order_type === 'MARKET') {
        executePrice = order.side === 'BUY' ? askPrice : bidPrice;
      } else if (order.order_type === 'LIMIT') {
        if (order.side === 'BUY' && askPrice <= price) {
          executePrice = price;
        } else if (order.side === 'SELL' && bidPrice >= price) {
          executePrice = price;
        }
      } else if (order.order_type === 'SL' || order.order_type === 'SL_M') {
        if (order.side === 'BUY' && askPrice >= trigPrice) {
          executePrice = order.order_type === 'SL_M' ? askPrice : price;
        } else if (order.side === 'SELL' && bidPrice <= trigPrice) {
          executePrice = order.order_type === 'SL_M' ? bidPrice : price;
        }
      }

      if (executePrice && executePrice > 0) {
        order.isEvaluating = true;
        this.unregisterPendingOrder(order.id);

        const isBsModel = (tick as any)?.bidQty === 500 && (tick as any)?.askQty === 500;
        const freshnessTag = (Date.now() - (tick.timestamp || Date.now()) <= 15000)
          ? 'live'
          : (isBsModel ? 'synthetic_skew' : 'cached_stale');
        const fillLogic = order.order_type === 'MARKET'
          ? (order.side === 'BUY' ? 'MARKET_ASK' : 'MARKET_BID')
          : (order.order_type === 'LIMIT' ? 'LIMIT_MATCH' : 'STOP_LOSS');

        const provenance = {
          tickSource: isBsModel ? 'BLACK_SCHOLES_SYNTHETIC' : 'LIVE_FEED',
          tickTimestamp: tick.timestamp || Date.now(),
          tickLtp: tick.ltp,
          tickBid: bidPrice,
          tickAsk: askPrice,
          freshnessTag,
          fillLogic
        };

        // Execute immediately in asynchronous microtask
        setImmediate(async () => {
          try {
            const claimed = await queryOne<any>(
              `UPDATE orders SET status = 'EXECUTING', updated_at = NOW() 
               WHERE id = $1 AND (status IN ('ACCEPTED', 'PENDING') OR (status = 'EXECUTING' AND updated_at < NOW() - INTERVAL '3 seconds')) 
               RETURNING id`,
              [order.id]
            );

            if (claimed) {
              await this.executeOrder(order, executePrice!, provenance);
            }
          } catch (err: any) {
            order.isEvaluating = false;
            this.registerPendingOrder(order);
          }
        });
      }
    }
  }

  public static async processPendingOrders(): Promise<void> {
    try {
      const pendingOrders = await query<any>(
        `SELECT * FROM orders 
         WHERE status IN ('ACCEPTED', 'PENDING') 
            OR (status = 'EXECUTING' AND updated_at < NOW() - INTERVAL '3 seconds') 
         ORDER BY created_at ASC LIMIT 50`
      );

      if (pendingOrders.length === 0) return;

      // Sync active DB orders into in-memory matching index
      for (const order of pendingOrders) {
        this.registerPendingOrder(order);

        const engine = MarketDataEngine.getInstance();
        let tick: MarketTick | undefined | null = undefined;

        const symbolAliases = [
          ...(order.symbol ? SymbologyNormalizer.normalizeToken(order.symbol) : []),
          ...(order.instrument_token ? SymbologyNormalizer.normalizeToken(order.instrument_token) : [])
        ];

        for (const alias of symbolAliases) {
          tick = engine.getCachedTick(alias);
          if (tick && tick.ltp > 0) break;
        }

        if (!tick && (order.instrument_token || order.symbol)) {
          engine.subscribe([order.instrument_token || order.symbol]);
          continue;
        }

        const STALENESS_THRESHOLD_MS = 30000;
        const isStale = tick ? (Date.now() - tick.timestamp > STALENESS_THRESHOLD_MS) : true;
        if (!tick || isStale) continue;

        const price     = parseFloat(order.price || '0');
        const trigPrice = parseFloat(order.trigger_price || '0');
        const ltp       = tick.ltp;
        const bidPrice  = tick.bid && tick.bid > 0 ? tick.bid : ltp;
        const askPrice  = tick.ask && tick.ask > 0 ? tick.ask : ltp;
        let executePrice: number | null = null;

        if (order.order_type === 'MARKET') {
          executePrice = order.side === 'BUY' ? askPrice : bidPrice;
        } else if (order.order_type === 'LIMIT') {
          if (order.side === 'BUY' && askPrice <= price) executePrice = price;
          if (order.side === 'SELL' && bidPrice >= price) executePrice = price;
        } else if (order.order_type === 'SL' || order.order_type === 'SL_M') {
          if (order.side === 'BUY' && askPrice >= trigPrice) executePrice = order.order_type === 'SL_M' ? askPrice : price;
          if (order.side === 'SELL' && bidPrice <= trigPrice) executePrice = order.order_type === 'SL_M' ? bidPrice : price;
        }

        if (executePrice && executePrice > 0) {
          let claimed: any = null;
          try {
            claimed = await queryOne<any>(
              `UPDATE orders SET status = 'EXECUTING', updated_at = NOW() 
               WHERE id = $1 AND (status IN ('ACCEPTED', 'PENDING') OR (status = 'EXECUTING' AND updated_at < NOW() - INTERVAL '3 seconds')) 
               RETURNING id`,
              [order.id]
            );
          } catch (err: any) {
            if (process.env.DEBUG_ORDER_ENGINE === 'true') {
              console.warn(`[ExecutionEngine] Order claim warning for ${order.id}:`, err.message);
            }
          }

          if (!claimed) continue;
          this.unregisterPendingOrder(order.id);

          const isBsModel = (tick as any)?.bidQty === 500 && (tick as any)?.askQty === 500;
          const freshnessTag = (Date.now() - (tick.timestamp || Date.now()) <= 15000)
            ? 'live'
            : (isBsModel ? 'synthetic_skew' : 'cached_stale');
          const fillLogic = order.order_type === 'MARKET'
            ? (order.side === 'BUY' ? 'MARKET_ASK' : 'MARKET_BID')
            : (order.order_type === 'LIMIT' ? 'LIMIT_MATCH' : 'STOP_LOSS');

          const provenance = {
            tickSource: isBsModel ? 'BLACK_SCHOLES_SYNTHETIC' : 'LIVE_FEED',
            tickTimestamp: tick.timestamp || Date.now(),
            tickLtp: tick.ltp,
            tickBid: bidPrice,
            tickAsk: askPrice,
            freshnessTag,
            fillLogic
          };

          try {
            await this.executeOrder(order, executePrice, provenance);
          } catch (err: any) {
            if (process.env.DEBUG_ORDER_ENGINE === 'true') {
              console.error(`[ExecutionEngine] Failed to execute order ${order.order_id}:`, err.message);
            }
            await execute(`UPDATE orders SET status = 'ACCEPTED', updated_at = NOW() WHERE id = $1`, [order.id]).catch(() => {});
          }
        }
      }
    } catch (err: any) {
      if (process.env.DEBUG_ORDER_ENGINE === 'true') {
        console.warn('[ExecutionEngine] Transient error processing pending orders:', err.message);
      }
    }

    // Evaluate Position-Level Stop Loss and Trailing Stop Loss
    await this.processPositionTrailingStopLosses();
  }

  /**
   * Evaluates active positions with Stop-Loss or Trailing Stop-Loss rules.
   * Dynamically trails stop_loss_price as LTP moves favorably, and triggers
   * market square-off when the SL threshold is breached.
   */
  public static async processPositionTrailingStopLosses(): Promise<void> {
    try {
      const positionsWithSl = await query<any>(
        `SELECT p.*, u.username 
         FROM positions p
         JOIN users u ON u.id = p.user_id
         WHERE p.stop_loss_price IS NOT NULL 
           AND p.net_qty != 0`
      );

      if (positionsWithSl.length === 0) return;

      const engine = MarketDataEngine.getInstance();

      for (const pos of positionsWithSl) {
        const netQty = parseInt(pos.net_qty, 10);
        if (netQty === 0) continue;

        let tick: MarketTick | undefined = undefined;
        const aliases = [
          pos.symbol,
          ...SymbologyNormalizer.normalizeToken(pos.symbol)
        ];

        for (const alias of aliases) {
          tick = engine.getCachedTick(alias);
          if (tick && tick.ltp > 0) break;
        }

        if (!tick || tick.ltp <= 0) {
          engine.subscribe([pos.symbol]);
          continue;
        }

        const ltp = tick.ltp;
        const currentSl = parseFloat(pos.stop_loss_price);
        const step = parseFloat(pos.trailing_sl_step || '0');
        const jump = parseFloat(pos.trailing_sl_jump || '0');

        if (netQty > 0) {
          // LONG POSITION
          const baseRef = parseFloat(pos.highest_ltp_since_sl || pos.average_price || String(ltp));

          if (step > 0 && jump > 0 && ltp >= baseRef + jump) {
            const jumpsCount = Math.floor((ltp - baseRef) / jump);
            const newSl = currentSl + (jumpsCount * step);
            const newHighestRef = baseRef + (jumpsCount * jump);

            await execute(
              `UPDATE positions 
               SET stop_loss_price = $1, highest_ltp_since_sl = $2, updated_at = NOW() 
               WHERE id = $3`,
              [newSl, newHighestRef, pos.id]
            );
            console.log(`[ExecutionEngine] 📈 Trailed Stop-Loss for Long ${pos.symbol} (User: ${pos.username}): New SL ₹${newSl.toFixed(2)} (LTP: ₹${ltp.toFixed(2)})`);
          }

          // Trigger SL if LTP drops below current SL price
          if (ltp <= currentSl) {
            console.log(`[ExecutionEngine] 🛑 Triggering Trailing Stop-Loss for Long ${pos.symbol} (User: ${pos.username}): LTP ₹${ltp.toFixed(2)} <= SL ₹${currentSl.toFixed(2)}`);
            const { executeSquareOff } = require('./RmsSquareOffAction');
            await executeSquareOff(pos, {
              mode: 'LIVE',
              reason: `Trailing Stop-Loss Triggered (LTP: ₹${ltp.toFixed(2)} <= SL: ₹${currentSl.toFixed(2)})`,
              eventType: 'TRAILING_STOP_LOSS'
            });
          }
        } else {
          // SHORT POSITION
          const baseRef = parseFloat(pos.lowest_ltp_since_sl || pos.average_price || String(ltp));

          if (step > 0 && jump > 0 && ltp <= baseRef - jump) {
            const jumpsCount = Math.floor((baseRef - ltp) / jump);
            const newSl = currentSl - (jumpsCount * step);
            const newLowestRef = baseRef - (jumpsCount * jump);

            await execute(
              `UPDATE positions 
               SET stop_loss_price = $1, lowest_ltp_since_sl = $2, updated_at = NOW() 
               WHERE id = $3`,
              [newSl, newLowestRef, pos.id]
            );
            console.log(`[ExecutionEngine] 📉 Trailed Stop-Loss for Short ${pos.symbol} (User: ${pos.username}): New SL ₹${newSl.toFixed(2)} (LTP: ₹${ltp.toFixed(2)})`);
          }

          // Trigger SL if LTP rises above current SL price
          if (ltp >= currentSl) {
            console.log(`[ExecutionEngine] 🛑 Triggering Trailing Stop-Loss for Short ${pos.symbol} (User: ${pos.username}): LTP ₹${ltp.toFixed(2)} >= SL ₹${currentSl.toFixed(2)}`);
            const { executeSquareOff } = require('./RmsSquareOffAction');
            await executeSquareOff(pos, {
              mode: 'LIVE',
              reason: `Trailing Stop-Loss Triggered (LTP: ₹${ltp.toFixed(2)} >= SL: ₹${currentSl.toFixed(2)})`,
              eventType: 'TRAILING_STOP_LOSS'
            });
          }
        }
      }
    } catch (err: any) {
      if (process.env.DEBUG_ORDER_ENGINE === 'true') {
        console.error('[ExecutionEngine] Position Trailing SL error:', err.message);
      }
    }
  }

  public static async executeOrder(
    order: any, 
    price: number,
    provenance?: {
      tickSource?: string;
      tickTimestamp?: number;
      tickLtp?: number;
      tickBid?: number;
      tickAsk?: number;
      freshnessTag?: string;
      fillLogic?: string;
    }
  ): Promise<void> {
    // Cheap fast-path check outside the transaction
    const existingExec = await queryOne<any>(
      'SELECT id FROM executions WHERE order_id = $1',
      [order.id]
    );
    if (existingExec) {
      // Ensure order status is finalized to FILLED so it is never left stuck in EXECUTING
      await execute(
        `UPDATE orders SET status = 'FILLED', filled_quantity = quantity, average_price = COALESCE(average_price, $1), updated_at = NOW() WHERE id = $2 AND status != 'FILLED'`,
        [price, order.id]
      ).catch(() => {});
      return;
    }

    const tradeId  = 'trd_' + generateUUID();
    const excId    = 'exc_' + generateUUID();
    const qty      = parseInt(order.quantity, 10);
    const tradeVal = price * qty;

    // Zero Charges & Zero Tax Policy
    const brokerage       = 0.00;
    const stt             = 0.00;
    const exchangeCharges = 0.00;
    const gst             = 0.00;
    const stampDuty       = 0.00;
    const totalCharges    = 0.00;

    const exitReason = order.source === 'RMS'
      ? 'RMS_AUTO_SQUARE_OFF'
      : (order.order_type === 'LIMIT'
        ? 'TARGET_LIMIT'
        : (order.order_type === 'MARKET' ? 'MARKET_SQUARE_OFF' : 'STOP_LOSS'));

    const posResult = await withTransaction(async (client) => {
      // B1 fix: the real idempotency guard. The `existingExec` check above runs outside any
      // lock, so two near-simultaneous executeOrder calls for the same order (e.g. an admin
      // force-execute racing the engine's own periodic pending-order sweep) could both pass it
      // before either has inserted an execution row, and both would then fill the same order
      // twice — doubling the resulting position and cash/P&L impact. Making the order's FILLED
      // transition itself the atomic guard (first statement, in this transaction) closes that:
      // only one caller's UPDATE can match status IN (...) and return a row.
      const statusUpd = await client.query(
        `UPDATE orders SET status = 'FILLED', filled_quantity = quantity, average_price = $1, updated_at = NOW()
         WHERE id = $2 AND status IN ('ACCEPTED', 'PENDING', 'EXECUTING')
         RETURNING id`,
        [price, order.id]
      );
      if (statusUpd.rows.length === 0) {
        return null;
      }

      // 1. Record execution fill with Immutable Provenance
      await client.query(
        `INSERT INTO executions (
          id, order_id, user_id, trade_id, symbol, exchange, side, quantity, price, 
          brokerage, stt, gst, exchange_charges, total_charges,
          tick_source, tick_timestamp, tick_ltp, tick_bid, tick_ask, freshness_tag, fill_logic
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, 
          $10, $11, $12, $13, $14,
          $15, $16, $17, $18, $19, $20, $21
        )`,
        [
          excId, order.id, order.user_id, tradeId,
          order.symbol, order.exchange || 'NSE', order.side,
          qty, price, brokerage, stt, gst, exchangeCharges, totalCharges,
          provenance?.tickSource || 'LIVE_FEED',
          provenance?.tickTimestamp || Date.now(),
          provenance?.tickLtp || price,
          provenance?.tickBid || price,
          provenance?.tickAsk || price,
          provenance?.freshnessTag || 'live',
          provenance?.fillLogic || 'MARKET'
        ]
      );

      // 2. (order status already transitioned to FILLED above, atomically)

      // 3. Record order event audit trail
      await client.query(
        `INSERT INTO order_events (id, order_id, from_status, to_status, reason, actor, metadata)
         VALUES ($1, $2, 'ACCEPTED', 'FILLED', $3, 'EXECUTION_ENGINE', $4)`,
        [
          'evt_' + generateUUID(),
          order.id,
          `Execution fill @ ₹${price.toFixed(2)} (${exitReason}) [Freshness: ${provenance?.freshnessTag || 'live'}]`,
          JSON.stringify({ 
            fillPrice: price, 
            quantity: qty, 
            exitReason, 
            tradeId, 
            excId, 
            provenance: provenance || {} 
          })
        ]
      );

      // 4. Update Position & record permanent per-trade P&L in closed_trades
      const res = await PortfolioService.recordExecutionInTransaction(
        client,
        order.user_id,
        order.symbol,
        order.exchange || 'NSE',
        order.product_type || 'MIS',
        order.side as 'BUY' | 'SELL',
        qty,
        price,
        exitReason,
        order.id,
        excId
      );

      // 5. Settle Virtual Money Ledger atomically (used_margin is recomputed
      // inside settleTradeExecutionInTransaction from the now-updated
      // position + any other pending orders — no separate blockedMargin calc)
      await VirtualWalletLedger.settleTradeExecutionInTransaction(
        client,
        order.user_id,
        order.side as 'BUY' | 'SELL',
        tradeVal,
        res.releasedPositionCapital,
        res.realizedPnlDelta,
        order.order_id
      );

      // 5b. War Room 1,000 Users Milestone: Record First Trade Activation
      try {
        const { WarRoomService } = await import('../services/WarRoomService');
        void WarRoomService.getInstance().recordActivation(order.user_id, order.id, 'FIRST_ORDER_FILLED').catch(() => {});
      } catch (_) {}

      // 6. Record in-app notification for the user
      await client.query(
        `INSERT INTO notifications (id, user_id, type, title, body, metadata)
         VALUES ($1, $2, 'ORDER_FILLED', $3, $4, $5)`,
        [
          'notif_' + generateUUID(),
          order.user_id,
          `Order Executed: ${order.side} ${qty} ${order.symbol}`,
          `Your ${order.side} order for ${qty} ${order.symbol} was filled at ₹${price.toFixed(2)}.`,
          JSON.stringify({ orderId: order.order_id, symbol: order.symbol, side: order.side, qty, price, tradeId })
        ]
      ).catch(() => {});

      try {
        const { deliverToUser } = await import('../websocket/server');
        deliverToUser(order.user_id, {
          type: 'NOTIFICATION',
          data: {
            type: 'ORDER_FILLED',
            title: `Order Executed: ${order.side} ${qty} ${order.symbol}`,
            body: `Your ${order.side} order for ${qty} ${order.symbol} was filled at ₹${price.toFixed(2)}.`,
            metadata: { orderId: order.order_id, symbol: order.symbol, side: order.side, qty, price, tradeId }
          }
        });
      } catch (_) {}

      return res;
    });

    if (posResult === null) {
      console.log(`[ExecutionEngine] Skipped: order ${order.order_id} was already filled/cancelled/rejected by another request.`);
      return;
    }

    console.log(`[ExecutionEngine] EXECUTION SUCCESS: Order ${order.order_id} filled @ ₹${price.toFixed(2)} (Qty: ${qty}, ExitReason: ${exitReason}, Realized P&L: ₹${(posResult?.realizedPnlDelta || 0).toFixed(2)})`);

    emitAdminOrderEvent(order.user_id, 'ORDER_UPDATED', { ...order, status: 'FILLED', filled_quantity: qty, average_price: price });
    emitAdminTradeEvent(order.user_id, {
      tradeId, symbol: order.symbol, side: order.side, quantity: qty, price,
      exitReason, realizedPnl: posResult?.realizedPnlDelta || 0,
    });
    // Thin signals only — Customer360/OrderMonitor/FundsDashboard already refetch the full
    // positions/wallet state via REST on receipt, matching the pattern this file's admin
    // event consumers already use for USER_STATUS_UPDATED etc. Avoids extra DB reads here,
    // on the 500ms hot-path matching loop, just to build a full payload nothing needs.
    emitAdminPositionUpdate(order.user_id, []);
    emitAdminFundsUpdate(order.user_id, null);

    // 7. Dispatch asynchronous trade confirmation email to client
    setImmediate(async () => {
      try {
        const { queryOne } = await import('../db/schema');
        const user = await queryOne<{ id: string; email: string; full_name?: string }>(
          'SELECT id, email, full_name FROM users WHERE id = $1',
          [order.user_id]
        );
        if (user && user.email) {
          const { EmailService } = await import('../services/EmailService');
          await EmailService.getInstance().sendOrderExecutionEmail(user, {
            orderId: order.order_id,
            symbol: order.symbol,
            side: order.side as 'BUY' | 'SELL',
            quantity: qty,
            price,
            orderType: order.order_type || 'MARKET',
            timestamp: Date.now(),
          });
        }
      } catch (err: any) {
        console.warn('[ExecutionEngine] Failed to trigger trade confirmation email:', err.message);
      }
    });
  }
}
