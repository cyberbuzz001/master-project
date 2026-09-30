import { query, queryOne } from '../db/schema';
import { VirtualWalletLedger } from '../trading/VirtualWalletLedger';
import { marginForLeg, resolveSpotPrice, getMarginParams, calculateHedgedPortfolioMargin, PortfolioLegInput, TickSource } from '../trading/MarginMath';

export interface MarginQuoteRequest {
  userId: string;
  exchange: string;
  underlying: string;
  expiry?: string;
  strike?: number;
  optionType?: 'CE' | 'PE' | 'XX';
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  productType?: 'MIS' | 'CNC' | 'NRML';
  instrumentToken?: string;
}

export interface StatutoryChargesBreakdown {
  stt: number;
  gst: number;
  exchangeCharges: number;
  stampDuty: number;
  sebiFee: number;
  total: number;
}

export interface MarginQuoteResponse {
  orderValue: number;
  premium: number;
  requiredMargin: number;
  spanMargin: number;
  exposureMargin: number;
  additionalMargin: number;
  totalMargin: number;
  brokerage: number; // Always 0 under Zero Brokerage policy
  statutoryCharges: StatutoryChargesBreakdown;
  estimated: boolean;
  availableFunds: number;
  shortfall: number;
  canPlaceOrder: boolean;
  rejectionReason?: string;
  spotPriceSource?: TickSource;
  spotPriceStale?: boolean;
}

export interface PortfolioMarginResponse {
  totalPortfolioMargin: number;
  spanMargin: number;
  exposureMargin: number;
  additionalMargin: number;
  marginBenefit: number;
  requiredCapital: number;
  availableCapital: number;
  marginUtilizationPct: number;
  shortfall: number;
}

export class MarginEngineService {
  private static instance: MarginEngineService;

  public static getInstance(): MarginEngineService {
    if (!MarginEngineService.instance) {
      MarginEngineService.instance = new MarginEngineService();
    }
    return MarginEngineService.instance;
  }

  /**
   * Calculates required capital and margin requirements for an individual order.
   * Enforces ₹0 Brokerage policy while computing precise statutory fees.
   */
  public async calculateQuote(req: MarginQuoteRequest): Promise<MarginQuoteResponse> {
    const qty = Math.max(1, req.quantity);
    const orderPrice = Math.max(0, req.price);
    const orderValue = orderPrice * qty;

    // Fetch user available funds
    const wallet = await VirtualWalletLedger.getWallet(req.userId);
    const availableFunds = wallet ? wallet.buyingPower : 0;

    // Fetch statutory configuration
    const statutoryConfig = await this.getStatutoryConfig();
    const marginParams = await getMarginParams(req.underlying);

    // 1. Calculate Statutory Charges (Brokerage = ₹0.00)
    const charges = this.calculateStatutoryCharges(req.side, orderValue, req.optionType || 'CE', statutoryConfig);

    // 2. Resolve live spot price for option-SELL SPAN margin (no-op for other branches)
    const isOption = req.optionType === 'CE' || req.optionType === 'PE';
    let spotPriceSource: TickSource | undefined;
    let spotPriceStale: boolean | undefined;
    let spotPrice: number | undefined;
    if (isOption && req.side === 'SELL') {
      const resolved = resolveSpotPrice(req.underlying);
      spotPrice = resolved.price;
      spotPriceSource = resolved.source;
      spotPriceStale = resolved.isStale;
    }

    // 3. Distinguish Equity vs Option Buying vs Option Selling — the one
    // shared formula, identical to what every position/pending-order
    // recompute uses (MarginMath.marginForLeg).
    const leg = marginForLeg({
      productType: req.productType || 'NRML',
      side: req.side,
      quantity: qty,
      price: orderPrice,
      optionType: req.optionType,
      strike: req.strike,
      spotPrice,
      marginParams,
      charges,
    });

    const shortfall = Math.max(0, leg.requiredMargin - availableFunds);
    const canPlaceOrder = shortfall === 0;

    let rejectionReason: string | undefined;
    if (!canPlaceOrder) {
      rejectionReason = `Insufficient margin. Required Capital: ₹${leg.requiredMargin.toLocaleString('en-IN', { minimumFractionDigits: 2 })}, Available Funds: ₹${availableFunds.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    }

    return {
      orderValue,
      premium: leg.premium,
      requiredMargin: leg.requiredMargin,
      spanMargin: leg.spanMargin,
      exposureMargin: leg.exposureMargin,
      additionalMargin: leg.additionalMargin,
      totalMargin: leg.requiredMargin,
      brokerage: 0, // ₹0 Free Brokerage
      statutoryCharges: charges,
      estimated: leg.isEstimated,
      availableFunds: Number(availableFunds.toFixed(2)),
      shortfall: Number(shortfall.toFixed(2)),
      canPlaceOrder,
      rejectionReason,
      spotPriceSource,
      spotPriceStale,
    };
  }

  /**
   * Portfolio-level Margin Calculator for open positions (computes hedged offsets).
   */
  public async calculatePortfolioMargin(userId: string): Promise<PortfolioMarginResponse> {
    const wallet = await VirtualWalletLedger.getWallet(userId);
    const availableCapital = wallet ? wallet.buyingPower : 0;

    const positions = await query<any>(
      `SELECT * FROM positions WHERE user_id = $1 AND net_qty != 0`,
      [userId]
    );

    const portfolioLegs: PortfolioLegInput[] = positions.map(pos => {
      const netQty = parseInt(pos.net_qty, 10);
      const side = netQty > 0 ? 'BUY' : 'SELL';
      const absQty = Math.abs(netQty);
      const ltp = parseFloat(pos.ltp || pos.average_price || '100');
      return {
        symbol: pos.symbol,
        side,
        quantity: absQty,
        price: ltp,
        productType: pos.product_type
      };
    });

    const hedgedResult = calculateHedgedPortfolioMargin(portfolioLegs);
    let totalSpan = 0;
    let totalExposure = 0;
    hedgedResult.legs.forEach(l => {
      totalSpan += l.spanMargin;
      totalExposure += l.exposureMargin;
    });

    const unhedgedMargin = hedgedResult.nakedMarginRequired;
    const marginBenefit = hedgedResult.marginBenefit;
    const requiredCapital = hedgedResult.totalMarginRequired;
    const marginUtilizationPct = availableCapital > 0 ? Math.min(100, (requiredCapital / availableCapital) * 100) : 0;
    const shortfall = Math.max(0, requiredCapital - availableCapital);

    return {
      totalPortfolioMargin: Number(unhedgedMargin.toFixed(2)),
      spanMargin: Number(totalSpan.toFixed(2)),
      exposureMargin: Number(totalExposure.toFixed(2)),
      additionalMargin: 0,
      marginBenefit: Number(marginBenefit.toFixed(2)),
      requiredCapital: Number(requiredCapital.toFixed(2)),
      availableCapital: Number(availableCapital.toFixed(2)),
      marginUtilizationPct: Number(marginUtilizationPct.toFixed(2)),
      shortfall: Number(shortfall.toFixed(2)),
    };
  }

  /**
   * Calculates hedged margin requirements for a proposed multi-leg basket order.
   */
  public calculateBasketQuote(legs: PortfolioLegInput[]) {
    return calculateHedgedPortfolioMargin(legs);
  }

  /**
   * Precise Statutory Charges Calculator (STT, GST, Exchange Charges, Stamp Duty, SEBI Fee)
   * Supports Zero Brokerage & Zero Tax policy.
   */
  public calculateStatutoryCharges(
    side: 'BUY' | 'SELL',
    orderValue: number,
    optionType: 'CE' | 'PE' | 'XX',
    config: any
  ): StatutoryChargesBreakdown {
    // If Zero Tax policy is enabled via environment or config, set all taxes and statutory charges to ₹0.00
    const isZeroTax = process.env.ZERO_TAX === 'true' || config?.mode === 'ZERO_TAX';

    if (isZeroTax) {
      return { stt: 0, gst: 0, exchangeCharges: 0, stampDuty: 0, sebiFee: 0, total: 0 };
    }

    const sttRate         = config?.stt_option_sell_rate     ?? 0.00125;
    const gstRate         = config?.gst_rate                 ?? 0.18;
    const exchRate        = config?.exchange_turnover_rate   ?? 0.0005;
    const sebiRate        = config?.sebi_turnover_rate       ?? 0.000001;
    const stampRate       = config?.stamp_duty_buy_rate      ?? 0.00003;

    // STT applies on Option SELL premium (0.125%)
    const stt = (side === 'SELL' && optionType !== 'XX') ? Number((orderValue * sttRate).toFixed(2)) : 0;

    // Stamp Duty applies on Option BUY premium (0.003%)
    const stampDuty = (side === 'BUY') ? Number((orderValue * stampRate).toFixed(2)) : 0;

    // Exchange Turnover Fee
    const exchangeCharges = Number((orderValue * exchRate).toFixed(2));

    // SEBI Turnover Fee
    const sebiFee = Number((orderValue * sebiRate).toFixed(2));

    // GST (18% on Exchange Turnover Fee + SEBI Fee, since Brokerage = 0)
    const gst = Number(((exchangeCharges + sebiFee) * gstRate).toFixed(2));

    const total = Number((stt + stampDuty + exchangeCharges + sebiFee + gst).toFixed(2));

    return { stt, gst, exchangeCharges, stampDuty, sebiFee, total };
  }

  private cachedStatutoryConfig: { config: any; expiresAt: number } | null = null;

  private async getStatutoryConfig(): Promise<any> {
    if (this.cachedStatutoryConfig && Date.now() < this.cachedStatutoryConfig.expiresAt) {
      return this.cachedStatutoryConfig.config;
    }
    const row = await queryOne<any>('SELECT * FROM statutory_charge_config LIMIT 1');
    const config = row || {
      stt_option_sell_rate: 0.00125,
      gst_rate: 0.18,
      exchange_turnover_rate: 0.0005,
      sebi_turnover_rate: 0.000001,
      stamp_duty_buy_rate: 0.00003
    };
    this.cachedStatutoryConfig = { config, expiresAt: Date.now() + 60000 };
    return config;
  }
}

export const marginEngineService = MarginEngineService.getInstance();
