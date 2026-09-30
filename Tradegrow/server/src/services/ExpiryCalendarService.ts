import { query, queryOne, execute } from '../db/schema';

export interface ExpiryCalendarConfig {
  id: string;
  indexName: string;
  exchange: string;
  underlyingSymbol: string;
  tradingSymbolPrefix: string;
  weeklyExpirySupported: boolean;
  monthlyExpirySupported: boolean;
  expiryWeekday: number; // 0=Sun .. 6=Sat
  holidayAdjustmentRule: 'PREVIOUS_TRADING_DAY' | 'NEXT_TRADING_DAY';
  active: boolean;
}

export interface ExpiryCategorization {
  nearestExpiry: string | null;
  nextExpiry: string | null;
  monthlyExpiry: string | null;
  allExpiries: string[];
}

export class ExpiryCalendarService {
  private static instance: ExpiryCalendarService;

  public static getInstance(): ExpiryCalendarService {
    if (!ExpiryCalendarService.instance) {
      ExpiryCalendarService.instance = new ExpiryCalendarService();
    }
    return ExpiryCalendarService.instance;
  }

  /**
   * Retrieves active Expiry Calendar config for a given index or underlying symbol
   */
  public async getCalendarConfig(indexOrSymbol: string): Promise<ExpiryCalendarConfig | null> {
    const symbolClean = (indexOrSymbol || 'NIFTY').toUpperCase().replace(' ', '');

    const row = await queryOne<any>(
      `SELECT * FROM expiry_calendars
       WHERE active = TRUE AND (UPPER(index_name) = $1 OR UPPER(trading_symbol_prefix) = $1 OR UPPER(underlying_symbol) = $1)
       LIMIT 1`,
      [symbolClean]
    );

    if (!row) return null;

    return {
      id: row.id,
      indexName: row.index_name,
      exchange: row.exchange,
      underlyingSymbol: row.underlying_symbol,
      tradingSymbolPrefix: row.trading_symbol_prefix,
      weeklyExpirySupported: Boolean(row.weekly_expiry_supported),
      monthlyExpirySupported: Boolean(row.monthly_expiry_supported),
      expiryWeekday: parseInt(row.expiry_weekday, 10),
      holidayAdjustmentRule: row.holiday_adjustment_rule || 'PREVIOUS_TRADING_DAY',
      active: Boolean(row.active),
    };
  }

  /**
   * Returns all active Expiry Calendar configurations
   */
  public async getAllCalendarConfigs(): Promise<ExpiryCalendarConfig[]> {
    const rows = await query<any>('SELECT * FROM expiry_calendars ORDER BY index_name ASC');
    return rows.map(row => ({
      id: row.id,
      indexName: row.index_name,
      exchange: row.exchange,
      underlyingSymbol: row.underlying_symbol,
      tradingSymbolPrefix: row.trading_symbol_prefix,
      weeklyExpirySupported: Boolean(row.weekly_expiry_supported),
      monthlyExpirySupported: Boolean(row.monthly_expiry_supported),
      expiryWeekday: parseInt(row.expiry_weekday, 10),
      holidayAdjustmentRule: row.holiday_adjustment_rule || 'PREVIOUS_TRADING_DAY',
      active: Boolean(row.active),
    }));
  }

  private static expiryCache: Map<string, { timestamp: number; data: ExpiryCategorization }> = new Map();

  /**
   * Resolves valid non-expired tradable expiries for an underlying symbol.
   * Prioritizes fast in-memory cache and live Dhan HQ API, with calendar rules fallback.
   */
  public async getValidExpiries(underlying: string): Promise<ExpiryCategorization> {
    const todayStr = this.getTodayIST();
    const cleanSym = (underlying || 'NIFTY').toUpperCase().replace(/^(NSE_|BSE_)/, '').replace(' ', '');

    // 0. Fast In-Memory Cache (60s TTL)
    const cached = ExpiryCalendarService.expiryCache.get(cleanSym);
    if (cached && Date.now() - cached.timestamp < 60000 && cached.data.allExpiries.length > 0) {
      return cached.data;
    }

    // 1. Query live Dhan API first (authoritative & fast <50ms)
    let dhanExpiries: string[] = [];
    try {
      const { MarketDataEngine } = await import('../marketData/MarketDataEngine');
      const dhan = MarketDataEngine.getInstance().getDhanAdapter();
      dhanExpiries = await Promise.race([
        dhan.getExpiryList(cleanSym),
        new Promise<string[]>((res) => setTimeout(() => res([]), 2000))
      ]);
    } catch (_) {}

    // 2. Fast calendar calculation from exchange rules
    const calculatedExpiries = await this.generateCalculatedExpiries(cleanSym);

    // Combine expiries
    let allExpiriesCombined = Array.from(new Set([...dhanExpiries, ...calculatedExpiries]))
      .filter(e => e && e >= todayStr)
      .sort();

    // 3. Fallback to DB only if combined is still empty
    if (allExpiriesCombined.length === 0) {
      try {
        const rows = await query<{ expiry: string }>(
          `SELECT DISTINCT expiry FROM instruments
           WHERE (UPPER(symbol) = $1 OR UPPER(name) = $1)
             AND expiry IS NOT NULL AND expiry >= $2
           ORDER BY expiry ASC LIMIT 20`,
          [cleanSym, todayStr]
        );
        const dbExpiries = rows.map(r => {
          if (!r.expiry) return '';
          const d = new Date(r.expiry);
          return isNaN(d.getTime()) ? '' : this.formatYYYYMMDD(d);
        }).filter(Boolean);
        allExpiriesCombined = Array.from(new Set([...dbExpiries, ...calculatedExpiries])).filter(e => e >= todayStr).sort();
      } catch (_) {}
    }

    const nearestExpiry = allExpiriesCombined[0] || null;
    const nextExpiry = allExpiriesCombined[1] || null;
    const monthlyExpiry = this.resolveMonthlyExpiry(allExpiriesCombined) || nearestExpiry;

    const result: ExpiryCategorization = {
      nearestExpiry,
      nextExpiry,
      monthlyExpiry,
      allExpiries: allExpiriesCombined,
    };

    ExpiryCalendarService.expiryCache.set(cleanSym, { timestamp: Date.now(), data: result });
    return result;
  }

  /**
   * Validates whether a given expiry date is currently active and non-expired.
   */
  public async isValidExpiry(underlying: string, expiryDate: string): Promise<boolean> {
    if (!expiryDate) return false;
    const today = this.getTodayIST();
    if (expiryDate < today) return false; // Expired contract rejection

    const categories = await this.getValidExpiries(underlying);
    return categories.allExpiries.includes(expiryDate);
  }

  private getTodayIST(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  }

  /**
   * Helper to format Date object to IST YYYY-MM-DD string without UTC offset shifts
   */
  private formatYYYYMMDD(d: Date): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
  }

  /**
   * Helper to calculate dynamic upcoming expiry dates based on calendar rules
   */
  private async generateCalculatedExpiries(symbol: string): Promise<string[]> {
    const config = await this.getCalendarConfig(symbol);
    const isWeeklySupported = config ? config.weeklyExpirySupported : true;
    const targetWeekday = config ? config.expiryWeekday : (symbol.toUpperCase().includes('SENSEX') ? 4 : 2);
    const todayStr = this.formatYYYYMMDD(new Date());

    const expiries: string[] = [];
    const now = new Date();

    if (!isWeeklySupported) {
      // Monthly Expiry Only (BANKNIFTY, FINNIFTY, MIDCPNIFTY -> Last Tuesday of target month)
      for (let m = 0; m < 6; m++) {
        const year = now.getFullYear();
        const month = now.getMonth() + m;
        const lastDayOfMonth = new Date(year, month + 1, 0);
        let lastTargetDay = new Date(lastDayOfMonth);

        while (lastTargetDay.getDay() !== targetWeekday) {
          lastTargetDay.setDate(lastTargetDay.getDate() - 1);
        }

        // Holiday adjustment if Sat/Sun
        if (lastTargetDay.getDay() === 6) lastTargetDay.setDate(lastTargetDay.getDate() - 1);
        if (lastTargetDay.getDay() === 0) lastTargetDay.setDate(lastTargetDay.getDate() - 2);

        const expStr = this.formatYYYYMMDD(lastTargetDay);
        if (expStr >= todayStr && !expiries.includes(expStr)) {
          expiries.push(expStr);
        }
      }
      return expiries.sort();
    }

    // Weekly Expiries (NIFTY -> Tuesday, SENSEX -> Thursday)
    for (let w = 0; w < 6; w++) {
      const d = new Date(now);
      const currentDay = d.getDay();
      let daysUntilTarget = (targetWeekday - currentDay + 7) % 7;
      if (daysUntilTarget === 0 && d.getHours() >= 15 && d.getMinutes() >= 30) {
        daysUntilTarget = 7; // Past market close on expiry day
      }
      d.setDate(d.getDate() + daysUntilTarget + (w * 7));

      // Holiday adjustment: if Weekend (Sat/Sun), adjust to Friday/Previous trading day
      if (d.getDay() === 6) d.setDate(d.getDate() - 1); // Sat -> Fri
      if (d.getDay() === 0) d.setDate(d.getDate() - 2); // Sun -> Fri

      const expStr = this.formatYYYYMMDD(d);
      if (!expiries.includes(expStr)) {
        expiries.push(expStr);
      }
    }

    return expiries.sort();
  }

  /**
   * Resolves the monthly contract expiry (Last Tuesday of the target month for NIFTY/SENSEX, or last valid weekday of the month)
   */
  private resolveMonthlyExpiry(expiries: string[]): string | null {
    if (expiries.length === 0) return null;
    const firstExp = expiries[0];
    const year = parseInt(firstExp.slice(0, 4), 10);
    const month = parseInt(firstExp.slice(5, 7), 10) - 1; // 0-indexed month

    // Calculate Last Tuesday of the month (weekday 2)
    const lastDayOfMonth = new Date(year, month + 1, 0); // last day of month
    let lastTuesday = new Date(lastDayOfMonth);
    while (lastTuesday.getDay() !== 2) { // 2 = Tuesday
      lastTuesday.setDate(lastTuesday.getDate() - 1);
    }

    // Holiday adjustment for Last Tuesday if Sat/Sun
    if (lastTuesday.getDay() === 6) lastTuesday.setDate(lastTuesday.getDate() - 1);
    if (lastTuesday.getDay() === 0) lastTuesday.setDate(lastTuesday.getDate() - 2);

    const lastTuesdayStr = this.formatYYYYMMDD(lastTuesday);

    const monthStr = firstExp.slice(0, 7);
    const currentMonthExpiries = expiries.filter(e => e.startsWith(monthStr));

    if (currentMonthExpiries.includes(lastTuesdayStr)) {
      return lastTuesdayStr;
    }

    if (currentMonthExpiries.length > 0) {
      return currentMonthExpiries[currentMonthExpiries.length - 1];
    }

    return expiries[expiries.length - 1] || null;
  }

  /**
   * Resolves the exact contract expiry date (YYYY-MM-DD) for a given symbol and entry/order timestamp.
   */
  public async resolveContractExpiryDate(symbol: string, entryTimestamp?: Date | string | null): Promise<string> {
    if (!symbol) return this.getTodayIST();

    const clean = symbol.toUpperCase().trim();

    // 1. Try regex parsing from explicit date in symbol (e.g. NIFTY28AUG2624500CE, SENSEX_2026-09-03_76900_CE)
    const isoMatch = clean.match(/(\d{4}-\d{2}-\d{2})/);
    if (isoMatch) return isoMatch[1];

    const months: Record<string, string> = {
      JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
      JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12'
    };
    const textMatch = clean.match(/(\d{1,2})([A-Z]{3})(\d{2,4})/);
    if (textMatch) {
      const day = textMatch[1].padStart(2, '0');
      const month = months[textMatch[2]];
      let year = textMatch[3];
      if (year.length === 2) year = `20${year}`;
      if (month) return `${year}-${month}-${day}`;
    }

    // 2. Lookup in Dhan / Instrument Master if available
    try {
      const { InstrumentMasterService } = await import('../marketData/InstrumentMasterService');
      const scrip = InstrumentMasterService.getInstance().getDhanScripByToken(clean);
      if (scrip?.expiryDate) {
        return scrip.expiryDate;
      }
    } catch (_) {}

    // 3. Calculate based on entry timestamp and underlying index expiry rules
    const entryDate = entryTimestamp ? new Date(entryTimestamp) : new Date();
    const config = await this.getCalendarConfig(clean);
    const targetWeekday = config ? config.expiryWeekday : (clean.includes('SENSEX') || clean.includes('BSE') ? 4 : 2);

    const d = new Date(entryDate);
    const currentDay = d.getDay();
    let daysUntilTarget = (targetWeekday - currentDay + 7) % 7;
    // If entered on expiry day after 15:30, it belonged to that day's expiry (or next week if entered post-market)
    d.setDate(d.getDate() + daysUntilTarget);

    // Holiday / weekend adjustment (Sat -> Fri, Sun -> Fri)
    if (d.getDay() === 6) d.setDate(d.getDate() - 1);
    if (d.getDay() === 0) d.setDate(d.getDate() - 2);

    return this.formatYYYYMMDD(d);
  }
}

export const expiryCalendarService = ExpiryCalendarService.getInstance();

