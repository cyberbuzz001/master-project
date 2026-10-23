/**
 * tests/ledger_invariance.test.ts
 * 
 * TradeGrow Phase 7 Testing Suite — Financial Math & Double-Entry Ledger Invariance
 * Enforces mathematical invariance across simulated transactions, integer paisa precision,
 * race-condition concurrency guards, and margin recalculation conservation.
 */

import { runMigrations, queryOne, query, execute, withTransaction } from '../server/src/db/schema';
import { seedDatabase } from '../server/src/db/init';
import { VirtualWalletLedger } from '../server/src/trading/VirtualWalletLedger';
import { RMS } from '../server/src/trading/RMS';
import { OMS } from '../server/src/trading/OMS';
import { ExecutionEngine } from '../server/src/trading/ExecutionEngine';
import { SafetyLock } from '../server/src/services/SafetyLock';
import { generateUUID } from '../server/src/utils/crypto';

describe('Phase 7: Double-Entry Ledger Invariance & Financial Math Verification', () => {
  let testUserId: string;
  let testUsername: string;

  beforeAll(async () => {
    await runMigrations();
    await seedDatabase();

    // Create a dedicated isolated test user for ledger invariance
    testUsername = 'invariance_trader_' + Date.now();
    const uniqueClientId = 'TG-INV-' + generateUUID().substring(0, 8).toUpperCase();
    const userRes = await queryOne<{ id: string }>(
      `INSERT INTO users (id, client_id, username, email, password_hash, full_name, role, status)
       VALUES ($1, $2, $3, $4, 'hash_test', 'Invariance Test User', 'USER', 'ACTIVE')
       RETURNING id`,
      ['usr_inv_' + generateUUID(), uniqueClientId, testUsername, `${testUsername}@tradegrow.in`]
    );
    testUserId = userRes!.id;

    // Initialize virtual wallet with exact starting capital: ₹10,00,000.00
    await execute(
      `INSERT INTO virtual_wallets (id, user_id, cash_balance, used_margin, realized_pnl, updated_at)
       VALUES ($1, $2, 1000000.00, 0.00, 0.00, NOW())
       ON CONFLICT (user_id) DO UPDATE SET cash_balance = 1000000.00, used_margin = 0.00, realized_pnl = 0.00`,
      ['wal_inv_' + generateUUID(), testUserId]
    );

    await execute('DELETE FROM wallet_ledger WHERE user_id = $1', [testUserId]);
    await execute('DELETE FROM orders WHERE user_id = $1', [testUserId]);
    await execute('DELETE FROM positions WHERE user_id = $1', [testUserId]);
  });

  afterAll(async () => {
    // Cleanup test artifacts
    await execute('DELETE FROM wallet_ledger WHERE user_id = $1', [testUserId]);
    await execute('DELETE FROM orders WHERE user_id = $1', [testUserId]);
    await execute('DELETE FROM positions WHERE user_id = $1', [testUserId]);
    await execute('DELETE FROM virtual_wallets WHERE user_id = $1', [testUserId]);
    await execute('DELETE FROM users WHERE id = $1', [testUserId]);
  });

  describe('1. Double-Entry Invariance & Delta Continuity', () => {
    test('Starting state has zero ledger discrepancies', async () => {
      const wallet = await VirtualWalletLedger.getWallet(testUserId);
      expect(wallet).not.toBeNull();
      expect(wallet!.cashBalance).toBe(1000000.00);
      expect(wallet!.usedMargin).toBe(0.00);
      expect(wallet!.realizedPnl).toBe(0.00);
      expect(wallet!.buyingPower).toBe(1000000.00);
    });

    test('Consecutive credit and debit mutations maintain delta continuity', async () => {
      // 1. Credit ₹50,000
      await VirtualWalletLedger.adminAdjustBalance(testUserId, 50000.00, 'admin_sys', 'Bonus Capital Credit');
      let wallet = await VirtualWalletLedger.getWallet(testUserId);
      expect(wallet!.cashBalance).toBe(1050000.00);

      // 2. Debit ₹25,000
      await VirtualWalletLedger.adminAdjustBalance(testUserId, -25000.00, 'admin_sys', 'Manual Capital Withdrawal');
      wallet = await VirtualWalletLedger.getWallet(testUserId);
      expect(wallet!.cashBalance).toBe(1025000.00);

      // Verify ledger entries match exactly balance_after - balance_before
      const ledgerRows = await query<any>(
        'SELECT transaction_type, amount, balance_before, balance_after FROM wallet_ledger WHERE user_id = $1 ORDER BY created_at ASC',
        [testUserId]
      );
      expect(ledgerRows.length).toBe(2);

      // Row 1: Credit
      const row1 = ledgerRows[0];
      expect(parseFloat(row1.amount)).toBe(50000.00);
      expect(parseFloat(row1.balance_before)).toBe(1000000.00);
      expect(parseFloat(row1.balance_after)).toBe(1050000.00);
      expect(Number((parseFloat(row1.balance_after) - parseFloat(row1.balance_before)).toFixed(2))).toBe(50000.00);

      // Row 2: Debit
      const row2 = ledgerRows[1];
      expect(parseFloat(row2.amount)).toBe(25000.00);
      expect(parseFloat(row2.balance_before)).toBe(1050000.00);
      expect(parseFloat(row2.balance_after)).toBe(1025000.00);
      expect(Number((parseFloat(row2.balance_before) - parseFloat(row2.balance_after)).toFixed(2))).toBe(25000.00);
    });
  });

  describe('2. Integer Paisa Arithmetic & Rounding Invariance (10,000 Micro-Transactions)', () => {
    test('10,000 randomized micro-transactions accumulate with zero floating-point epsilon drift', () => {
      let balancePaisa = 100000000; // ₹1,000,000.00 in paisa
      let floatBalance = 1000000.00;

      // Seed a pseudo-random sequence of 10,000 fractional transactions
      const transactionDeltasPaisa: number[] = [];
      for (let i = 0; i < 10000; i++) {
        // Deltas between -₹50.00 and +₹50.00 in paisa
        const deltaPaisa = ((i * 7919) % 10001) - 5000;
        transactionDeltasPaisa.push(deltaPaisa);
      }

      // Compute via integer paisa
      for (const dPaisa of transactionDeltasPaisa) {
        balancePaisa += dPaisa;
      }

      // Compute via floating point with standard 2-decimal rounding
      for (const dPaisa of transactionDeltasPaisa) {
        const dRupees = dPaisa / 100;
        floatBalance = Math.round((floatBalance + dRupees) * 100) / 100;
      }

      const expectedFinalRupees = balancePaisa / 100;
      expect(floatBalance).toBe(expectedFinalRupees);
      expect(Math.abs(floatBalance - expectedFinalRupees)).toBe(0);
    });
  });

  describe('3. Concurrency & Overdraft Protection (SELECT FOR UPDATE Race Guard)', () => {
    test('Concurrent withdrawal attempts exceeding balance are serialized and fail gracefully', async () => {
      // Set balance to exactly ₹10,000
      await execute('UPDATE virtual_wallets SET cash_balance = 10000.00 WHERE user_id = $1', [testUserId]);

      // Fire 10 concurrent requests, each attempting to withdraw ₹3,000 (total = ₹30,000 vs available ₹10,000)
      const withdrawalAmounts = Array(10).fill(3000.00);
      const results = await Promise.allSettled(
        withdrawalAmounts.map((amt, idx) =>
          VirtualWalletLedger.adminAdjustBalance(testUserId, -amt, 'stress_bot', `Concurrent Debit #${idx}`)
        )
      );

      const fulfilled = results.filter(r => r.status === 'fulfilled');
      const rejected = results.filter(r => r.status === 'rejected');

      // Exactly 3 withdrawals of ₹3,000 should succeed (₹9,000 total), and 7 must fail
      expect(fulfilled.length).toBe(3);
      expect(rejected.length).toBe(7);

      const finalWallet = await VirtualWalletLedger.getWallet(testUserId);
      expect(finalWallet!.cashBalance).toBe(1000.00);
      expect(finalWallet!.cashBalance).toBeGreaterThanOrEqual(0.00);
    });
  });

  describe('4. Full Trade Lifecycle & Capital Conservation', () => {
    test('Simulated round-trip trade conserves cash balance, margin, and realized P&L', async () => {
      // Reset wallet to ₹5,00,000 clean state
      await execute('UPDATE virtual_wallets SET cash_balance = 500000.00, used_margin = 0.00, realized_pnl = 0.00 WHERE user_id = $1', [testUserId]);
      await execute('DELETE FROM positions WHERE user_id = $1', [testUserId]);
      await execute('DELETE FROM orders WHERE user_id = $1', [testUserId]);

      // Step 1: Submit BUY 20 RELIANCE @ 2500 (MIS) -> Notional = ₹50,000
      const buyOrderRes = await OMS.submitOrder({
        userId: testUserId,
        instrumentToken: 'NSE_RELIANCE',
        exchange: 'NSE',
        symbol: 'RELIANCE',
        side: 'BUY',
        quantity: 20,
        price: 2500.00,
        orderType: 'MARKET',
        productType: 'MIS'
      });
      expect(buyOrderRes.success).toBe(true);

      // Verify margin is blocked on pending order
      let wallet = await VirtualWalletLedger.getWallet(testUserId);
      expect(wallet!.usedMargin).toBeGreaterThan(0);
      const blockedMargin = wallet!.usedMargin;

      // Step 2: Fill the BUY order at ₹2500.00
      const pendingBuy = await queryOne<any>('SELECT * FROM orders WHERE (order_id = $1 OR id = $1)', [buyOrderRes.orderId]);
      expect(pendingBuy).not.toBeNull();
      await ExecutionEngine.executeOrder(pendingBuy, 2500.00);

      // Verify position exists with net_qty = 20
      const pos = await queryOne<any>('SELECT * FROM positions WHERE user_id = $1 AND symbol = $2', [testUserId, 'RELIANCE']);
      expect(pos).not.toBeNull();
      expect(parseInt(pos.net_qty, 10)).toBe(20);

      // Step 3: Submit SELL 20 RELIANCE @ 2550 (MIS) -> Closing order
      const sellOrderRes = await OMS.submitOrder({
        userId: testUserId,
        instrumentToken: 'NSE_RELIANCE',
        exchange: 'NSE',
        symbol: 'RELIANCE',
        side: 'SELL',
        quantity: 20,
        price: 2550.00,
        orderType: 'MARKET',
        productType: 'MIS'
      });
      expect(sellOrderRes.success).toBe(true);

      // Step 4: Fill the SELL order at ₹2550.00 (Profit = 20 * ₹50 = +₹1,000)
      const pendingSell = await queryOne<any>('SELECT * FROM orders WHERE (order_id = $1 OR id = $1)', [sellOrderRes.orderId]);
      expect(pendingSell).not.toBeNull();
      await ExecutionEngine.executeOrder(pendingSell, 2550.00);

      // Position should now be flat (net_qty = 0)
      const closedPos = await queryOne<any>('SELECT * FROM positions WHERE user_id = $1 AND symbol = $2', [testUserId, 'RELIANCE']);
      expect(parseInt(closedPos.net_qty, 10)).toBe(0);

      // Final Wallet Verification:
      // Starting: ₹5,00,000.00 + Realized Profit: ₹1,000.00 = Final Cash: ₹5,01,000.00
      // Used Margin must be restored to 0.00 with ZERO stranded margin residue
      wallet = await VirtualWalletLedger.getWallet(testUserId);
      expect(wallet!.cashBalance).toBe(501000.00);
      expect(wallet!.realizedPnl).toBe(1000.00);
      expect(wallet!.usedMargin).toBe(0.00);
      expect(wallet!.buyingPower).toBe(501000.00);
      expect(wallet!.withdrawableBalance).toBe(501000.00);
    });
  });

  describe('5. Negative Buying Power & Over-Margining Rejection', () => {
    test('RMS strictly rejects orders requiring more margin than available buying power', async () => {
      // Set cash balance to ₹10,000
      await execute('UPDATE virtual_wallets SET cash_balance = 10000.00, used_margin = 0.00 WHERE user_id = $1', [testUserId]);

      // Attempt to place an order for 1,000 shares of RELIANCE @ 3,000 = ₹30,00,000
      const rmsResult = await RMS.validateOrder({
        userId: testUserId,
        instrumentToken: 'NSE_RELIANCE',
        exchange: 'NSE',
        symbol: 'RELIANCE',
        side: 'BUY',
        quantity: 1000,
        price: 3000.00,
        orderType: 'LIMIT',
        productType: 'CNC'
      });

      expect(rmsResult.passed).toBe(false);
      expect(rmsResult.reason).toContain('ORDER_REJECTED');

      // Ensure no margin was inadvertently reserved
      const wallet = await VirtualWalletLedger.getWallet(testUserId);
      expect(wallet!.usedMargin).toBe(0.00);
      expect(wallet!.cashBalance).toBe(10000.00);
    });
  });
});
