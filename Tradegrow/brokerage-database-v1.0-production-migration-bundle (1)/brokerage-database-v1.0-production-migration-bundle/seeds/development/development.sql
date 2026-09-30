-- Development fixture. Never use in production.
DO $$
DECLARE
  u UUID;
  c UUID;
  a UUID;
BEGIN
  INSERT INTO identity.users(email,status)
  VALUES ('dev.client@example.invalid','ACTIVE')
  ON CONFLICT(email) DO UPDATE SET status='ACTIVE'
  RETURNING id INTO u;

  INSERT INTO customers.customers(user_id,customer_code,status)
  VALUES (u,'DEV-CUST-001','ACTIVE')
  ON CONFLICT(user_id) DO UPDATE SET status='ACTIVE'
  RETURNING id INTO c;

  INSERT INTO trading.accounts(customer_id,account_number,status,trading_enabled)
  VALUES(c,'DEV-TRADING-001','ACTIVE',true)
  ON CONFLICT(account_number) DO UPDATE SET trading_enabled=true
  RETURNING id INTO a;
END $$;
