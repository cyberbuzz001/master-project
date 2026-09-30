import { MarketDataEngine } from '../marketData/MarketDataEngine';
import { InstrumentMasterService, DhanScripRecord } from '../marketData/InstrumentMasterService';

export interface McxActiveContract {
  instrument: string;       // e.g. 'OPTFUT'
  commodity: string;        // e.g. 'CRUDEOIL', 'GOLD', 'SILVER', 'NATURALGAS', 'COPPER'
  expiryDate: string;       // e.g. '17SEP2026'
  rawExpiry: string;        // '2026-09-17'
  optionType: 'CE' | 'PE';
  strikePrice: number;
  ltp: number;
  volumeLots: number;
  notionalToLakhs: number;
  premiumToLakh: number;
  oiLots: number;
  ulProductLtp: number;
  token: string;
  ulToken: string;
}

export interface CommodityMeta {
  commodity: string;
  defaultSpot: number;
  step: number;
  lotSize: number;
  ulToken: string;
}

const COMMODITY_CONFIG: CommodityMeta[] = [
  { commodity: 'CRUDEOIL', defaultSpot: 7318.00, step: 100, lotSize: 100, ulToken: 'MCX_CRUDEOIL' },
  { commodity: 'GOLD', defaultSpot: 151198.00, step: 1000, lotSize: 100, ulToken: 'MCX_GOLD' },
  { commodity: 'GOLDM', defaultSpot: 149710.00, step: 1000, lotSize: 10, ulToken: 'MCX_GOLDM' },
  { commodity: 'SILVER', defaultSpot: 235000.00, step: 1000, lotSize: 30, ulToken: 'MCX_SILVER' },
  { commodity: 'SILVERM', defaultSpot: 235000.00, step: 1000, lotSize: 5, ulToken: 'MCX_SILVERM' },
  { commodity: 'NATURALGAS', defaultSpot: 215.50, step: 5, lotSize: 1250, ulToken: 'MCX_NATURALGAS' },
  { commodity: 'COPPER', defaultSpot: 845.00, step: 5, lotSize: 2500, ulToken: 'MCX_COPPER' },
];

function formatExpiryDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const clean = dateStr.trim();
  const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return clean.toUpperCase();

  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const year = match[1];
  const monthIdx = parseInt(match[2], 10) - 1;
  const day = match[3];
  const month = months[monthIdx] || 'SEP';
  return `${day}${month}${year}`;
}

export class McxCommodityEngine {
  private static cachedContracts: McxActiveContract[] = [];
  private static lastGeneratedTime: number = 0;
  private static readonly CACHE_TTL_MS = 2000; // 2-second in-memory cache

  /**
   * Discovers and generates all active MCX commodity options and futures contracts.
   * Dynamically resolves active expiries from Dhan Scrip Master, centers strikes around live spot/futures,
   * and auto-subscribes tokens to MarketDataEngine.
   */
  public static async getActiveContracts(_forceRefresh = false): Promise<McxActiveContract[]> {
    // MCX Commodity trading disabled per operator request (no MCX clients, saves CPU & WebSocket bandwidth)
    return [];
  }



  /**
   * Re-prices cached contracts with the freshest available live ticks from MarketDataEngine.
   */
  private static repriceContractsWithLiveTicks(contracts: McxActiveContract[]): McxActiveContract[] {
    const engine = MarketDataEngine.getInstance();
    return contracts.map(c => {
      const liveTick = engine.getCachedTick(c.token);
      const ulTick = engine.getCachedTick(c.ulToken);
      const spot = ulTick && ulTick.ltp > 0 ? ulTick.ltp : c.ulProductLtp;

      if (liveTick && liveTick.ltp > 0) {
        const ltp = liveTick.ltp;
        const vol = liveTick.volume > 0 ? liveTick.volume : c.volumeLots;
        const notionalTo = Number(((c.strikePrice * vol * 0.01) / 100).toFixed(2));
        const premiumTo = Number(((ltp * vol * 0.01) / 100).toFixed(2));
        return {
          ...c,
          ltp,
          volumeLots: vol,
          notionalToLakhs: notionalTo,
          premiumToLakh: premiumTo,
          ulProductLtp: spot
        };
      }
      return {
        ...c,
        ulProductLtp: spot
      };
    });
  }

  private static getFallbackExpiry(commodity: string): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    if (commodity === 'CRUDEOIL') return `${year}-${month}-17`;
    if (commodity === 'NATURALGAS') return `${year}-${month}-25`;
    if (commodity === 'COPPER') return `${year}-${month}-23`;
    if (commodity.startsWith('GOLD')) return `${year}-${month}-25`;
    if (commodity.startsWith('SILVER')) return `${year}-${month}-24`;
    return `${year}-${month}-28`;
  }
}
