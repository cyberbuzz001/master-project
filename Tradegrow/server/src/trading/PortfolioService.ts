import { query, queryOne, execute, withTransaction } from '../db/schema';
import { MarketDataEngine } from '../marketData/MarketDataEngine';
import { generateUUID } from '../utils/crypto';
import { resolveUnrealizedPnlForPosition } from './MarginMath';

export interface PositionRecord {
  id: string;
  userId: string;
  symbol: string;
  exchange: string;
  productType: string;
  buyQty: number;
  sellQty: number;
  netQty: number;
  buyPrice: number;
  sellPrice: number;
  averagePrice: number;
  ltp: number;
  realizedPnl: number;
  unrealizedPnl: number;
  stopLossPrice?: number | null;
  trailingSlStep?: number | null;
  trailingSlJump?: number | null;
}

export interface HoldingRecord {
  id: string;
  userId: string;
  symbol: string;
  exchange: string;
  quantity: number;
  averagePrice: number;
  ltp: number;
  currentValue: number;
  pnl: number;
  pnlPercentage: number;
}

export interface RecordExecutionResult {
  realizedPnlDelta: number;
  closedQty: number;
  closedEntryPrice: number;
  releasedPositionCapital: number;
  netQtyAfter: number;
  avgPriceAfter: number;
}

export class PortfolioService {
  /**
   * Update position upon execution of a trade within an active transaction.
   * Handles Long & Short Position averaging, Partial Exits, Short Covering, Position Flips, and Realized/Unrealized P&L calculations.
   */
  public static async recordExecutionInTransaction(
    client: any,
    userId: string,
    symbol: string,
    exchange: string,
    productType: string,
    side: 'BUY' | 'SELL',
    quantity: number,
    price: number,
    exitReason?: string,
    exitOrderId?: string,
    executionId?: string
  ): Promise<RecordExecutionResult> {
    const engine = MarketDataEngine.getInstance();
    const tick = engine.getCachedTick(`NSE_${symbol}`) ||
                 engine.getCachedTick(`NFO_${symbol}`) ||
                 engine.getCachedTick(`BFO_${symbol}`) ||
                 engine.getCachedTick(symbol) ||
                 { ltp: price };
    const ltp = tick.ltp > 0 ? tick.ltp : price;

    const existing = await client.query(
      'SELECT * FROM positions WHERE user_id = $1 AND symbol = $2 AND product_type = $3 FOR UPDATE',
      [userId, symbol, productType]
    );

    let realizedPnlDelta = 0;
    let closedQty = 0;
    let closedEntryPrice = 0;
    let releasedPositionCapital = 0;
    let netQtyAfter = 0;
    let avgPriceAfter = 0;

    if (existing.rows.length === 0) {
      // New Position Initialization
      const buyQty       = side === 'BUY' ? quantity : 0;
      const sellQty      = side === 'SELL' ? quantity : 0;
      const netQty       = buyQty - sellQty;
      const buyPrice     = side === 'BUY' ? price : 0;
      const sellPrice    = side === 'SELL' ? price : 0;
      const averagePrice = price;
      const unrealizedPnl = netQty > 0 ? netQty * (ltp - averagePrice) : Math.abs(netQty) * (averagePrice - ltp);

      await client.query(
        `INSERT INTO positions (id, user_id, symbol, exchange, product_type, buy_qty, sell_qty, net_qty, buy_price, sell_price, average_price, ltp, realized_pnl, unrealized_pnl)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0.0, $13)`,
        ['pos_' + generateUUID(), userId, symbol, exchange, productType, buyQty, sellQty, netQty, buyPrice, sellPrice, averagePrice, ltp, unrealizedPnl]
      );

      netQtyAfter = netQty;
      avgPriceAfter = averagePrice;
    } else {
      const row = existing.rows[0];
      let buyQty      = parseInt(row.buy_qty, 10) || 0;
      let sellQty     = parseInt(row.sell_qty, 10) || 0;
      let buyPrice    = parseFloat(row.buy_price) || 0;
      let sellPrice   = parseFloat(row.sell_price) || 0;
      let realizedPnl = parseFloat(row.realized_pnl) || 0;
      const currentNet = buyQty - sellQty;

      if (currentNet > 0) {
        // ── CURRENT POSITION IS LONG (netQty > 0) ─────────────────────────
        if (side === 'BUY') {
          // Adding to Long Position (Weighted Average Entry Price)
          const totalVal = (buyQty * (buyPrice > 0 ? buyPrice : price)) + (quantity * price);
          buyQty += quantity;
          buyPrice = buyQty > 0 ? totalVal / buyQty : price;
        } else {
          // Selling (Closing Long or Flipping Short)
          closedQty = Math.min(currentNet, quantity);
          closedEntryPrice = buyPrice > 0 ? buyPrice : (sellPrice > 0 ? sellPrice : price);
          realizedPnlDelta = closedQty * (price - closedEntryPrice);
          releasedPositionCapital = closedQty * closedEntryPrice;
          realizedPnl += realizedPnlDelta;

          const remainingShortQty = quantity - closedQty;
          if (remainingShortQty > 0) {
            // Flipped to Short
            buyQty = 0;
            buyPrice = 0;
            sellQty = remainingShortQty;
            sellPrice = price;
          } else {
            sellQty += quantity;
            if (sellPrice === 0) sellPrice = price;
          }
        }
      } else if (currentNet < 0) {
        // ── CURRENT POSITION IS SHORT (netQty < 0) ────────────────────────
        const currentShortQty = Math.abs(currentNet);
        if (side === 'SELL') {
          // Adding to Short Position (Weighted Average Entry Price)
          const totalVal = (currentShortQty * (sellPrice > 0 ? sellPrice : price)) + (quantity * price);
          sellQty += quantity;
          sellPrice = sellQty > 0 ? totalVal / sellQty : price;
        } else {
          // Buying (Covering Short or Flipping Long)
          closedQty = Math.min(currentShortQty, quantity);
          closedEntryPrice = sellPrice > 0 ? sellPrice : (buyPrice > 0 ? buyPrice : price);
          realizedPnlDelta = closedQty * (closedEntryPrice - price);
          releasedPositionCapital = closedQty * closedEntryPrice;
          realizedPnl += realizedPnlDelta;

          const remainingLongQty = quantity - closedQty;
          if (remainingLongQty > 0) {
            // Flipped to Long
            sellQty = 0;
            sellPrice = 0;
            buyQty = remainingLongQty;
            buyPrice = price;
          } else {
            buyQty += quantity;
            if (buyPrice === 0) buyPrice = price;
          }
        }
      } else {
        // Position was flat (netQty === 0)
        if (side === 'BUY') {
          buyQty = quantity;
          buyPrice = price;
          sellQty = 0;
          sellPrice = 0;
        } else {
          sellQty = quantity;
          sellPrice = price;
          buyQty = 0;
          buyPrice = 0;
        }
      }

      const netQty = buyQty - sellQty;
      const averagePrice = netQty > 0
        ? (buyPrice > 0 ? buyPrice : price)
        : (netQty < 0 ? (sellPrice > 0 ? sellPrice : price) : 0);
      const unrealizedPnl = netQty > 0
        ? netQty * (ltp - averagePrice)
        : netQty < 0
        ? Math.abs(netQty) * (averagePrice - ltp)
        : 0;

      await client.query(
        `UPDATE positions
         SET buy_qty = $1, sell_qty = $2, net_qty = $3, buy_price = $4, sell_price = $5,
             average_price = $6, ltp = $7, realized_pnl = $8, unrealized_pnl = $9, updated_at = NOW()
         WHERE id = $10`,
        [buyQty, sellQty, netQty, buyPrice, sellPrice, averagePrice, ltp, realizedPnl, unrealizedPnl, row.id]
      );

      netQtyAfter = netQty;
      avgPriceAfter = averagePrice;
    }

    // Record permanent per-trade P&L record when position is closed/partially exited
    if (closedQty > 0) {
      const entrySide = side === 'SELL' ? 'BUY' : 'SELL';
      const exitSide  = side;
      const grossPnl  = realizedPnlDelta;
      const netPnl    = grossPnl;
      const instToken = `NSE_${symbol}`;
      const execIdVal = executionId || ('exc_' + generateUUID());

      try {
        await client.query(
          `INSERT INTO closed_trades (
             id, user_id, position_id, instrument_token, symbol, exchange, product_type,
             entry_side, exit_side, quantity, entry_price, exit_price, gross_pnl, charges, net_pnl,
             exit_reason, exit_order_id, execution_id
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 0.0, $14, $15, $16, $17)
           ON CONFLICT (execution_id) DO NOTHING`,
          [
            'trd_' + generateUUID(),
            userId,
            existing.rows[0]?.id || null,
            instToken,
            symbol,
            exchange,
            productType,
            entrySide,
            exitSide,
            closedQty,
            closedEntryPrice,
            price,
            grossPnl,
            netPnl,
            exitReason || 'MANUAL_EXIT',
            exitOrderId || null,
            execIdVal
          ]
        );
      } catch (err: any) {
        console.error('[PortfolioService] Failed to record closed trade:', err.message);
      }
    }

    // Update delivery holdings if CNC product type
    if (productType === 'CNC') {
      await PortfolioService.updateHoldingsInTransaction(client, userId, symbol, exchange, side, quantity, price, ltp);
    }

    return {
      realizedPnlDelta,
      closedQty,
      closedEntryPrice,
      releasedPositionCapital,
      netQtyAfter,
      avgPriceAfter
    };
  }

  public static async recordExecution(
    userId: string,
    symbol: string,
    exchange: string,
    productType: string,
    side: 'BUY' | 'SELL',
    quantity: number,
    price: number,
    exitReason?: string,
    exitOrderId?: string,
    executionId?: string
  ): Promise<RecordExecutionResult> {
    let result: RecordExecutionResult = {
      realizedPnlDelta: 0,
      closedQty: 0,
      closedEntryPrice: 0,
      releasedPositionCapital: 0,
      netQtyAfter: 0,
      avgPriceAfter: 0
    };

    await withTransaction(async (client) => {
      result = await PortfolioService.recordExecutionInTransaction(
        client, userId, symbol, exchange, productType, side, quantity, price, exitReason, exitOrderId, executionId
      );
    });

    return result;
  }

  private static async updateHoldingsInTransaction(
    client: any,
    userId: string,
    symbol: string,
    exchange: string,
    side: 'BUY' | 'SELL',
    quantity: number,
    price: number,
    ltp: number
  ): Promise<void> {
    const existingResult = await client.query(
      'SELECT * FROM holdings WHERE user_id = $1 AND symbol = $2 FOR UPDATE',
      [userId, symbol]
    );
    const existing = existingResult.rows[0];

    if (side === 'BUY') {
      if (!existing) {
        const pnl    = quantity * (ltp - price);
        const pnlPct = price > 0 ? (pnl / (quantity * price)) * 100 : 0;
        await client.query(
          `INSERT INTO holdings (id, user_id, symbol, exchange, quantity, average_price, ltp, current_value, pnl, pnl_percentage)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          ['hld_' + generateUUID(), userId, symbol, exchange, quantity, price, ltp, quantity * ltp, pnl, pnlPct]
        );
      } else {
        const newQty       = parseInt(existing.quantity, 10) + quantity;
        const newAvgPrice  = ((parseInt(existing.quantity, 10) * parseFloat(existing.average_price)) + (quantity * price)) / newQty;
        const currentValue = newQty * ltp;
        const pnl          = newQty * (ltp - newAvgPrice);
        const pnlPct       = newAvgPrice > 0 ? (pnl / (newQty * newAvgPrice)) * 100 : 0;
        await client.query(
          `UPDATE holdings SET quantity = $1, average_price = $2, ltp = $3, current_value = $4, pnl = $5, pnl_percentage = $6, updated_at = NOW()
           WHERE id = $7`,
          [newQty, newAvgPrice, ltp, currentValue, pnl, pnlPct, existing.id]
        );
      }
    } else if (side === 'SELL') {
      if (!existing) {
        throw new Error(`HOLDINGS_OVERSOLD_ERROR: Attempted to sell CNC holding ${symbol} for user ${userId}, but no holding row exists.`);
      }
      const existingQty = parseInt(existing.quantity, 10);
      const newQty = existingQty - quantity;

      if (newQty < 0) {
        throw new Error(`HOLDINGS_OVERSOLD_ERROR: User ${userId} has ${existingQty} shares of ${symbol}, cannot sell ${quantity} shares.`);
      } else if (newQty === 0) {
        await client.query('DELETE FROM holdings WHERE id = $1', [existing.id]);
      } else {
        const currentValue = newQty * ltp;
        const pnl          = newQty * (ltp - parseFloat(existing.average_price));
        const pnlPct       = parseFloat(existing.average_price) > 0 ? (pnl / (newQty * parseFloat(existing.average_price))) * 100 : 0;
        await client.query(
          `UPDATE holdings SET quantity = $1, ltp = $2, current_value = $3, pnl = $4, pnl_percentage = $5, updated_at = NOW()
           WHERE id = $6`,
          [newQty, ltp, currentValue, pnl, pnlPct, existing.id]
        );
      }
    }
  }

  public static async getUserPositions(userId: string, todayOnly: boolean = true): Promise<PositionRecord[]> {
    let sql = 'SELECT * FROM positions WHERE user_id = $1';
    if (todayOnly) {
      sql += " AND (net_qty != 0 OR updated_at >= (NOW() AT TIME ZONE 'Asia/Kolkata')::date)";
    }
    sql += ' ORDER BY updated_at DESC';

    const rows = await query<any>(sql, [userId]);

    return rows.map(r => {
      const netQty = parseInt(r.net_qty, 10);
      const averagePrice = parseFloat(r.average_price);

      const { ltp, unrealizedPnl } = resolveUnrealizedPnlForPosition({
        symbol: r.symbol || '',
        netQty,
        averagePrice,
        dbLtp: parseFloat(r.ltp || 0),
      });

      return {
        id: r.id,
        userId: r.user_id,
        symbol: r.symbol,
        exchange: r.exchange,
        productType: r.product_type,
        buyQty: parseInt(r.buy_qty, 10),
        sellQty: parseInt(r.sell_qty, 10),
        netQty,
        buyPrice: parseFloat(r.buy_price),
        sellPrice: parseFloat(r.sell_price),
        averagePrice,
        ltp,
        realizedPnl: parseFloat(r.realized_pnl || 0),
        unrealizedPnl,
        stopLossPrice: r.stop_loss_price ? parseFloat(r.stop_loss_price) : null,
        trailingSlStep: r.trailing_sl_step ? parseFloat(r.trailing_sl_step) : null,
        trailingSlJump: r.trailing_sl_jump ? parseFloat(r.trailing_sl_jump) : null,
      };
    });
  }

  public static async clearOldPositions(userId: string): Promise<void> {
    await query(
      `DELETE FROM positions WHERE user_id = $1 AND (net_qty = 0 OR updated_at < (NOW() AT TIME ZONE 'Asia/Kolkata')::date)`,
      [userId]
    );
  }

  public static async getUserHoldings(userId: string): Promise<HoldingRecord[]> {
    const rows = await query<any>('SELECT * FROM holdings WHERE user_id = $1 ORDER BY symbol', [userId]);
    const engine = MarketDataEngine.getInstance();

    return rows.map(r => {
      const tick = engine.getCachedTick(`NSE_${r.symbol}`) || engine.getCachedTick(r.symbol);
      const ltp = tick ? tick.ltp : parseFloat(r.ltp);
      const quantity = parseInt(r.quantity, 10);
      const avgPrice = parseFloat(r.average_price);
      const currentValue = quantity * ltp;
      const pnl = quantity * (ltp - avgPrice);
      const pnlPercentage = avgPrice > 0 ? (pnl / (quantity * avgPrice)) * 100 : 0;

      return {
        id: r.id,
        userId: r.user_id,
        symbol: r.symbol,
        exchange: r.exchange,
        quantity,
        averagePrice: avgPrice,
        ltp,
        currentValue,
        pnl,
        pnlPercentage
      };
    });
  }

  public static async getClosedTrades(userId: string, limit: number = 50, offset: number = 0, todayOnly: boolean = true): Promise<any[]> {
    let sql = 'SELECT * FROM closed_trades WHERE user_id = $1';
    if (todayOnly) {
      sql += " AND closed_at >= (NOW() AT TIME ZONE 'Asia/Kolkata')::date";
    }
    sql += ' ORDER BY closed_at DESC LIMIT $2 OFFSET $3';

    const rows = await query<any>(sql, [userId, limit, offset]);

    return rows.map(r => ({
      id: r.id,
      userId: r.user_id,
      positionId: r.position_id,
      instrumentToken: r.instrument_token,
      symbol: r.symbol,
      exchange: r.exchange,
      productType: r.product_type,
      entrySide: r.entry_side,
      exitSide: r.exit_side,
      quantity: parseInt(r.quantity, 10),
      entryPrice: parseFloat(r.entry_price),
      exitPrice: parseFloat(r.exit_price),
      grossPnl: parseFloat(r.gross_pnl),
      charges: parseFloat(r.charges || 0),
      netPnl: parseFloat(r.net_pnl),
      exitReason: r.exit_reason,
      entryOrderId: r.entry_order_id,
      exitOrderId: r.exit_order_id,
      executionId: r.execution_id,
      closedAt: r.closed_at
    }));
  }

  public static async auditAndRepairAllPositions(): Promise<void> {
    try {
      await execute(`
        UPDATE positions
        SET sell_price = CASE WHEN sell_price = 0 AND buy_price > 0 THEN buy_price WHEN sell_price = 0 THEN ltp ELSE sell_price END,
            buy_price  = CASE WHEN buy_price = 0 AND sell_price > 0 THEN sell_price WHEN buy_price = 0 THEN ltp ELSE buy_price END
        WHERE net_qty != 0 AND (average_price = 0 OR sell_price = 0 OR buy_price = 0);

        UPDATE positions
        SET average_price = CASE 
          WHEN net_qty > 0 THEN (CASE WHEN buy_price > 0 THEN buy_price ELSE ltp END)
          WHEN net_qty < 0 THEN (CASE WHEN sell_price > 0 THEN sell_price ELSE ltp END)
          ELSE 0.00
        END
        WHERE net_qty != 0 AND average_price = 0;
      `);
    } catch (_) {}
  }
}
