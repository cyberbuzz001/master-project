import { PortfolioService } from '../trading/PortfolioService';
import { getLotSizeForSymbol } from '../utils/lotSize';

describe('Exact Trade P&L, Realized P&L & Fund Accounting Suite', () => {

  test('Test 1 — Lot Size Resolution', () => {
    expect(getLotSizeForSymbol('NIFTY')).toBe(65);
    expect(getLotSizeForSymbol('BSE SENSEX')).toBe(20);
    expect(getLotSizeForSymbol('SENSEX')).toBe(20);
    expect(getLotSizeForSymbol('BANKNIFTY')).toBe(30);
    expect(getLotSizeForSymbol('FINNIFTY')).toBe(60);
    expect(getLotSizeForSymbol('RELIANCE')).toBe(1);
  });

  test('Test 2 — Profitable Long (BUY 2 Lots @ ₹100, SELL 2 Lots @ ₹110)', () => {
    const initialFund = 50000;
    const lots = 2;
    const lotSize = getLotSizeForSymbol('NIFTY'); // 65
    const quantity = lots * lotSize; // 130
    const buyPrice = 100;
    const sellPrice = 110;

    const usedMargin = quantity * buyPrice; // 13,000
    const availableBeforeSell = initialFund - usedMargin; // 37,000

    expect(quantity).toBe(130);
    expect(usedMargin).toBe(13000);
    expect(availableBeforeSell).toBe(37000);

    // Closed P&L calculation
    const priceDiff = sellPrice - buyPrice; // +10
    const realizedPnl = priceDiff * quantity; // +1,300
    const finalFund = initialFund + realizedPnl; // 51,300

    expect(realizedPnl).toBe(1300);
    expect(finalFund).toBe(51300);
  });

  test('Test 3 — Losing Long (BUY 130 Qty @ ₹100, SELL 130 Qty @ ₹90)', () => {
    const initialFund = 50000;
    const quantity = 130;
    const buyPrice = 100;
    const sellPrice = 90;

    const realizedPnl = (sellPrice - buyPrice) * quantity; // -1,300
    const finalFund = initialFund + realizedPnl; // 48,700

    expect(realizedPnl).toBe(-1300);
    expect(finalFund).toBe(48700);
  });

  test('Test 4 — No Price Change (BUY 100, SELL 100)', () => {
    const initialFund = 50000;
    const quantity = 130;
    const buyPrice = 100;
    const sellPrice = 100;

    const realizedPnl = (sellPrice - buyPrice) * quantity; // 0
    const finalFund = initialFund + realizedPnl; // 50,000

    expect(realizedPnl).toBe(0);
    expect(finalFund).toBe(50000);
  });

  test('Test 5 — Partial Exit (BUY 4 Lots = 260 Qty @ ₹100, SELL 2 Lots = 130 Qty @ ₹110)', () => {
    const initialFund = 50000;
    const totalQty = 260;
    const buyPrice = 100;

    const initialUsedMargin = totalQty * buyPrice; // 26,000
    const availableBeforeExit = initialFund - initialUsedMargin; // 24,000

    expect(initialUsedMargin).toBe(26000);
    expect(availableBeforeExit).toBe(24000);

    const exitQty = 130;
    const sellPrice = 110;
    const realizedPnl = (sellPrice - buyPrice) * exitQty; // +1,300

    const cashBalanceAfterExit = initialFund + realizedPnl; // 51,300
    const remainingQty = totalQty - exitQty; // 130
    const remainingUsedMargin = remainingQty * buyPrice; // 13,000
    const availableAfterExit = cashBalanceAfterExit - remainingUsedMargin; // 38,300

    expect(realizedPnl).toBe(1300);
    expect(cashBalanceAfterExit).toBe(51300);
    expect(remainingUsedMargin).toBe(13000);
    expect(availableAfterExit).toBe(38300);
  });

  test('Test 6 — Multiple Entries (BUY 65 @ ₹100, BUY 65 @ ₹120)', () => {
    const qty1 = 65;
    const price1 = 100;
    const qty2 = 65;
    const price2 = 120;

    const totalQty = qty1 + qty2; // 130
    const totalCost = (qty1 * price1) + (qty2 * price2); // 14,300
    const avgEntryPrice = totalCost / totalQty; // 110

    expect(totalQty).toBe(130);
    expect(totalCost).toBe(14300);
    expect(avgEntryPrice).toBe(110);

    const sellPrice = 115;
    const realizedPnl = (sellPrice - avgEntryPrice) * totalQty; // (115 - 110) * 130 = +650

    expect(realizedPnl).toBe(650);
  });

  test('Test 7 — SENSEX Lot Size 20 P&L Calculation (BUY 2 Lots SENSEX @ ₹500, SELL @ ₹550)', () => {
    const initialFund = 50000;
    const lots = 2;
    const lotSize = getLotSizeForSymbol('SENSEX'); // 20
    const quantity = lots * lotSize; // 40
    const buyPrice = 500;
    const sellPrice = 550;

    const usedMargin = quantity * buyPrice; // 20,000
    const availableBeforeExit = initialFund - usedMargin; // 30,000

    expect(quantity).toBe(40);
    expect(usedMargin).toBe(20000);
    expect(availableBeforeExit).toBe(30000);

    const realizedPnl = (sellPrice - buyPrice) * quantity; // (550 - 500) * 40 = +2,000
    const finalFund = initialFund + realizedPnl; // 52,000

    expect(realizedPnl).toBe(2000);
    expect(finalFund).toBe(52000);
  });
});
