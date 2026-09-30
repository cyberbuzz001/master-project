-- Migration: 035_sync_canonical_nse_stocks.sql
-- Description: Ensures covering index and top canonical NSE stocks for real-time search and trading

CREATE INDEX IF NOT EXISTS idx_instruments_act_seg_sym ON instruments (active, segment, symbol);
CREATE INDEX IF NOT EXISTS idx_instruments_act_exch_sym ON instruments (active, exchange, symbol);

-- Ensure primary liquid NSE equity stocks have canonical instrument_tokens (NSE_<SYMBOL>)
INSERT INTO instruments (
  id, instrument_token, exchange, segment, symbol, trading_symbol, name, company_name, lot_size, tick_size, strike, option_type, expiry, instrument_type, active, last_seen_at
) VALUES
  ('inst_nse_reliance', 'NSE_RELIANCE', 'NSE', 'NSE_EQ', 'RELIANCE', 'RELIANCE-EQ', 'Reliance Industries Ltd', 'Reliance Industries Ltd', 1, 0.05, 0.0, 'XX', NULL, 'EQ', TRUE, NOW()),
  ('inst_nse_tcs', 'NSE_TCS', 'NSE', 'NSE_EQ', 'TCS', 'TCS-EQ', 'Tata Consultancy Services', 'Tata Consultancy Services', 1, 0.05, 0.0, 'XX', NULL, 'EQ', TRUE, NOW()),
  ('inst_nse_infy', 'NSE_INFY', 'NSE', 'NSE_EQ', 'INFY', 'INFY-EQ', 'Infosys Limited', 'Infosys Limited', 1, 0.05, 0.0, 'XX', NULL, 'EQ', TRUE, NOW()),
  ('inst_nse_hdfcbank', 'NSE_HDFCBANK', 'NSE', 'NSE_EQ', 'HDFCBANK', 'HDFCBANK-EQ', 'HDFC Bank Limited', 'HDFC Bank Limited', 1, 0.05, 0.0, 'XX', NULL, 'EQ', TRUE, NOW()),
  ('inst_nse_icicibank', 'NSE_ICICIBANK', 'NSE', 'NSE_EQ', 'ICICIBANK', 'ICICIBANK-EQ', 'ICICI Bank Limited', 'ICICI Bank Limited', 1, 0.05, 0.0, 'XX', NULL, 'EQ', TRUE, NOW()),
  ('inst_nse_sbin', 'NSE_SBIN', 'NSE', 'NSE_EQ', 'SBIN', 'SBIN-EQ', 'State Bank of India', 'State Bank of India', 1, 0.05, 0.0, 'XX', NULL, 'EQ', TRUE, NOW()),
  ('inst_nse_bhartiartl', 'NSE_BHARTIARTL', 'NSE', 'NSE_EQ', 'BHARTIARTL', 'BHARTIARTL-EQ', 'Bharti Airtel Limited', 'Bharti Airtel Limited', 1, 0.05, 0.0, 'XX', NULL, 'EQ', TRUE, NOW()),
  ('inst_nse_itc', 'NSE_ITC', 'NSE', 'NSE_EQ', 'ITC', 'ITC-EQ', 'ITC Limited', 'ITC Limited', 1, 0.05, 0.0, 'XX', NULL, 'EQ', TRUE, NOW()),
  ('inst_nse_lt', 'NSE_LT', 'NSE', 'NSE_EQ', 'LT', 'LT-EQ', 'Larsen & Toubro Ltd', 'Larsen & Toubro Ltd', 1, 0.05, 0.0, 'XX', NULL, 'EQ', TRUE, NOW()),
  ('inst_nse_tatamotors', 'NSE_TATAMOTORS', 'NSE', 'NSE_EQ', 'TATAMOTORS', 'TATAMOTORS-EQ', 'Tata Motors Limited', 'Tata Motors Limited', 1, 0.05, 0.0, 'XX', NULL, 'EQ', TRUE, NOW()),
  ('inst_nse_tatasteel', 'NSE_TATASTEEL', 'NSE', 'NSE_EQ', 'TATASTEEL', 'TATASTEEL-EQ', 'Tata Steel Limited', 'Tata Steel Limited', 1, 0.05, 0.0, 'XX', NULL, 'EQ', TRUE, NOW()),
  ('inst_nse_maruti', 'NSE_MARUTI', 'NSE', 'NSE_EQ', 'MARUTI', 'MARUTI-EQ', 'Maruti Suzuki India Ltd', 'Maruti Suzuki India Ltd', 1, 0.05, 0.0, 'XX', NULL, 'EQ', TRUE, NOW()),
  ('inst_nse_bajfinance', 'NSE_BAJFINANCE', 'NSE', 'NSE_EQ', 'BAJFINANCE', 'BAJFINANCE-EQ', 'Bajaj Finance Limited', 'Bajaj Finance Limited', 1, 0.05, 0.0, 'XX', NULL, 'EQ', TRUE, NOW()),
  ('inst_nse_wipro', 'NSE_WIPRO', 'NSE', 'NSE_EQ', 'WIPRO', 'WIPRO-EQ', 'Wipro Limited', 'Wipro Limited', 1, 0.05, 0.0, 'XX', NULL, 'EQ', TRUE, NOW()),
  ('inst_nse_adanient', 'NSE_ADANIENT', 'NSE', 'NSE_EQ', 'ADANIENT', 'ADANIENT-EQ', 'Adani Enterprises Ltd', 'Adani Enterprises Ltd', 1, 0.05, 0.0, 'XX', NULL, 'EQ', TRUE, NOW()),
  ('inst_nse_zomato', 'NSE_ZOMATO', 'NSE', 'NSE_EQ', 'ZOMATO', 'ZOMATO-EQ', 'Zomato Limited (Eternal)', 'Zomato Limited (Eternal)', 1, 0.05, 0.0, 'XX', NULL, 'EQ', TRUE, NOW()),
  ('inst_nse_kotakbank', 'NSE_KOTAKBANK', 'NSE', 'NSE_EQ', 'KOTAKBANK', 'KOTAKBANK-EQ', 'Kotak Mahindra Bank', 'Kotak Mahindra Bank', 1, 0.05, 0.0, 'XX', NULL, 'EQ', TRUE, NOW()),
  ('inst_nse_axisbank', 'NSE_AXISBANK', 'NSE', 'NSE_EQ', 'AXISBANK', 'AXISBANK-EQ', 'Axis Bank Limited', 'Axis Bank Limited', 1, 0.05, 0.0, 'XX', NULL, 'EQ', TRUE, NOW()),
  ('inst_nse_hcltech', 'NSE_HCLTECH', 'NSE', 'NSE_EQ', 'HCLTECH', 'HCLTECH-EQ', 'HCL Technologies Ltd', 'HCL Technologies Ltd', 1, 0.05, 0.0, 'XX', NULL, 'EQ', TRUE, NOW()),
  ('inst_nse_sunpharma', 'NSE_SUNPHARMA', 'NSE', 'NSE_EQ', 'SUNPHARMA', 'SUNPHARMA-EQ', 'Sun Pharmaceutical Ind', 'Sun Pharmaceutical Ind', 1, 0.05, 0.0, 'XX', NULL, 'EQ', TRUE, NOW()),
  ('inst_nse_ntpc', 'NSE_NTPC', 'NSE', 'NSE_EQ', 'NTPC', 'NTPC-EQ', 'NTPC Limited', 'NTPC Limited', 1, 0.05, 0.0, 'XX', NULL, 'EQ', TRUE, NOW()),
  ('inst_nse_powergrid', 'NSE_POWERGRID', 'NSE', 'NSE_EQ', 'POWERGRID', 'POWERGRID-EQ', 'Power Grid Corp of India', 'Power Grid Corp of India', 1, 0.05, 0.0, 'XX', NULL, 'EQ', TRUE, NOW()),
  ('inst_nse_titan', 'NSE_TITAN', 'NSE', 'NSE_EQ', 'TITAN', 'TITAN-EQ', 'Titan Company Limited', 'Titan Company Limited', 1, 0.05, 0.0, 'XX', NULL, 'EQ', TRUE, NOW()),
  ('inst_nse_hal', 'NSE_HAL', 'NSE', 'NSE_EQ', 'HAL', 'HAL-EQ', 'Hindustan Aeronautics Ltd', 'Hindustan Aeronautics Ltd', 1, 0.05, 0.0, 'XX', NULL, 'EQ', TRUE, NOW()),
  ('inst_nse_bel', 'NSE_BEL', 'NSE', 'NSE_EQ', 'BEL', 'BEL-EQ', 'Bharat Electronics Ltd', 'Bharat Electronics Ltd', 1, 0.05, 0.0, 'XX', NULL, 'EQ', TRUE, NOW()),
  ('inst_nse_coalindia', 'NSE_COALINDIA', 'NSE', 'NSE_EQ', 'COALINDIA', 'COALINDIA-EQ', 'Coal India Limited', 'Coal India Limited', 1, 0.05, 0.0, 'XX', NULL, 'EQ', TRUE, NOW()),
  ('inst_nse_tatapower', 'NSE_TATAPOWER', 'NSE', 'NSE_EQ', 'TATAPOWER', 'TATAPOWER-EQ', 'Tata Power Company Ltd', 'Tata Power Company Ltd', 1, 0.05, 0.0, 'XX', NULL, 'EQ', TRUE, NOW()),
  ('inst_nse_jiofin', 'NSE_JIOFIN', 'NSE', 'NSE_EQ', 'JIOFIN', 'JIOFIN-EQ', 'Jio Financial Services Ltd', 'Jio Financial Services Ltd', 1, 0.05, 0.0, 'XX', NULL, 'EQ', TRUE, NOW()),
  ('inst_nse_hindunilvr', 'NSE_HINDUNILVR', 'NSE', 'NSE_EQ', 'HINDUNILVR', 'HINDUNILVR-EQ', 'Hindustan Unilever Ltd', 'Hindustan Unilever Ltd', 1, 0.05, 0.0, 'XX', NULL, 'EQ', TRUE, NOW())
ON CONFLICT (instrument_token) DO UPDATE SET
  symbol = EXCLUDED.symbol,
  trading_symbol = EXCLUDED.trading_symbol,
  name = EXCLUDED.name,
  company_name = EXCLUDED.company_name,
  active = TRUE,
  last_seen_at = NOW();
