/**
 * Trading-session gate for order placement.
 *
 * Segment-aware on purpose: MCX commodities trade well past the equity close,
 * so a single 9:15–3:30 window (the one MarketDataEngine.isMarketHours uses for
 * the tick feed) would silently kill every commodity order after 3:30 PM.
 * Keep these two notions separate — this module governs whether an ORDER is
 * accepted; MarketDataEngine.isMarketHours governs whether the DATA FEED is
 * expected to be live (and is deliberately overridable via
 * ALLOW_OFF_MARKET_LIVE_DATA so the simulator can stream ticks off-hours).
 *
 * Three things close the market here: the time-of-day window, weekends, and the
 * exchange holiday calendar in `trading_holidays` (migration 027).
 */
import { query } from '../db/schema';

export interface SessionWindow {
  /** Minutes from IST midnight. */
  openMins: number;
  closeMins: number;
  label: string;
}

export type HolidaySegment = 'EQUITY' | 'COMMODITY';

const EQUITY_SESSION: SessionWindow = { openMins: 9 * 60 + 15, closeMins: 15 * 60 + 30, label: '9:15 AM to 3:30 PM IST' };
const COMMODITY_SESSION: SessionWindow = { openMins: 9 * 60, closeMins: 23 * 60 + 30, label: '9:00 AM to 11:30 PM IST' };

const HOLIDAY_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // holidays change rarely; a stale-by-hours read is harmless

export function segmentForExchange(exchange?: string): HolidaySegment {
  return (exchange || '').toUpperCase() === 'MCX' ? 'COMMODITY' : 'EQUITY';
}

export function sessionForExchange(exchange?: string): SessionWindow {
  return segmentForExchange(exchange) === 'COMMODITY' ? COMMODITY_SESSION : EQUITY_SESSION;
}

/** Current IST weekday (0=Sun..6=Sat) and minutes-from-midnight. */
function nowInIST(): { day: number; mins: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  // 'en-US' with hour12:false renders midnight as '24' — normalise it to 0.
  const hour = parseInt(get('hour'), 10) % 24;
  return { day: dayMap[get('weekday')] ?? 1, mins: hour * 60 + parseInt(get('minute'), 10) };
}

/** Today's date in IST as YYYY-MM-DD. */
export function istDateString(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

/**
 * Time-of-day and weekend check only — no DB access, so this stays pure and
 * directly unit-testable. Holiday handling lives in isOrderWindowOpen.
 */
export function checkSessionWindow(exchange?: string, now = nowInIST()): { open: boolean; reason?: string } {
  const session = sessionForExchange(exchange);
  if (now.day === 0 || now.day === 6) {
    const seg = segmentForExchange(exchange) === 'COMMODITY' ? 'Commodity' : 'Equity and F&O';
    return { open: false, reason: `Markets are closed on weekends. ${seg} trading resumes Monday, ${session.label}.` };
  }
  if (now.mins < session.openMins || now.mins > session.closeMins) {
    return { open: false, reason: `Markets are closed. Orders can be placed between ${session.label}, Monday to Friday.` };
  }
  return { open: true };
}

let holidayCache: { loadedAt: number; bySegment: Record<HolidaySegment, Map<string, string>> } | null = null;

async function loadHolidays(): Promise<Record<HolidaySegment, Map<string, string>> | null> {
  if (holidayCache && Date.now() - holidayCache.loadedAt < HOLIDAY_CACHE_TTL_MS) return holidayCache.bySegment;
  try {
    // to_char keeps the comparison in plain YYYY-MM-DD strings — a DATE column
    // read through pg comes back as a JS Date in the server's own timezone,
    // which would shift the day for a UTC-hosted process.
    const rows = await query<{ d: string; segment: string; description: string }>(
      `SELECT to_char(holiday_date, 'YYYY-MM-DD') AS d, segment, description FROM trading_holidays`
    );
    const bySegment: Record<HolidaySegment, Map<string, string>> = { EQUITY: new Map(), COMMODITY: new Map() };
    for (const r of rows) {
      if (r.segment === 'ALL') {
        bySegment.EQUITY.set(r.d, r.description);
        bySegment.COMMODITY.set(r.d, r.description);
      } else if (r.segment === 'EQUITY' || r.segment === 'COMMODITY') {
        bySegment[r.segment].set(r.d, r.description);
      }
    }
    holidayCache = { loadedAt: Date.now(), bySegment };
    return bySegment;
  } catch (err: any) {
    // Fail OPEN. Accepting an order on a holiday is a far smaller problem than
    // rejecting every order on the platform because one lookup failed.
    console.error('[marketHours] Holiday calendar lookup failed — allowing orders through:', err?.message || err);
    return null;
  }
}

/** Drops the cached calendar so the next check re-reads it (call after editing holidays). */
export function invalidateHolidayCache(): void {
  holidayCache = null;
}

/**
 * Whether orders may be placed right now on the given exchange.
 * Enforcement can be switched off with ENFORCE_MARKET_HOURS=false — an escape
 * hatch for testing/demos, not something to leave off in production.
 */
export async function isOrderWindowOpen(exchange?: string): Promise<{ open: boolean; reason?: string }> {
  if (process.env.ENFORCE_MARKET_HOURS === 'false') return { open: true };

  const windowCheck = checkSessionWindow(exchange);
  if (!windowCheck.open) return windowCheck;

  const holidays = await loadHolidays();
  if (!holidays) return { open: true }; // lookup failed — see loadHolidays
  const today = istDateString();
  const description = holidays[segmentForExchange(exchange)].get(today);
  if (description) {
    return { open: false, reason: `Markets are closed today for ${description}. Orders cannot be placed on an exchange holiday.` };
  }
  return { open: true };
}
