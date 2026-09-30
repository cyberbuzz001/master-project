import { MarginEngineService } from '../server/src/services/MarginEngineService';
import { runMigrations, queryOne } from '../server/src/db/schema';
import { seedDatabase } from '../server/src/db/init';

describe('MarginEngineService & Zero Brokerage Unit Tests', () => {
  let marginEngine: MarginEngineService;
  let testUserId: string;

  beforeAll(async () => {
    await runMigrations();
    await seedDatabase();
    marginEngine = MarginEngineService.getInstance();

    const user = await queryOne<{ id: string }>("SELECT id FROM users WHERE username = 'trader1'");
    testUserId = user ? user.id : 'test_user_id';
  });

  test('1. Enforces Zero Brokerage (₹0) policy on option buy quotes', async () => {
    const quote = await marginEngine.calculateQuote({
      userId: testUserId,
      exchange: 'NSE',
      underlying: 'NIFTY',
      strike: 24500,
      optionType: 'CE',
      side: 'BUY',
      quantity: 65, // 1 lot of NIFTY
      price: 125.00,
    });

    expect(quote.brokerage).toBe(0);
    expect(quote.orderValue).toBe(125 * 65); // 8125
    expect(quote.requiredMargin).toBeGreaterThanOrEqual(quote.orderValue);
  });

  test('2. Option Selling requires SPAN + Exposure Margin', async () => {
    const quote = await marginEngine.calculateQuote({
      userId: testUserId,
      exchange: 'NSE',
      underlying: 'NIFTY',
      strike: 24500,
      optionType: 'CE',
      side: 'SELL',
      quantity: 65,
      price: 125.00,
    });

    expect(quote.brokerage).toBe(0);
    expect(quote.spanMargin).toBeGreaterThan(0);
    expect(quote.exposureMargin).toBeGreaterThan(0);
    expect(quote.totalMargin).toBeGreaterThan(quote.orderValue);
  });

  test('3. Enforces Zero Brokerage on BSE SENSEX options', async () => {
    const quote = await marginEngine.calculateQuote({
      userId: testUserId,
      exchange: 'BSE',
      underlying: 'SENSEX',
      strike: 80000,
      optionType: 'PE',
      side: 'BUY',
      quantity: 20, // 1 lot of SENSEX
      price: 250.00,
    });

    expect(quote.brokerage).toBe(0);
    expect(quote.orderValue).toBe(5000);
    expect(quote.requiredMargin).toBeGreaterThanOrEqual(5000);
  });
});
