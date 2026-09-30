-- Migration 011: Repair positions with zero average_price / sell_price and safeguard position math
-- Fixes NIFTY 24350 CE position where average_price was 0.00, causing bogus -$26,754 P&L and cash_balance constraint failure.

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
