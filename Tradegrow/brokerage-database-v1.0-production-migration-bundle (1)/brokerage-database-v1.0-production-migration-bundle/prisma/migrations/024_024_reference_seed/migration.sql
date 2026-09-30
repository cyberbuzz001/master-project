INSERT INTO market.exchanges(code,name) VALUES
('NSE','National Stock Exchange of India'),
('BSE','BSE Limited'),
('MCX','Multi Commodity Exchange of India')
ON CONFLICT(code) DO NOTHING;

INSERT INTO market.segments(exchange_id,code,name)
SELECT e.id,v.code,v.name FROM market.exchanges e
JOIN (VALUES
('NSE','NSE_EQ','NSE Equity'),
('NSE','NSE_FO','NSE Futures & Options'),
('BSE','BSE_EQ','BSE Equity'),
('BSE','BSE_FO','BSE Futures & Options'),
('MCX','MCX_FO','MCX Futures & Options')
) v(exchange_code,code,name) ON e.code=v.exchange_code
ON CONFLICT(exchange_id,code) DO NOTHING;
