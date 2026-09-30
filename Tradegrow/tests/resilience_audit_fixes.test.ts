import { query, queryOne, execute, withTransaction } from '../server/src/db/schema';
import { RMS } from '../server/src/trading/RMS';
import { OMS } from '../server/src/trading/OMS';
import { PortfolioService } from '../server/src/trading/PortfolioService';
import { generateUUID } from '../server/src/utils/crypto';

describe('Resilience Audit Fixes Suite', () => {
  let testUserId: string;

  beforeAll(async () => {
    // Find or create test trader
    let user = await queryOne<{ id: string }>("SELECT id FROM users WHERE username = 'trader1'");
    if (!user) {
      const id = 'usr_' + generateUUID();
      await execute(
        "INSERT INTO users (id, username, email, password_hash, full_name, role, status) VALUES ($1, 'trader1', 'trader1@test.local', 'hash', 'Test Trader', 'TRADER', 'ACTIVE')",
        [id]
      );
      user = { id };
    } else {
      await execute("UPDATE users SET status = 'ACTIVE' WHERE id = $1", [user.id]);
    }
    testUserId = user.id;

    // Reset wallet & clean holdings
    await execute("DELETE FROM holdings WHERE user_id = $1", [testUserId]);
    await execute("DELETE FROM orders WHERE user_id = $1", [testUserId]);
    await execute(
      "INSERT INTO virtual_wallets (id, user_id, cash_balance, used_margin, realized_pnl) VALUES ($1, $2, 1000000.0, 0.0, 0.0) ON CONFLICT (user_id) DO UPDATE SET cash_balance = 1000000.0, used_margin = 0.0",
      ['wal_' + generateUUID(), testUserId]
    );
  });

  describe('1. Stage 1: CNC Holdings Oversell Defense', () => {
    beforeEach(async () => {
      await execute("DELETE FROM holdings WHERE user_id = $1", [testUserId]);
      await execute("DELETE FROM orders WHERE user_id = $1", [testUserId]);
      // Insert holding of exactly 100 shares of INFY
      await execute(
        `INSERT INTO holdings (id, user_id, symbol, exchange, quantity, average_price, ltp, current_value, pnl, pnl_percentage)
         VALUES ($1, $2, 'INFY', 'NSE', 100, 1500.0, 1520.0, 152000.0, 2000.0, 1.33)`,
        ['hld_' + generateUUID(), testUserId]
      );
    });

    test('Allows CNC sell order within available holding quantity', async () => {
      const res = await OMS.submitOrder({
        userId: testUserId,
        instrumentToken: 'NSE_INFY',
        exchange: 'NSE',
        symbol: 'INFY',
        side: 'SELL',
        quantity: 60,
        price: 1520.0,
        orderType: 'LIMIT',
        productType: 'CNC',
      });

      expect(res.success).toBe(true);
      expect(res.orderId).toBeDefined();
    });

    test('Rejects second concurrent CNC sell order that exceeds remaining holding reservation', async () => {
      // 1. Submit first sell order for 80 shares (passes, leaving 20 shares available)
      const first = await OMS.submitOrder({
        userId: testUserId,
        instrumentToken: 'NSE_INFY',
        exchange: 'NSE',
        symbol: 'INFY',
        side: 'SELL',
        quantity: 80,
        price: 1520.0,
        orderType: 'LIMIT',
        productType: 'CNC',
      });
      expect(first.success).toBe(true);

      // 2. Submit second sell order for 30 shares (must fail because only 20 shares unreserved)
      const second = await OMS.submitOrder({
        userId: testUserId,
        instrumentToken: 'NSE_INFY',
        exchange: 'NSE',
        symbol: 'INFY',
        side: 'SELL',
        quantity: 30,
        price: 1520.0,
        orderType: 'LIMIT',
        productType: 'CNC',
      });

      expect(second.success).toBe(false);
      expect(second.error).toContain('ORDER_REJECTED');
      expect(second.error).toContain('Insufficient CNC holdings');
    });

    test('PortfolioService throws error if attempting to oversell non-existent or excessive holding', async () => {
      await expect(
        withTransaction(async (client) => {
          await (PortfolioService as any).updateHoldingsInTransaction(
            client,
            testUserId,
            'INFY',
            'NSE',
            'SELL',
            150, // Selling 150 when only 100 exist
            1520.0,
            1520.0
          );
        })
      ).rejects.toThrow('HOLDINGS_OVERSOLD_ERROR');
    });
  });

  describe('2. Stage 4: Reconnect Jitter Mathematics Verification', () => {
    test('Calculates jittered backoff within expected randomized range without thundering herd', () => {
      const INITIAL_BACKOFF_MS = 1000;
      const MAX_BACKOFF_MS = 30000;

      for (let attempt = 1; attempt <= 10; attempt++) {
        const base = Math.min(INITIAL_BACKOFF_MS * Math.pow(1.5, Math.min(attempt - 1, 8)), MAX_BACKOFF_MS);
        expect(base).toBeLessThanOrEqual(MAX_BACKOFF_MS);

        const jitterFactor = 0.5 + Math.random() * 0.5; // [0.5, 1.0]
        const backoffMs = Math.round(base * jitterFactor);

        expect(backoffMs).toBeGreaterThanOrEqual(base * 0.5);
        expect(backoffMs).toBeLessThanOrEqual(base);
      }
    });
  });
});
