import { query, queryOne, execute, withTransaction } from '../db/schema';
import { MarketTick } from '../marketData/types';
import { generateUUID } from '../utils/crypto';
import { OMS } from './OMS';

export interface CreateGttDTO {
  userId: string;
  instrumentToken: string;
  exchange: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price?: number;
  triggerPrice: number;
  orderType?: 'MARKET' | 'LIMIT';
  productType?: 'MIS' | 'CNC' | 'NRML';
  conditionType?: 'SINGLE' | 'OCO';
  stoplossTriggerPrice?: number;
  stoplossPrice?: number;
  targetTriggerPrice?: number;
  targetPrice?: number;
}

export class GttEngine {
  private static instance: GttEngine;
  private activeTokens: Set<string> = new Set();
  private isInitialized = false;

  public static getInstance(): GttEngine {
    if (!GttEngine.instance) {
      GttEngine.instance = new GttEngine();
    }
    return GttEngine.instance;
  }

  public async initialize(): Promise<void> {
    try {
      const rows = await query<{ instrument_token: string }>(
        `SELECT DISTINCT instrument_token FROM gtt_orders WHERE status = 'ACTIVE'`
      );
      this.activeTokens.clear();
      rows.forEach(r => {
        if (r.instrument_token) this.activeTokens.add(r.instrument_token);
      });
      this.isInitialized = true;
      console.log(`[GttEngine] Initialized with ${this.activeTokens.size} active trigger instruments.`);
    } catch (err: any) {
      console.warn('[GttEngine] Initialization fallback:', err.message);
    }
  }

  public async createGtt(dto: CreateGttDTO): Promise<{ success: boolean; triggerId?: string; error?: string }> {
    if (!dto.userId || !dto.symbol || !dto.triggerPrice || dto.triggerPrice <= 0) {
      return { success: false, error: 'Invalid GTT parameters: triggerPrice and symbol required' };
    }

    const id = 'gtt_' + generateUUID();
    const triggerId = 'GTT' + generateUUID().slice(0, 8).toUpperCase();
    const orderType = dto.orderType || 'LIMIT';
    const productType = dto.productType || 'MIS';
    const conditionType = dto.conditionType || 'SINGLE';
    const price = dto.price && dto.price > 0 ? dto.price : dto.triggerPrice;

    try {
      await execute(
        `INSERT INTO gtt_orders (
          id, trigger_id, user_id, instrument_token, exchange, symbol, side,
          quantity, price, trigger_price, order_type, product_type, condition_type,
          stoploss_trigger_price, stoploss_price, target_trigger_price, target_price, status
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'ACTIVE'
        )`,
        [
          id, triggerId, dto.userId, dto.instrumentToken, dto.exchange || 'NSE', dto.symbol,
          dto.side, dto.quantity, price, dto.triggerPrice, orderType, productType, conditionType,
          dto.stoplossTriggerPrice || null, dto.stoplossPrice || null,
          dto.targetTriggerPrice || null, dto.targetPrice || null
        ]
      );

      this.activeTokens.add(dto.instrumentToken);
      this.activeTokens.add(dto.symbol);

      return { success: true, triggerId };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to create GTT order' };
    }
  }

  public async getUserGtts(userId: string, status?: string): Promise<any[]> {
    if (status) {
      return await query(
        `SELECT * FROM gtt_orders WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC`,
        [userId, status.toUpperCase()]
      );
    }
    return await query(
      `SELECT * FROM gtt_orders WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
  }

  public async cancelGtt(userId: string, triggerIdOrId: string): Promise<{ success: boolean; error?: string }> {
    const res = await execute(
      `UPDATE gtt_orders 
       SET status = 'CANCELLED', updated_at = NOW() 
       WHERE (id = $1 OR trigger_id = $1) AND user_id = $2 AND status = 'ACTIVE'`,
      [triggerIdOrId, userId]
    );

    if (res === 0) {
      return { success: false, error: 'Active GTT not found or already executed/cancelled' };
    }

    void this.initialize();
    return { success: true };
  }

  /**
   * Evaluates live tick prices against active GTT triggers.
   * Runs in O(1) via activeTokens pre-filter to avoid unnecessary DB queries.
   */
  public async onMarketTick(tick: MarketTick): Promise<void> {
    if (!tick || tick.ltp <= 0) return;
    if (!this.activeTokens.has(tick.instrumentToken) && !this.activeTokens.has(tick.symbol)) {
      return;
    }

    try {
      const activeGtts = await query<any>(
        `SELECT * FROM gtt_orders 
         WHERE (instrument_token = $1 OR symbol = $2) AND status = 'ACTIVE'`,
        [tick.instrumentToken, tick.symbol]
      );

      if (!activeGtts.length) {
        this.activeTokens.delete(tick.instrumentToken);
        this.activeTokens.delete(tick.symbol);
        return;
      }

      for (const gtt of activeGtts) {
        const ltp = tick.ltp;
        let shouldTrigger = false;
        let executionPrice = parseFloat(gtt.price || ltp);
        let triggeredReason = '';

        if (gtt.condition_type === 'OCO') {
          const slTrigger = parseFloat(gtt.stoploss_trigger_price || '0');
          const tgtTrigger = parseFloat(gtt.target_trigger_price || '0');

          if (tgtTrigger > 0 && ltp >= tgtTrigger) {
            shouldTrigger = true;
            executionPrice = parseFloat(gtt.target_price || ltp);
            triggeredReason = `OCO Target Trigger Hit (LTP: ₹${ltp} >= ₹${tgtTrigger})`;
          } else if (slTrigger > 0 && ltp <= slTrigger) {
            shouldTrigger = true;
            executionPrice = parseFloat(gtt.stoploss_price || ltp);
            triggeredReason = `OCO Stoploss Trigger Hit (LTP: ₹${ltp} <= ₹${slTrigger})`;
          }
        } else {
          // SINGLE GTT Trigger
          const triggerPrice = parseFloat(gtt.trigger_price);
          if (gtt.side === 'BUY' && ltp <= triggerPrice) {
            shouldTrigger = true;
            triggeredReason = `Buy Trigger Hit (LTP: ₹${ltp} <= ₹${triggerPrice})`;
          } else if (gtt.side === 'SELL' && ltp >= triggerPrice) {
            shouldTrigger = true;
            triggeredReason = `Sell Trigger Hit (LTP: ₹${ltp} >= ₹${triggerPrice})`;
          }
        }

        if (shouldTrigger) {
          // Atomically mark GTT as triggered
          const updated = await execute(
            `UPDATE gtt_orders 
             SET status = 'TRIGGERED', triggered_at = NOW(), updated_at = NOW() 
             WHERE id = $1 AND status = 'ACTIVE'`,
            [gtt.id]
          );

          if (updated > 0) {
            console.log(`[GttEngine] GTT ${gtt.trigger_id} triggered! ${triggeredReason}`);

            // Submit order via OMS
            const orderResult = await OMS.submitOrder({
              userId: gtt.user_id,
              instrumentToken: gtt.instrument_token,
              exchange: gtt.exchange,
              symbol: gtt.symbol,
              side: gtt.side,
              quantity: parseInt(gtt.quantity, 10),
              price: executionPrice,
              orderType: gtt.order_type,
              productType: gtt.product_type,
              source: 'GTT',
              reason: triggeredReason
            });

            if (orderResult.success && orderResult.orderId) {
              await execute(
                `UPDATE gtt_orders SET executed_order_id = $1 WHERE id = $2`,
                [orderResult.orderId, gtt.id]
              );
            }
          }
        }
      }
    } catch (err: any) {
      console.error('[GttEngine] Error processing tick:', err.message);
    }
  }
}

export const gttEngine = GttEngine.getInstance();
