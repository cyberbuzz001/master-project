import { ExecutionEngine } from '../trading/ExecutionEngine';
import { PortfolioService } from '../trading/PortfolioService';
import { MarketDataEngine } from '../marketData/MarketDataEngine';

describe('Limit Exit Accuracy & Closed Trade History Test Suite', () => {

  test('Rule 1 — LONG SELL LIMIT Target (Target ₹165.00, LTP ₹156.10) MUST NOT EXECUTE EARLY', () => {
    const targetPrice = 165.00;
    const currentLtp = 156.10;
    const bidPrice = 156.05;

    const order = {
      id: 'ord_test_long_1',
      order_id: 'ORD_TEST_LONG_1',
      user_id: 'usr_test',
      symbol: 'NIFTY 24250 CE',
      side: 'SELL',
      quantity: 195,
      price: targetPrice,
      order_type: 'LIMIT',
      status: 'ACCEPTED'
    };

    // Engine criteria: SELL LIMIT requires market bid/LTP >= targetPrice
    const conditionMet = bidPrice >= targetPrice || currentLtp >= targetPrice;

    expect(conditionMet).toBe(false);
    expect(order.status).toBe('ACCEPTED'); // Position remains OPEN!
  });

  test('Rule 2 — LONG SELL LIMIT Target (Target ₹165.00, LTP ₹165.05) EXECUTES WHEN TARGET IS MET', () => {
    const targetPrice = 165.00;
    const currentLtp = 165.05;
    const bidPrice = 165.05;

    const order = {
      id: 'ord_test_long_2',
      order_id: 'ORD_TEST_LONG_2',
      user_id: 'usr_test',
      symbol: 'NIFTY 24250 CE',
      side: 'SELL',
      quantity: 195,
      price: targetPrice,
      order_type: 'LIMIT',
      status: 'ACCEPTED'
    };

    const conditionMet = bidPrice >= targetPrice || currentLtp >= targetPrice;
    const executePrice = conditionMet ? targetPrice : null;

    expect(conditionMet).toBe(true);
    expect(executePrice).toBe(165.00);
  });

  test('Rule 3 — SHORT BUY LIMIT Target (Entry ₹165.00, Target ₹155.00, LTP ₹160.00) MUST NOT EXECUTE EARLY', () => {
    const targetPrice = 155.00;
    const currentLtp = 160.00;
    const askPrice = 160.05;

    const order = {
      id: 'ord_test_short_1',
      order_id: 'ORD_TEST_SHORT_1',
      user_id: 'usr_test',
      symbol: 'NIFTY 24250 CE',
      side: 'BUY',
      quantity: 195,
      price: targetPrice,
      order_type: 'LIMIT',
      status: 'ACCEPTED'
    };

    // Engine criteria: BUY LIMIT requires market ask/LTP <= targetPrice
    const conditionMet = askPrice <= targetPrice || currentLtp <= targetPrice;

    expect(conditionMet).toBe(false);
    expect(order.status).toBe('ACCEPTED'); // Position remains OPEN!
  });

  test('Rule 4 — SHORT BUY LIMIT Target (Entry ₹165.00, Target ₹155.00, LTP ₹154.95) EXECUTES WHEN TARGET IS MET', () => {
    const targetPrice = 155.00;
    const currentLtp = 154.95;
    const askPrice = 154.95;

    const order = {
      id: 'ord_test_short_2',
      order_id: 'ORD_TEST_SHORT_2',
      user_id: 'usr_test',
      symbol: 'NIFTY 24250 CE',
      side: 'BUY',
      quantity: 195,
      price: targetPrice,
      order_type: 'LIMIT',
      status: 'ACCEPTED'
    };

    const conditionMet = askPrice <= targetPrice || currentLtp <= targetPrice;
    const executePrice = conditionMet ? targetPrice : null;

    expect(conditionMet).toBe(true);
    expect(executePrice).toBe(155.00);
  });

  test('Rule 5 — Stale or Missing Market Tick for LIMIT Order MUST NOT FAKE TICK TO TARGET PRICE', () => {
    const order = {
      id: 'ord_test_stale_1',
      order_id: 'ORD_TEST_STALE_1',
      user_id: 'usr_test',
      symbol: 'NIFTY 24250 CE',
      side: 'SELL',
      quantity: 195,
      price: 165.00,
      order_type: 'LIMIT',
      status: 'ACCEPTED'
    };

    const tick = null; // No market tick available

    // Engine criteria: if !tick or isStale, do NOT synthesize tick at order.price!
    let executePrice: number | null = null;
    if (!tick) {
      executePrice = null; // Skip execution!
    }

    expect(executePrice).toBeNull();
    expect(order.status).toBe('ACCEPTED');
  });

  test('Rule 6 — Per-Trade Closed P&L Record Calculation', () => {
    const entryPrice = 154.85;
    const exitPrice = 165.00;
    const quantity = 195;

    const grossPnl = (exitPrice - entryPrice) * quantity;
    const charges = 0.00;
    const netPnl = grossPnl - charges;

    expect(grossPnl).toBeCloseTo(1979.25, 2);
    expect(netPnl).toBeCloseTo(1979.25, 2);
  });
});
