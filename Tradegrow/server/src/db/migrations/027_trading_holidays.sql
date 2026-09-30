-- Migration 027: Exchange trading-holiday calendar
--
-- Gates order placement on exchange holidays (utils/marketHours.ts). Kept in a
-- table rather than a code constant so a date can be corrected, or next year's
-- calendar loaded, without a deploy — NSE publishes the list annually and does
-- occasionally amend it mid-year (an added election holiday, a shifted Muhurat
-- session).
--
-- `segment` follows the exchange's own split: NSE/BSE equity + derivatives share
-- one calendar, MCX publishes its own. 'ALL' applies to every segment.
CREATE TABLE IF NOT EXISTS trading_holidays (
  holiday_date DATE NOT NULL,
  segment      TEXT NOT NULL DEFAULT 'EQUITY' CHECK (segment IN ('EQUITY', 'COMMODITY', 'ALL')),
  description  TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (holiday_date, segment)
);

CREATE INDEX IF NOT EXISTS idx_trading_holidays_date ON trading_holidays(holiday_date);

-- NSE equity / equity-derivatives / SLB trading holidays for calendar 2026.
-- Source: NSE annual holiday circular, cross-checked against two independent
-- published mirrors of it; every weekday verified. VERIFY against the official
-- circular at nseindia.com/resources/exchange-communication-holidays before
-- relying on this in production, and reload when NSE publishes 2027.
-- Weekends are already blocked in code and are not listed here.
-- Note: Diwali Laxmi Pujan (2026-11-08) is a Sunday with a special Muhurat
-- session; it is deliberately NOT listed as a holiday. Muhurat trading is not
-- modelled — that session will be closed on this platform.
INSERT INTO trading_holidays (holiday_date, segment, description) VALUES
  ('2026-01-15', 'EQUITY', 'Municipal Corporation Election - Maharashtra'),
  ('2026-01-26', 'EQUITY', 'Republic Day'),
  ('2026-03-03', 'EQUITY', 'Holi'),
  ('2026-03-26', 'EQUITY', 'Shri Ram Navami'),
  ('2026-03-31', 'EQUITY', 'Shri Mahavir Jayanti'),
  ('2026-04-03', 'EQUITY', 'Good Friday'),
  ('2026-04-14', 'EQUITY', 'Dr. Baba Saheb Ambedkar Jayanti'),
  ('2026-05-01', 'EQUITY', 'Maharashtra Day'),
  ('2026-05-28', 'EQUITY', 'Bakri Id'),
  ('2026-06-26', 'EQUITY', 'Muharram'),
  ('2026-09-14', 'EQUITY', 'Ganesh Chaturthi'),
  ('2026-10-02', 'EQUITY', 'Mahatma Gandhi Jayanti'),
  ('2026-10-20', 'EQUITY', 'Dussehra'),
  ('2026-11-10', 'EQUITY', 'Diwali - Balipratipada'),
  ('2026-11-24', 'EQUITY', 'Prakash Gurpurb Sri Guru Nanak Dev'),
  ('2026-12-25', 'EQUITY', 'Christmas')
ON CONFLICT (holiday_date, segment) DO NOTHING;
