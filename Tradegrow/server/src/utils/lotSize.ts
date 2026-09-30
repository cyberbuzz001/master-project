/**
 * Standard Lot Size Helper for Indian Index Options & Equities
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

  return 1;
}
