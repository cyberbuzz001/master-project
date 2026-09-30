import { queryOne } from '../db/schema';
import { VirtualWalletLedger } from './VirtualWalletLedger';
import { marginEngineService } from '../services/MarginEngineService';
import { resolveOrderReferencePrice, resolveOptionDetails, TickSource } from './MarginMath';
import { isOrderWindowOpen } from '../utils/marketHours';

export interface RMSValidationResult {
  passed: boolean;
  reason?: string;
  requiredMargin: number;
  priceSource?: TickSource;
  isPureSquareOff?: boolean;
  isPositionFlip?: boolean;
  openingQty?: number;
}

export interface RMSOrderParams {
  userId: string;
  instrumentToken: string;
  exchange: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  orderType: 'MARKET' | 'LIMIT' | 'SL' | 'SL_M';
  productType: 'MIS' | 'CNC' | 'NRML';
  /** From users.risk_restriction (Phase 2) — 'REDUCE_ONLY' blocks exposure-increasing orders, exempting square-offs. */
  riskRestriction?: string | null;
  /**
   * Set only by server-side engines calling OMS.submitOrder directly (never
   * from a request body) — see SubmitOrderDTO.systemActor. Exempts the order
   * from the market-hours gate so RMS auto-square-off and the loss monitor can
   * still close exposure outside the trading session.
   */
  systemActor?: string;
}

function getISTDateString(input?: Date | string | number | null): string {
  if (!input) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  }
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
    return input.trim();
  }
  const d = typeof input === 'string' || typeof input === 'number' ? new Date(input) : input;
  if (isNaN(d.getTime())) return String(input).slice(0, 10);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
}

function parseExpiryToYYYYMMDD(str?: string): string | null {
  if (!str || str.trim() === '') return null;
  const clean = str.trim().toUpperCase();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;

  const months: Record<string, string> = {
    JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
    JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12'
  };

  const match = clean.match(/^(\d{1,2})[-]?([A-Z]{3})[-]?(\d{2,4})$/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = months[match[2]];
    let year = match[3];
    if (year.length === 2) year = `20${year}`;
    if (month) return `${year}-${month}-${day}`;
  }
  return null;
}

export class RMS {
  private static cachedRiskLimits: { maxQty: number; maxOrderVal: number; expiresAt: number } | null = null;

  private static async getRiskLimits(): Promise<{ maxQty: number; maxOrderVal: number }> {
    if (this.cachedRiskLimits && Date.now() < this.cachedRiskLimits.expiresAt) {
      return this.cachedRiskLimits;
    }
    const maxQtyRow   = await queryOne<any>(`SELECT value FROM system_settings WHERE key = 'MAX_ORDER_QTY'`);
    const maxValueRow = await queryOne<any>(`SELECT value FROM system_settings WHERE key = 'MAX_ORDER_VALUE'`);
    const maxQty      = maxQtyRow   ? parseInt(maxQtyRow.value, 10)   : 50000;
    const maxOrderVal = maxValueRow ? parseFloat(maxValueRow.value) : 10000000;

    this.cachedRiskLimits = {
      maxQty,
      maxOrderVal,
      expiresAt: Date.now() + 60000
    };
    return this.cachedRiskLimits;
  }

  public static async validateOrder(order: RMSOrderParams): Promise<RMSValidationResult> {
    // 1. Validate quantity
    if (!order.quantity || order.quantity <= 0) {
      return { passed: false, reason: 'ORDER_REJECTED: Quantity must be greater than 0', requiredMargin: 0 };
    }

    // 1b. Trading-session gate. Deliberately ahead of the square-off detection
    // below, so a *customer's* manual square-off is blocked off-hours too —
    // matching a real broker, where a closed market means no exits either. The
    // only exemption is a systemActor order (RMS auto-square-off / loss
    // monitor), which must still be able to close exposure at any hour; that
    // flag is settable only by server-side code, never from a request body.
    // Session window is per-exchange — MCX runs far later than NSE/BSE.
    if (!order.systemActor) {
      const session = await isOrderWindowOpen(order.exchange);
      if (!session.open) {
        return { passed: false, reason: `ORDER_REJECTED: ${session.reason}`, requiredMargin: 0 };
      }
    }

    // 2. Check position reduction / square-off status FIRST — a square-off
    // order must never be blocked by the instrument-expiry or qty/value
    // limits below. Computed here (moved up from its previous place after
    // those checks) because an order closing an existing position is
    // fundamentally different from one opening/growing exposure: it must
    // always be allowed through regardless of contract state or size limits,
    // the same way step 8's buying-power check already exempts it.
    const existingPos = await queryOne<any>(
      'SELECT net_qty FROM positions WHERE user_id = $1 AND symbol = $2 AND product_type = $3',
      [order.userId, order.symbol, order.productType]
    );

    const currentNetQty = existingPos ? parseInt(existingPos.net_qty, 10) : 0;
    const isOppositeSide = (currentNetQty > 0 && order.side === 'SELL') || (currentNetQty < 0 && order.side === 'BUY');
    const absCurrentNetQty = Math.abs(currentNetQty);
    const isPureSquareOff = isOppositeSide && order.quantity <= absCurrentNetQty;
    const isPositionFlip = isOppositeSide && order.quantity > absCurrentNetQty;
    const isSquareOff = isPureSquareOff;

    // When reversing/flipping a position, the portion closing the existing position
    // is exempt from margin, but the excess new exposure (openingQty) must pass
    // full RMS limits and margin requirements.
    const openingQty = isPositionFlip
      ? order.quantity - absCurrentNetQty
      : (isOppositeSide ? 0 : order.quantity);

    // 2b. Phase 2 risk-tier restriction — a user flagged REDUCE_ONLY (their
    // unrealized loss crossed the 70% CRITICAL tier) may still close/reduce
    // positions but may not open or grow exposure until a human reviews the account.
    if (order.riskRestriction === 'REDUCE_ONLY' && openingQty > 0) {
      return {
        passed: false,
        reason: 'ORDER_REJECTED: Account restricted to reduce-only trading pending risk review. Cannot open or reverse positions.',
        requiredMargin: 0
      };
    }

    // 3. Instrument & Contract Non-Expiration Check
    // Token lookup first, symbol only as a fallback — `instruments.symbol` is
    // the bare underlying name shared by every contract listed on it (e.g.
    // every RELIANCE option/futures row also has symbol='RELIANCE'), so the
    // previous single `OR ... LIMIT 1` query could return an arbitrary
    // matching row instead of the actual instrument the order's token names —
    // wrongly rejecting a valid equity order if the row it happened to land
    // on was an expired/inactive option sharing that same underlying name.
    let instrument = order.instrumentToken
      ? await queryOne<any>(`SELECT * FROM instruments WHERE instrument_token = $1`, [order.instrumentToken])
      : null;
    if (!instrument && order.symbol) {
      instrument = await queryOne<any>(`SELECT * FROM instruments WHERE symbol = $1 LIMIT 1`, [order.symbol]);
    }

    if (instrument && (openingQty > 0 || !isOppositeSide)) {
      if (!instrument.active) {
        return { passed: false, reason: `ORDER_REJECTED: Instrument ${order.symbol} is currently inactive or suspended by exchange`, requiredMargin: 0 };
      }
      if (instrument.expiry) {
        const todayIST = getISTDateString();
        const parsedExp = getISTDateString(instrument.expiry);
        if (parsedExp && /^\d{4}-\d{2}-\d{2}$/.test(parsedExp) && parsedExp < todayIST) {
          return { passed: false, reason: `ORDER_REJECTED: Contract ${order.symbol} has expired on ${parsedExp}. Trading on expired contracts is strictly prohibited`, requiredMargin: 0 };
        }
      }
    }

    // 4. Fetch System Risk Limits (Cached)
    const { maxQty, maxOrderVal } = await this.getRiskLimits();

    if (openingQty > 0 && openingQty > maxQty) {
      return { passed: false, reason: `ORDER_REJECTED: Order quantity exceeds maximum allowed limit of ${maxQty}`, requiredMargin: 0 };
    }

    // 5. Reference execution price — falls back to a cached/stale tick or a
    // last-resort constant rather than blocking (confirmed staleness policy:
    // tag and proceed), so the order flow never hard-stalls on a feed gap.
    let refPrice = order.price;
    let priceSource: TickSource = 'live';
    if (!refPrice || refPrice <= 0) {
      const fallback = instrument && parseFloat(instrument.strike || '0') > 0 ? parseFloat(instrument.strike) : 100.0;
      const resolved = resolveOrderReferencePrice(order.instrumentToken, fallback);
      refPrice = resolved.price;
      priceSource = resolved.source;
    }

    const effectiveOrderValue = refPrice * (openingQty > 0 ? openingQty : order.quantity);
    if (openingQty > 0 && effectiveOrderValue > maxOrderVal) {
      return {
        passed: false,
        reason: `ORDER_REJECTED: Total order value (₹${effectiveOrderValue.toLocaleString('en-IN')}) exceeds maximum limit (₹${maxOrderVal.toLocaleString('en-IN')})`,
        requiredMargin: 0
      };
    }

    // Determine option details if derivative contract — prefers the joined
    // instruments row (authoritative), falling back to symbol/token parsing
    // via the one shared parser (SymbologyNormalizer.parseOptionSymbol,
    // through resolveOptionDetails) instead of a second inline regex copy.
    let optionType: 'CE' | 'PE' | 'XX' = 'XX';
    let strike = 0;
    let underlying = order.symbol;

    const resolved = resolveOptionDetails(order.symbol, instrument)
      || resolveOptionDetails(order.instrumentToken, instrument);
    if (resolved) {
      underlying = resolved.underlying;
      strike = resolved.strike;
      optionType = resolved.optionType;
    } else if (order.symbol.toUpperCase().endsWith('CE')) {
      optionType = 'CE';
    } else if (order.symbol.toUpperCase().endsWith('PE')) {
      optionType = 'PE';
    }

    // 6. Compute Authoritative Required Margin via MarginEngineService
    let requiredMargin = 0;
    let canPlaceOrder = true;
    let rejectionReason: string | undefined;

    if (openingQty > 0) {
      const marginQuote = await marginEngineService.calculateQuote({
        userId: order.userId,
        exchange: order.exchange || 'NSE',
        underlying,
        strike,
        optionType,
        side: order.side,
        quantity: openingQty,
        price: refPrice,
        productType: order.productType,
        instrumentToken: order.instrumentToken,
      });
      requiredMargin = marginQuote.requiredMargin;
      canPlaceOrder = marginQuote.canPlaceOrder;
      rejectionReason = marginQuote.rejectionReason;
    }

    // 7. Check CNC holdings for delivery sell
    if (order.side === 'SELL' && order.productType === 'CNC') {
      const holding = await queryOne<any>(
        'SELECT quantity FROM holdings WHERE user_id = $1 AND symbol = $2',
        [order.userId, order.symbol]
      );
      const availableQty = holding ? parseInt(holding.quantity, 10) : 0;
      if (availableQty < order.quantity) {
        return {
          passed: false,
          reason: `ORDER_REJECTED: Insufficient CNC holdings. Available: ${availableQty}, Requested: ${order.quantity}`,
          requiredMargin: 0
        };
      }
      return { passed: true, requiredMargin: 0, priceSource, isPureSquareOff, isPositionFlip, openingQty };
    }

    // 8. Check Virtual Buying Power
    if (openingQty > 0 && !canPlaceOrder) {
      return {
        passed: false,
        reason: `ORDER_REJECTED: ${rejectionReason || 'Insufficient funds'}`,
        requiredMargin,
        priceSource
      };
    }

    return { passed: true, requiredMargin, priceSource, isPureSquareOff, isPositionFlip, openingQty };
  }

  /**
   * Authoritative, row-locked CNC holdings reservation check executed within
   * the order-placement transaction.
   * Mirrors VirtualWalletLedger's row-lock pattern to eliminate race conditions
   * during concurrent CNC sell submissions.
   */
  public static async reserveCncHoldingsOrThrow(
    client: any,
    userId: string,
    symbol: string,
    requestedQty: number
  ): Promise<void> {
    const holdingRow = await client.query(
      'SELECT quantity FROM holdings WHERE user_id = $1 AND symbol = $2 FOR UPDATE',
      [userId, symbol]
    );

    const totalHoldingQty = holdingRow.rows.length ? parseInt(holdingRow.rows[0].quantity, 10) : 0;
    if (totalHoldingQty <= 0) {
      throw new Error(`ORDER_REJECTED: No CNC holdings found for ${symbol}`);
    }

    // Sum of other active pending CNC sell orders for this user & symbol
    const pendingOrdersRes = await client.query(
      `SELECT COALESCE(SUM(quantity), 0) as reserved_qty
       FROM orders 
       WHERE user_id = $1 AND symbol = $2 AND side = 'SELL' AND product_type = 'CNC' 
         AND status = ANY($3::text[])`,
      [userId, symbol, ['ACCEPTED', 'PENDING', 'EXECUTING']]
    );
    const alreadyReservedQty = parseInt(pendingOrdersRes.rows[0]?.reserved_qty || '0', 10);
    const availableQty = totalHoldingQty - alreadyReservedQty;

    if (availableQty < requestedQty) {
      throw new Error(
        `ORDER_REJECTED: Insufficient CNC holdings. Total: ${totalHoldingQty}, Already Reserved: ${alreadyReservedQty}, Available: ${availableQty}, Requested: ${requestedQty}`
      );
    }
  }
}

