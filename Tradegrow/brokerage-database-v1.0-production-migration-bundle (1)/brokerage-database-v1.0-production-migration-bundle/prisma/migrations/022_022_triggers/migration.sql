CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_users_updated_at ON identity.users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON identity.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_customers_updated_at ON customers.customers;
CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON customers.customers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON customers.profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON customers.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_accounts_updated_at ON trading.accounts;
CREATE TRIGGER trg_accounts_updated_at BEFORE UPDATE ON trading.accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_orders_updated_at ON trading.orders;
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON trading.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_instruments_updated_at ON market.instruments;
CREATE TRIGGER trg_instruments_updated_at BEFORE UPDATE ON market.instruments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_payments_updated_at ON payments.transactions;
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON payments.transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION ledger.validate_transaction_balance(p_transaction UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE d NUMERIC; c NUMERIC;
BEGIN
 SELECT COALESCE(SUM(debit),0), COALESCE(SUM(credit),0) INTO d,c FROM ledger.entries WHERE transaction_id=p_transaction;
 IF d <> c THEN RAISE EXCEPTION 'Unbalanced ledger transaction %: debit %, credit %', p_transaction,d,c; END IF;
END $$;

CREATE OR REPLACE FUNCTION ledger.prevent_entry_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Ledger entries are append-only; use reversal transactions'; END $$;

DROP TRIGGER IF EXISTS trg_ledger_entries_immutable ON ledger.entries;
CREATE TRIGGER trg_ledger_entries_immutable BEFORE UPDATE OR DELETE ON ledger.entries FOR EACH ROW EXECUTE FUNCTION ledger.prevent_entry_mutation();

CREATE OR REPLACE FUNCTION audit.prevent_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Audit events are append-only'; END $$;

DROP TRIGGER IF EXISTS trg_audit_immutable ON audit.events;
CREATE TRIGGER trg_audit_immutable BEFORE UPDATE OR DELETE ON audit.events FOR EACH ROW EXECUTE FUNCTION audit.prevent_audit_mutation();

CREATE OR REPLACE FUNCTION audit.capture_order_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO audit.events(actor_type,action,resource_type,resource_id,before_state,after_state)
 VALUES ('SYSTEM','ORDER_UPDATED','ORDER',NEW.id,to_jsonb(OLD),to_jsonb(NEW));
 RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_order_audit ON trading.orders;
CREATE TRIGGER trg_order_audit AFTER UPDATE ON trading.orders FOR EACH ROW EXECUTE FUNCTION audit.capture_order_change();
