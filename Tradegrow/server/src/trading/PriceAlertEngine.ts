import { query, queryOne, execute } from '../db/schema';
import { MarketTick } from '../marketData/types';
import { generateUUID } from '../utils/crypto';

export interface CreateAlertDTO {
  userId: string;
  instrumentToken: string;
  symbol: string;
  conditionType: 'GREATER_THAN' | 'LESS_THAN' | 'CROSSES_ABOVE' | 'CROSSES_BELOW';
  targetValue: number;
  message?: string;
}

export class PriceAlertEngine {
  private static instance: PriceAlertEngine;
  private activeTokens: Set<string> = new Set();
  private lastPrices: Map<string, number> = new Map();

  public static getInstance(): PriceAlertEngine {
    if (!PriceAlertEngine.instance) {
      PriceAlertEngine.instance = new PriceAlertEngine();
    }
    return PriceAlertEngine.instance;
  }

  public async initialize(): Promise<void> {
    try {
      const rows = await query<{ instrument_token: string; symbol: string }>(
        `SELECT DISTINCT instrument_token, symbol FROM alerts WHERE status = 'ACTIVE'`
      );
      this.activeTokens.clear();
      rows.forEach(r => {
        if (r.instrument_token) this.activeTokens.add(r.instrument_token);
        if (r.symbol) this.activeTokens.add(r.symbol);
      });
      console.log(`[PriceAlertEngine] Initialized with ${this.activeTokens.size} active alert tokens.`);
    } catch (err: any) {
      console.warn('[PriceAlertEngine] Initialization warning:', err.message);
    }
  }

  public async createAlert(dto: CreateAlertDTO): Promise<{ success: boolean; alertId?: string; error?: string }> {
    if (!dto.userId || !dto.symbol || !dto.targetValue || dto.targetValue <= 0) {
      return { success: false, error: 'Invalid alert parameters: symbol and targetValue > 0 required' };
    }

    const id = 'alt_' + generateUUID();
    const condition = dto.conditionType || 'GREATER_THAN';

    try {
      await execute(
        `INSERT INTO alerts (id, user_id, instrument_token, symbol, condition_type, target_value, status, message)
         VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', $7)`,
        [
          id, dto.userId, dto.instrumentToken || dto.symbol, dto.symbol,
          condition, dto.targetValue, dto.message || `${dto.symbol} target price ₹${dto.targetValue}`
        ]
      );

      this.activeTokens.add(dto.instrumentToken || dto.symbol);
      this.activeTokens.add(dto.symbol);

      return { success: true, alertId: id };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to create price alert' };
    }
  }

  public async getUserAlerts(userId: string, status?: string): Promise<any[]> {
    if (status) {
      return await query(
        `SELECT * FROM alerts WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC`,
        [userId, status.toUpperCase()]
      );
    }
    return await query(
      `SELECT * FROM alerts WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
  }

  public async deleteAlert(userId: string, alertId: string): Promise<{ success: boolean; error?: string }> {
    const res = await execute(
      `UPDATE alerts SET status = 'CANCELLED' WHERE id = $1 AND user_id = $2`,
      [alertId, userId]
    );
    if (res === 0) {
      return { success: false, error: 'Alert not found' };
    }
    void this.initialize();
    return { success: true };
  }

  /**
   * Evaluates incoming tick against active alerts.
   * Runs in O(1) via activeTokens pre-filter to eliminate database queries when no alerts exist.
   */
  public async onMarketTick(tick: MarketTick): Promise<void> {
    if (!tick || tick.ltp <= 0) return;
    if (!this.activeTokens.has(tick.instrumentToken) && !this.activeTokens.has(tick.symbol)) {
      return;
    }

    const prevPrice = this.lastPrices.get(tick.instrumentToken) ?? tick.ltp;
    this.lastPrices.set(tick.instrumentToken, tick.ltp);

    try {
      const activeAlerts = await query<any>(
        `SELECT * FROM alerts 
         WHERE (instrument_token = $1 OR symbol = $2) AND status = 'ACTIVE'`,
        [tick.instrumentToken, tick.symbol]
      );

      if (!activeAlerts.length) {
        this.activeTokens.delete(tick.instrumentToken);
        this.activeTokens.delete(tick.symbol);
        return;
      }

      for (const alert of activeAlerts) {
        const target = parseFloat(alert.target_value);
        let triggered = false;

        switch (alert.condition_type) {
          case 'GREATER_THAN':
            triggered = tick.ltp >= target;
            break;
          case 'LESS_THAN':
            triggered = tick.ltp <= target;
            break;
          case 'CROSSES_ABOVE':
            triggered = prevPrice < target && tick.ltp >= target;
            break;
          case 'CROSSES_BELOW':
            triggered = prevPrice > target && tick.ltp <= target;
            break;
        }

        if (triggered) {
          const updated = await execute(
            `UPDATE alerts SET status = 'TRIGGERED', triggered_at = NOW() WHERE id = $1 AND status = 'ACTIVE'`,
            [alert.id]
          );

          if (updated > 0) {
            console.log(`[PriceAlertEngine] Alert triggered: ${alert.symbol} hit ₹${tick.ltp}`);

            // Insert in-app notification for the user
            await execute(
              `INSERT INTO notifications (id, user_id, type, title, body, metadata)
               VALUES ($1, $2, 'ALERT_TRIGGERED', $3, $4, $5)`,
              [
                'notif_' + generateUUID(),
                alert.user_id,
                `Price Alert: ${alert.symbol}`,
                `${alert.symbol} reached target price of ₹${tick.ltp} (Condition: ${alert.condition_type} ₹${target})`,
                JSON.stringify({ symbol: alert.symbol, ltp: tick.ltp, targetValue: target, alertId: alert.id })
              ]
            );

            try {
              const { deliverToUser } = await import('../websocket/server');
              deliverToUser(alert.user_id, {
                type: 'NOTIFICATION',
                data: {
                  type: 'ALERT_TRIGGERED',
                  title: `Price Alert: ${alert.symbol}`,
                  body: `${alert.symbol} reached target price of ₹${tick.ltp}`,
                  metadata: { symbol: alert.symbol, ltp: tick.ltp, targetValue: target, alertId: alert.id }
                }
              });
            } catch (_) {}
          }
        }
      }
    } catch (err: any) {
      console.error('[PriceAlertEngine] Error in onMarketTick:', err.message);
    }
  }
}

export const priceAlertEngine = PriceAlertEngine.getInstance();
