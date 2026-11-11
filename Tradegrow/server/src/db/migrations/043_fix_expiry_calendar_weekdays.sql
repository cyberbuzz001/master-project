-- ============================================================
-- Migration 043: Fix Expiry Calendar Weekdays for Indian Indices
-- Corrects expiry weekdays to match NSE & BSE authoritative schedules:
-- NIFTY (NSE): Weekly & Monthly Thursday (weekday 4)
-- SENSEX (BSE): Weekly & Monthly Friday (weekday 5)
-- BANKNIFTY (NSE): Monthly Thursday (weekday 4)
-- BANKEX (BSE): Monthly Friday (weekday 5)
-- FINNIFTY (NSE): Monthly Tuesday (weekday 2)
-- MIDCPNIFTY (NSE): Monthly Monday (weekday 1)
-- ============================================================

UPDATE expiry_calendars SET expiry_weekday = 4, updated_at = NOW() WHERE index_name = 'NIFTY';
UPDATE expiry_calendars SET expiry_weekday = 5, updated_at = NOW() WHERE index_name = 'SENSEX';
UPDATE expiry_calendars SET expiry_weekday = 4, updated_at = NOW() WHERE index_name = 'BANKNIFTY';
UPDATE expiry_calendars SET expiry_weekday = 5, updated_at = NOW() WHERE index_name = 'BANKEX';
UPDATE expiry_calendars SET expiry_weekday = 2, updated_at = NOW() WHERE index_name = 'FINNIFTY';
UPDATE expiry_calendars SET expiry_weekday = 1, updated_at = NOW() WHERE index_name = 'MIDCPNIFTY';

