import { runMigrations, queryOne, execute } from '../server/src/db/schema';
import { seedDatabase } from '../server/src/db/init';
import { VirtualWalletLedger } from '../server/src/trading/VirtualWalletLedger';
import { RMS } from '../server/src/trading/RMS';
import { OMS } from '../server/src/trading/OMS';
import { ExecutionEngine } from '../server/src/trading/ExecutionEngine';
import { SafetyLock } from '../server/src/services/SafetyLock';

describe('Multi-User Brokerage Platform Core Engine Tests', () => {
  let testUserId: string;

  beforeAll(async () => {
    await runMigrations();
    await seedDatabase();

    const user = await queryOne<{ id: string }>("SELECT id FROM users WHERE username = 'trader1'");
    testUserId = user!.id;
    await execute("UPDATE virtual_wallets SET cash_balance = 1000000.0, used_margin = 0.0, realized_pnl = 0.0 WHERE user_id = $1", [testUserId]);
    await execute("DELETE FROM orders WHERE user_id = $1", [testUserId]);
  });

  test('1. Technical Safety Lock prevents real-money trading', () => {
    expect(SafetyLock.REAL_MONEY_TRADING_ALLOWED).toBe(false);
    expect(() => SafetyLock.assertSimulationOnly('UnitTest')).not.toThrow();
  });

  test('2. Virtual Wallet Ledger double-entry initialization', async () => {
    const wallet = await VirtualWalletLedger.getWallet(testUserId);
    expect(wallet).not.toBeNull();
    expect(wallet!.cashBalance).toBeGreaterThan(0);
    expect(wallet!.buyingPower).toBe(wallet!.cashBalance - wallet!.usedMargin);
  });

  test('3. RMS rejects orders exceeding available virtual margin', async () => {
    const result = await RMS.validateOrder({
      userId: testUserId,
      instrumentToken: 'NSE_RELIANCE',
      exchange: 'NSE',
      symbol: 'RELIANCE',
      side: 'BUY',
      quantity: 100000,
      price: 3000,
      orderType: 'LIMIT',
      productType: 'CNC'
    });

    expect(result.passed).toBe(false);
    expect(result.reason).toContain('ORDER_REJECTED');
  });

  test('4. RMS accepts valid order and blocks margin', async () => {
    const result = await OMS.submitOrder({
      userId: testUserId,
      instrumentToken: 'NSE_RELIANCE',
      exchange: 'NSE',
      symbol: 'RELIANCE',
      side: 'BUY',
      quantity: 10,
      price: 3050,
      orderType: 'MARKET',
      productType: 'MIS'
    });

    expect(result.success).toBe(true);
    expect(result.orderId).toBeDefined();

    const updatedWallet = await VirtualWalletLedger.getWallet(testUserId);
    expect(updatedWallet!.usedMargin).toBeGreaterThan(0);
  });

  test('5. Execution Engine fills market order in simulation', async () => {
    const pendingOrder = await queryOne<any>("SELECT * FROM orders WHERE user_id = $1 AND status = 'ACCEPTED'", [testUserId]);
    expect(pendingOrder).toBeDefined();

    await ExecutionEngine.executeOrder(pendingOrder, 3050.0);

    const filledOrder = await queryOne<any>("SELECT status FROM orders WHERE id = $1", [pendingOrder.id]);
    expect(filledOrder!.status).toBe('FILLED');
  });
});
