-- Idempotent reference seed. Main reference data is also represented in migration 024.
INSERT INTO market.exchanges(code,name) VALUES
('NSE','National Stock Exchange of India'),
('BSE','BSE Limited'),
('MCX','Multi Commodity Exchange of India')
ON CONFLICT(code) DO NOTHING;
