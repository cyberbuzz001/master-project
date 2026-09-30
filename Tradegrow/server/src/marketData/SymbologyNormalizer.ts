/**
 * SymbologyNormalizer.ts
 * Centralized utility for resolving multi-format option symbols & instrument tokens
 * across internal formats, Dhan HQ API security IDs, OpenAlgo formats, and broker feeds.
 */

export class SymbologyNormalizer {
  /**
   * Given any input token or symbol (e.g. 'NIFTY 24200 CE', 'NFO_NIFTY_24500_CE', 'NSE_NIFTY24500CE', 'NIFTY30DEC2524500CE', 'BFO_SENSEX_78400_CE'),
   * returns an array of ALL possible lookup alias keys for MarketDataEngine cache matching.
   */
  public static normalizeToken(raw: string): string[] {
    if (!raw) return [];

    const input = raw.trim().toUpperCase();
    const keys = new Set<string>([input]);

    // Strip prefix segment if present (e.g. NFO_, NSE_, BFO_, BSE_)
    const noPrefix = input.replace(/^(NSE_|BSE_|NFO_|BFO_)/, '');
    keys.add(noPrefix);

    // Strip series suffix if present (e.g. -EQ, -BE, -SM, -ST, _EQ)
    const baseSym = noPrefix.replace(/[-_](EQ|BE|SM|ST)$/i, '');
    keys.add(baseSym);
    keys.add(`NSE_${baseSym}`);
    keys.add(`BSE_${baseSym}`);
    keys.add(`${baseSym}-EQ`);
    keys.add(`NSE_${baseSym}-EQ`);

    // Normalize spacing and underscores (e.g. 'NIFTY 24200 CE' -> 'NIFTY_24200_CE')
    const cleanedWithUnderscores = noPrefix.replace(/[\s\-_]+/g, '_');
    const compactNoSpaces = noPrefix.replace(/\s+/g, '');
    const spacedFormat = noPrefix.replace(/[\s\-_]+/g, ' ');

    keys.add(cleanedWithUnderscores);
    keys.add(compactNoSpaces);
    keys.add(spacedFormat);

    // Canonical index token alias expansions
    if (
      input === 'NSE_NIFTY50' || input === 'NSE_NIFTY' || input === 'NIFTY' ||
      input === 'NIFTY50' || input === 'NIFTY 50' || input === 'NSE NIFTY 50' || input === 'NSE NIFTY'
    ) {
      keys.add('NSE_NIFTY50');
      keys.add('NSE_NIFTY');
      keys.add('NIFTY');
      keys.add('NIFTY50');
      keys.add('NIFTY 50');
      keys.add('NSE NIFTY 50');
      keys.add('NSE NIFTY');
    } else if (
      input === 'BSE_SENSEX' || input === 'SENSEX' || input === 'BSE SENSEX' ||
      input === 'BSE_SENSEX50' || input === 'SENSEX 50'
    ) {
      keys.add('BSE_SENSEX');
      keys.add('SENSEX');
      keys.add('BSE SENSEX');
    } else if (
      input === 'NSE_BANKNIFTY' || input === 'BANKNIFTY' || input === 'BANK NIFTY' ||
      input === 'NIFTY BANK' || input === 'NSE BANKNIFTY'
    ) {
      keys.add('NSE_BANKNIFTY');
      keys.add('BANKNIFTY');
      keys.add('BANK NIFTY');
      keys.add('NIFTY BANK');
      keys.add('NSE BANKNIFTY');
    } else if (
      input === 'NSE_FINNIFTY' || input === 'FINNIFTY' || input === 'FIN NIFTY' ||
      input === 'NIFTY FIN SERVICE' || input === 'NSE FINNIFTY'
    ) {
      keys.add('NSE_FINNIFTY');
      keys.add('FINNIFTY');
      keys.add('FIN NIFTY');
      keys.add('NIFTY FIN SERVICE');
      keys.add('NSE FINNIFTY');
    } else if (
      input === 'NSE_MIDCPNIFTY' || input === 'MIDCPNIFTY' || input === 'MIDCAP NIFTY' ||
      input === 'NIFTY MID SELECT' || input === 'NSE MIDCPNIFTY'
    ) {
      keys.add('NSE_MIDCPNIFTY');
      keys.add('MIDCPNIFTY');
      keys.add('MIDCAP NIFTY');
      keys.add('NIFTY MID SELECT');
      keys.add('NSE MIDCPNIFTY');
    }

    // Regex match option format: [UNDERLYING][STRIKE][CE|PE]
    // Handles: NIFTY 24500 CE, NIFTY_24500_CE, NIFTY24500CE, NFO_NIFTY_24500_CE, SENSEX 78400 PE
    const match = cleanedWithUnderscores.match(/^([A-Z0-9]+)_(\d+(?:\.\d+)?)_(CE|PE)$/) ||
                  compactNoSpaces.match(/^([A-Z0-9]+?)(\d+(?:\.\d+)?)(CE|PE)$/);

    if (match) {
      const underlying = match[1].replace(/^(NFO_|BFO_|NSE_|BSE_)/, '');
      const strike = match[2];
      const optType = match[3];

      const segment = (underlying === 'SENSEX' || underlying.includes('BSE')) ? 'BFO' : 'NFO';
      const exchSegment = (underlying === 'SENSEX' || underlying.includes('BSE')) ? 'BSE' : 'NSE';

      // Internal standard token: NFO_NIFTY_24500_CE
      keys.add(`${segment}_${underlying}_${strike}_${optType}`);
      keys.add(`${exchSegment}_${underlying}_${strike}_${optType}`);

      // Compact standard token: NSE_NIFTY24500CE / NIFTY24500CE
      keys.add(`${exchSegment}_${underlying}${strike}${optType}`);
      keys.add(`${underlying}${strike}${optType}`);

      // Underscore format: NIFTY_24500_CE
      keys.add(`${underlying}_${strike}_${optType}`);

      // Spaced format: NIFTY 24500 CE
      keys.add(`${underlying} ${strike} ${optType}`);
    }

    return Array.from(keys);
  }

  /**
   * Parses underlying/strike/optionType out of a raw symbol or instrument
   * token string (e.g. 'NIFTY 24500 CE', 'NFO_NIFTY_24500_CE', 'NIFTY24500CE').
   * Returns null when the string doesn't match the expected option-symbol
   * shape (e.g. an equity symbol) — callers should treat that as "not an
   * option", not fabricate a partial result.
   */
  public static parseOptionSymbol(symbol: string): { underlying: string; strike: number; optionType: 'CE' | 'PE' } | null {
    if (!symbol) return null;
    const clean = symbol.trim().replace(/^(?:NFO|BFO|NSE|BSE)_/i, '');

    // 1. Delimited formats: NFO_NIFTY_24500_CE, NIFTY 24500 CE, NIFTY-24500-CE, BFO_SENSEX_78400_PE
    const delimMatch = clean.match(/^([A-Za-z]+)[_\s-]+(?:[A-Za-z0-9]+[_\s-]+)?(\d+(?:\.\d+)?)[_\s-]*(CE|PE)$/i);
    if (delimMatch) {
      return {
        underlying: delimMatch[1].toUpperCase(),
        strike: parseFloat(delimMatch[2]),
        optionType: delimMatch[3].toUpperCase() as 'CE' | 'PE',
      };
    }

    // 2. Compact formats: must end with CE or PE
    const compactEnd = clean.match(/(CE|PE)$/i);
    if (!compactEnd) return null;
    const optType = compactEnd[1].toUpperCase() as 'CE' | 'PE';
    const body = clean.slice(0, -2); // everything before CE/PE

    // Extract underlying letters from front
    const underMatch = body.match(/^([A-Za-z]+)/);
    if (!underMatch) return null;
    const underlying = underMatch[1].toUpperCase();
    const rest = body.slice(underlying.length);

    // (a) Pure strike: e.g. '24500' -> NIFTY24500CE
    if (/^\d+(?:\.\d+)?$/.test(rest)) {
      const s = parseFloat(rest);
      if (s > 0) return { underlying, strike: s, optionType: optType };
    }

    // (b) Month name present (e.g. 24DEC24500 or 30DEC2524500)
    const monthMatch = rest.match(/^(\d{1,2})([A-Za-z]{3})(\d+)$/i);
    if (monthMatch) {
      let strike = parseFloat(monthMatch[3]);
      // If strike is > 150000 and has trailing year embedded, e.g. 2524500 -> year 25, strike 24500
      if (strike > 150000 && monthMatch[3].length >= 6) {
        const yearPart = monthMatch[3].slice(0, 2);
        const strikePart = monthMatch[3].slice(2);
        if (/^(2[0-9]|3[0-5])$/.test(yearPart)) {
          strike = parseFloat(strikePart);
        }
      }
      if (strike > 0) return { underlying, strike, optionType: optType };
    }

    // (c) NSE weekly format: YY + 1-char-month + DD + STRIKE, e.g. 24D3024500
    const nseWeekly = rest.match(/^(?:2[0-9]|3[0-5])[A-Za-z\d][0-3]\d(\d+(?:\.\d+)?)$/i);
    if (nseWeekly) {
      const s = parseFloat(nseWeekly[1]);
      if (s > 0) return { underlying, strike: s, optionType: optType };
    }

    // Fallback: match digits at the end of body as strike
    const endDigits = rest.match(/(\d+(?:\.\d+)?)$/);
    if (endDigits) {
      const s = parseFloat(endDigits[1]);
      if (s > 0) return { underlying, strike: s, optionType: optType };
    }

    return null;
  }

  /**
   * Generates canonical internal instrument token: NFO_NIFTY_24500_CE or BFO_SENSEX_78400_CE
   */
  public static toInternalToken(underlying: string, strike: number, optionType: 'CE' | 'PE'): string {
    const cleanSym = (underlying || 'NIFTY').toUpperCase().replace(/^(NSE_|BSE_|NFO_|BFO_)/, '');
    const segment = cleanSym === 'SENSEX' ? 'BFO' : 'NFO';
    return `${segment}_${cleanSym}_${strike}_${optionType}`;
  }

  /**
   * Generates OpenAlgo standard trading symbol: NIFTY30DEC2524500CE
   */
  public static toOpenAlgoSymbol(underlying: string, expiryDate: string, strike: number, optionType: 'CE' | 'PE'): string {
    const cleanSym = (underlying || 'NIFTY').toUpperCase().replace(/^(NSE_|BSE_|NFO_|BFO_)/, '');
    const cleanExpiry = (expiryDate || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return `${cleanSym}${cleanExpiry}${strike}${optionType}`;
  }
}
