CREATE INDEX IF NOT EXISTS idx_sessions_user ON identity.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_instruments_token ON market.instruments(instrument_token);
CREATE INDEX IF NOT EXISTS idx_instruments_isin ON market.instruments(isin);
CREATE INDEX IF NOT EXISTS idx_order_events_order ON trading.order_events(order_id,created_at);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit.events(resource_type,resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit.events(actor_user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications.notifications(user_id,created_at DESC);
