/**
 * Standard Lot Size Helper for Indian Equities, Indices & Commodities
 * Matches authoritative exchange lot sizes and server/src/utils/lotSize.ts
 */
export function getLotSizeForSymbol(symbol: string): number {
  if (!symbol) return 1;
  const sym = symbol.toUpperCase();

  if (sym.includes('SENSEX')) return 20;
  if (sym.includes('BANKNIFTY')) return 30;
  if (sym.includes('FINNIFTY')) return 60;
  if (sym.includes('MIDCP') || sym.includes('MIDCPNIFTY')) return 120;
  if (sym.includes('BANKEX')) return 30;
  if (sym.includes('NIFTY')) return 65;
  if (sym.includes('CRUDEOIL')) return 100;
  if (sym.includes('NATURALGAS')) return 1250;
  if (sym.includes('GOLDM')) return 10;
  if (sym.includes('GOLD')) return 100;
  if (sym.includes('SILVERM')) return 5;
  if (sym.includes('SILVER')) return 30;
  if (sym.includes('COPPER')) return 2500;

  return 1;
}

export const LOT_SIZE_BY_UNDERLYING: Record<string, number> = {
  NIFTY: 65,
  SENSEX: 20,
  BANKNIFTY: 30,
  FINNIFTY: 60,
  MIDCPNIFTY: 120,
  BANKEX: 30,
  CRUDEOIL: 100,
  NATURALGAS: 1250,
  GOLD: 100,
  SILVER: 30
};
