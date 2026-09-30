-- RLS strategy.
-- Application must execute:
--   SET LOCAL app.user_id = '<authenticated-user-uuid>';
-- in each transaction/request context before client-facing queries.

ALTER TABLE customers.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading.order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio.holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications.notifications ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid
$$;

DROP POLICY IF EXISTS customer_self_access ON customers.customers;
CREATE POLICY customer_self_access ON customers.customers
USING (user_id = public.current_app_user_id());

DROP POLICY IF EXISTS account_self_access ON trading.accounts;
CREATE POLICY account_self_access ON trading.accounts
USING (customer_id IN (
  SELECT id FROM customers.customers WHERE user_id = public.current_app_user_id()
));

DROP POLICY IF EXISTS order_self_access ON trading.orders;
CREATE POLICY order_self_access ON trading.orders
USING (trading_account_id IN (
  SELECT a.id FROM trading.accounts a
  JOIN customers.customers c ON c.id=a.customer_id
  WHERE c.user_id=public.current_app_user_id()
));

-- Repeat the same ownership chain for trades, positions, holdings, payments and withdrawals.
-- Internal service roles should use controlled database roles and explicit grants.
