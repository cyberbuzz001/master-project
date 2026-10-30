/**
 * Client-Side Black-Scholes & Dynamic Option Pricing Utility
 * Calculates live theoretical option prices and Greeks anchored to underlying spot index ticks.
 */

const RISK_FREE_RATE = 0.07; // 7.0% Indian benchmark rate

/**
 * Cumulative Standard Normal Distribution Function N(x) (Abramowitz & Stegun approximation)
 */
export function CND(x: number): number {
  const a1 = 0.31938153;
  const a2 = -0.356563782;
  const a3 = 1.781477937;
  const a4 = -1.821255978;
  const a5 = 1.330274429;
  const L = Math.abs(x);
  const K = 1.0 / (1.0 + 0.2316419 * L);
  let cnd = 1.0 - 1.0 / Math.sqrt(2 * Math.PI) * Math.exp(-L * L / 2.0) * (a1 * K + a2 * K * K + a3 * Math.pow(K, 3) + a4 * Math.pow(K, 4) + a5 * Math.pow(K, 5));
  if (x < 0) {
    cnd = 1.0 - cnd;
  }
  return cnd;
}

/**
 * Standard Normal Probability Density Function N'(x)
 */
export function ND(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/**
 * Calculates exact Black-Scholes theoretical Call (CE) or Put (PE) option price.
 */
export function calculateOptionPrice(
  spot: number,
  strike: number,
  timeToExpiryYears: number = 5.0 / 365.0, // Default ~5 days (weekly expiry cycle)
  isCall: boolean = true,
  iv: number = 0.14,
  rate: number = RISK_FREE_RATE
): number {
  if (spot <= 0 || strike <= 0 || timeToExpiryYears <= 0 || iv <= 0) {
    const intrinsic = isCall ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
    return Math.max(0.05, Number(intrinsic.toFixed(2)));
  }

  const sqrtT = Math.sqrt(timeToExpiryYears);
  const d1 = (Math.log(spot / strike) + (rate + 0.5 * iv * iv) * timeToExpiryYears) / (iv * sqrtT);
  const d2 = d1 - (iv * sqrtT);

  if (isCall) {
    const price = spot * CND(d1) - strike * Math.exp(-rate * timeToExpiryYears) * CND(d2);
    return Math.max(0.05, Number(price.toFixed(2)));
  } else {
    const price = strike * Math.exp(-rate * timeToExpiryYears) * CND(-d2) - spot * CND(-d1);
    return Math.max(0.05, Number(price.toFixed(2)));
  }
}

/**
 * Parses an option symbol (e.g. "NIFTY 22900 PE", "SENSEX 74400 CE", "BFO_SENSEX_74400_CE", "NFO_NIFTY22900PE")
 */
export function parseOptionDetails(symbol: string): {
  underlying: string;
  strike: number;
  isCall: boolean;
  spotToken: string;
} | null {
  if (!symbol) return null;

  const clean = symbol.trim().toUpperCase();
  const match = clean.match(/(?:(?:NSE|BSE|NFO|BFO)_)?([A-Z]+)[_\s-]*(\d+(?:\.\d+)?)[_\s-]*(CE|PE)/i);
  if (!match) return null;

  let underlying = match[1];
  const strike = parseFloat(match[2]);
  const isCall = match[3].toUpperCase() === 'CE';

  if (underlying === 'NIFTY50' || underlying === 'NIFTY') underlying = 'NIFTY';
  if (underlying.includes('SENSEX')) underlying = 'SENSEX';
  if (underlying.includes('BANKNIFTY')) underlying = 'BANKNIFTY';
  if (underlying.includes('FINNIFTY')) underlying = 'FINNIFTY';
  if (underlying.includes('MIDCPNIFTY')) underlying = 'MIDCPNIFTY';

  let spotToken = 'NSE_NIFTY50';
  if (underlying === 'SENSEX') spotToken = 'BSE_SENSEX';
  else if (underlying === 'BANKNIFTY') spotToken = 'NSE_BANKNIFTY';
  else if (underlying === 'FINNIFTY') spotToken = 'NSE_FINNIFTY';
  else if (underlying === 'MIDCPNIFTY') spotToken = 'NSE_MIDCPNIFTY';

  return { underlying, strike, isCall, spotToken };
}

/**
 * Dynamically estimates the live option price based on the underlying index tick
 * if direct option contract ticks are quiet or not streaming.
 */
export function estimateLiveOptionPrice(
  symbol: string,
  baseLtp: number,
  ticks: Map<string, any>
): number {
  const parsed = parseOptionDetails(symbol);
  if (!parsed || isNaN(parsed.strike) || parsed.strike <= 0) {
    return baseLtp > 0 ? baseLtp : 0;
  }

  // Look up live spot tick in ticks map (checking token and aliases)
  const spotTick = ticks.get(parsed.spotToken) ||
                   ticks.get(parsed.spotToken.replace(/^(NSE_|BSE_)/, '')) ||
                   ticks.get(parsed.underlying);

  if (!spotTick || !spotTick.ltp || spotTick.ltp <= 0) {
    return baseLtp > 0 ? baseLtp : 0;
  }

  const currentSpot = spotTick.ltp;
  const iv = parsed.underlying === 'SENSEX' ? 0.145 : parsed.underlying === 'BANKNIFTY' ? 0.155 : 0.125;
  const bsPrice = calculateOptionPrice(currentSpot, parsed.strike, 5.0 / 365.0, parsed.isCall, iv);

  if (bsPrice > 0) {
    return bsPrice;
  }

  return baseLtp > 0 ? baseLtp : 0;
}

