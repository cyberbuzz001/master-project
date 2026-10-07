/**
 * Symbology normalization utility for frontend tick cache matching.
 * Maps all variations of option and equity symbols (spaced, compact, prefixed, segmented)
 * so ticks received via WebSocket immediately update any component matching any representation.
 */

export function normalizeToken(raw: string): string[] {
  if (!raw) return [];

  const input = raw.trim().toUpperCase();
  const keys = new Set<string>([input]);

  // Strip prefix segment if present (e.g. NFO_, NSE_, BFO_, BSE_)
  const noPrefix = input.replace(/^(NSE_|BSE_|NFO_|BFO_)/, '');
  keys.add(noPrefix);

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

  // Regex match option format: [UNDERLYING][STRIKE][CE|PE] with optional [EXPIRY]
  // Handles:
  // - NIFTY 24500 CE, NIFTY_24500_CE, NIFTY24500CE, NFO_NIFTY_24500_CE, SENSEX 78400 PE
  // - NIFTY-Oct2026-22600-CE, NIFTY_OCT2026_22600_CE, NIFTY_26OCT_22600_CE, SENSEX-Oct2026-77900-PE
  const matchWithExpiry = cleanedWithUnderscores.match(/^([A-Z0-9]+)_([A-Z0-9]+)_(\d+(?:\.\d+)?)_(CE|PE)$/);
  const matchDirect = cleanedWithUnderscores.match(/^([A-Z0-9]+)_(\d+(?:\.\d+)?)_(CE|PE)$/) ||
                      compactNoSpaces.match(/^([A-Z0-9]+?)(\d+(?:\.\d+)?)(CE|PE)$/);

  let underlying = '';
  let strike = '';
  let optType = '';
  let expiry = '';

  if (matchWithExpiry) {
    underlying = matchWithExpiry[1].replace(/^(NFO_|BFO_|NSE_|BSE_|MCX_)/, '');
    expiry = matchWithExpiry[2];
    strike = matchWithExpiry[3];
    optType = matchWithExpiry[4];
  } else if (matchDirect) {
    underlying = matchDirect[1].replace(/^(NFO_|BFO_|NSE_|BSE_|MCX_)/, '');
    strike = matchDirect[2];
    optType = matchDirect[3];
  }

  if (underlying && strike && optType) {
    const isBse = underlying === 'SENSEX' || underlying.includes('BSE') || underlying === 'BANKEX';
    const isMcx = ['CRUDEOIL', 'GOLD', 'SILVER', 'NATURALGAS', 'COPPER'].includes(underlying);
    const segment = isMcx ? 'MCX' : isBse ? 'BFO' : 'NFO';
    const exchSegment = isMcx ? 'MCX' : isBse ? 'BSE' : 'NSE';

    // Canonical standard tokens (without expiry): NFO_NIFTY_22600_CE or BFO_SENSEX_77900_PE
    keys.add(`${segment}_${underlying}_${strike}_${optType}`);
    keys.add(`${exchSegment}_${underlying}_${strike}_${optType}`);

    // Compact standard token: NSE_NIFTY22600CE / NIFTY22600CE
    keys.add(`${exchSegment}_${underlying}${strike}${optType}`);
    keys.add(`${underlying}${strike}${optType}`);

    // Underscore format: NIFTY_22600_CE / SENSEX_77900_PE
    keys.add(`${underlying}_${strike}_${optType}`);

    // Spaced format: NIFTY 22600 CE / SENSEX 77900 PE
    keys.add(`${underlying} ${strike} ${optType}`);
    keys.add(`${exchSegment} ${underlying} ${strike} ${optType}`);
    keys.add(`${segment} ${underlying} ${strike} ${optType}`);

    // If an expiry segment was extracted, also preserve variations with expiry
    if (expiry) {
      keys.add(`${underlying}-${expiry}-${strike}-${optType}`);
      keys.add(`${underlying}_${expiry}_${strike}_${optType}`);
      keys.add(`${underlying} ${expiry} ${strike} ${optType}`);
      keys.add(`${segment}_${underlying}_${expiry}_${strike}_${optType}`);
      keys.add(`${exchSegment}_${underlying}_${expiry}_${strike}_${optType}`);
      keys.add(`${segment}_${underlying}_${strike}_${optType}_${expiry}`);
    }
  }

  return Array.from(keys);
}
