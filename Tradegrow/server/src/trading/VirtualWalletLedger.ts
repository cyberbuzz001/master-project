import { pool, query, queryOne, execute, withTransaction } from '../db/schema';
import { generateUUID } from '../utils/crypto';
import { PortfolioService } from './PortfolioService';
import { marginForLeg, resolveSpotPrice, resolveOrderReferencePrice, resolveOptionDetails, getMarginParams, ZERO_CHARGES } from './MarginMath';

/** Statuses that still hold a live margin reservation — a filled/cancelled/rejected order no longer does. */
const PENDING_ORDER_STATUSES = ['ACCEPTED', 'PENDING', 'EXECUTING'];

export interface WalletState {
  userId: string;
  cashBalance: number;
  usedMargin: number;
  realizedPnl: number;
  unrealizedPnl: number;
  buyingPower: number;
  withdrawableBalance: number;
  totalPnl: number;
  accountEquity: number;
}

export class VirtualWalletLedger {

  /**
   * Calculate precise withdrawable balance for a user taking into account open positions & floating losses.
   * Withdrawable = max(0, Cash Balance - Used Margin + min(0, Unrealized P&L))
   */
  public static async calculateWithdrawableBalance(userId: string): Promise<number> {
    const row = await queryOne<any>(
      'SELECT cash_balance, used_margin FROM virtual_wallets WHERE user_id = $1',
      [userId]
    );
    if (!row) return 0;

    const cash = parseFloat(row.cash_balance || '0');
    const margin = parseFloat(row.used_margin || '0');

    let unrealizedPnl = 0;
    try {
      const openPositions = await PortfolioService.getUserPositions(userId, false);
      for (const pos of openPositions) {
        if (pos.netQty !== 0) {
          unrealizedPnl += pos.unrealizedPnl;
        }
      }
    } catch (_) {}

    // Floating losses reduce withdrawable balance immediately; floating profits cannot be withdrawn until realized
    const floatingLossPenalty = Math.min(0, unrealizedPnl);
    return Math.max(0, cash - margin + floatingLossPenalty);
  }

  /**
   * Get total platform real-money withdrawable liabilities.
   */
  public static async getPlatformTotalLiability(): Promise<{ totalCash: number; totalLiability: number; totalUsedMargin: number }> {
    const row = await queryOne<any>(
      'SELECT COALESCE(SUM(cash_balance), 0) as cash, COALESCE(SUM(used_margin), 0) as margin FROM virtual_wallets'
    );
    const totalCash = parseFloat(row?.cash || '0');
    const totalUsedMargin = parseFloat(row?.margin || '0');
    const totalLiability = Math.max(0, totalCash - totalUsedMargin);

    return { totalCash, totalLiability, totalUsedMargin };
  }

  /**
   * Get current wallet state for a user with live Unrealized P&L, Total P&L & Account Equity.
   */
  public static async getWallet(userId: string): Promise<WalletState | null> {
    const row = await queryOne<any>(
      'SELECT * FROM virtual_wallets WHERE user_id = $1',
      [userId]
    );
    if (!row) return null;

    const cashBalance   = parseFloat(row.cash_balance);
    const usedMargin    = parseFloat(row.used_margin);
    const realizedPnl   = parseFloat(row.realized_pnl);

    // Calculate dynamic live unrealized P&L from active open positions
    let unrealizedPnl = 0;
    try {
      const openPositions = await PortfolioService.getUserPositions(userId, false);
      for (const pos of openPositions) {
        if (pos.netQty !== 0) {
          unrealizedPnl += pos.unrealizedPnl;
        }
      }
    } catch (_) {}

    const buyingPower   = Math.max(0, cashBalance - usedMargin);
    const floatingLoss  = Math.min(0, unrealizedPnl);
    const withdrawableBalance = Math.max(0, cashBalance - usedMargin + floatingLoss);
    const totalPnl      = realizedPnl + unrealizedPnl;
    const accountEquity = cashBalance + unrealizedPnl;

    return {
      userId,
      cashBalance,
      usedMargin,
      realizedPnl,
      unrealizedPnl,
      buyingPower,
      withdrawableBalance,
      totalPnl,
      accountEquity
    };
  }

  /**
   * Recomputes and persists the authoritative `used_margin` for a user from
   * first principles — every open position plus every still-pending order,
   * all priced through the single shared MarginMath.marginForLeg formula.
   * This replaces the previous four-plus divergent block/release/recompute
   * paths (OMS submit/cancel/modify, ExecutionEngine fills, admin cancel/
   * reject/square-off, /funds/reset-margin) — every one of those now calls
   * this instead of computing its own number, so `used_margin` can no
   * longer drift between them.
   *
   * Pass an existing transaction `client` to compose with a caller's own
   * `withTransaction` (e.g. after a fill has updated `positions` in the same
   * transaction); omit it to run standalone.
   */
  public static async recomputeUsedMarginForUser(userId: string, client?: any): Promise<number> {
    // No transaction supplied — open one so the row lock below actually
    // serializes concurrent callers (e.g. two order submissions racing for
    // the same user), then re-enter with that client.
    if (!client) {
      let result = 0;
      await withTransaction(async (txClient: any) => {
        result = await VirtualWalletLedger.recomputeUsedMarginForUser(userId, txClient);
      });
      return result;
    }

    // Lock the wallet row for the duration of this recompute+write. This is
    // a full overwrite, not an increment/decrement — without the lock, two
    // concurrent recomputes for the same user could both read a stale
    // pending-order/position set and the slower one would silently clobber
    // the faster one's result.
    await client.query('SELECT 1 FROM virtual_wallets WHERE user_id = $1 FOR UPDATE', [userId]);

    const run = async (sql: string, params: any[]) => (await client.query(sql, params)).rows;

    const positions = await run(
      'SELECT symbol, exchange, product_type, net_qty, average_price, ltp FROM positions WHERE user_id = $1 AND net_qty != 0',
      [userId]
    );
    const pendingOrders = await run(
      `SELECT symbol, exchange, product_type, side, quantity, price, instrument_token
       FROM orders WHERE user_id = $1 AND status = ANY($2::text[])`,
      [userId, PENDING_ORDER_STATUSES]
    );

    // Batch-fetch instrument rows for pending orders, keyed by instrument_token
    // — NOT by bare symbol. `instruments.symbol` is the underlying's plain
    // name shared across EVERY listed contract on it (e.g. every RELIANCE
    // options/futures row also has symbol='RELIANCE'); a symbol-only lookup
    // for an equity order can silently match an unrelated options contract
    // that happens to share the same underlying name. instrument_token is
    // the one column that's actually unique per contract.
    // Positions have no instrument_token column at all, so they get no
    // instrument-row lookup here — resolveOptionDetails falls back to
    // regex-parsing pos.symbol, which is exactly right for positions anyway:
    // an option position's symbol is already the descriptive "NIFTY 24500 CE"
    // form (which the regex parses correctly), while an equity/futures
    // position's bare symbol correctly fails to parse as an option.
    const instrumentTokens = Array.from(new Set<string>(
      pendingOrders.map((o: any) => o.instrument_token).filter(Boolean)
    ));
    const instrumentsByToken = new Map<string, any>();
    if (instrumentTokens.length > 0) {
      const rows = await run(
        'SELECT instrument_token, option_type, strike, name FROM instruments WHERE instrument_token = ANY($1::text[])',
        [instrumentTokens]
      );
      for (const row of rows) instrumentsByToken.set(row.instrument_token, row);
    }

    const emptyMarginParams = { spanMarginRate: 0, exposureMarginRate: 0, additionalMarginRate: 0 };
    let total = 0;

    for (const pos of positions) {
      const netQty = parseInt(pos.net_qty, 10);
      if (netQty === 0) continue;

      const side: 'BUY' | 'SELL' = netQty > 0 ? 'BUY' : 'SELL';
      const quantity = Math.abs(netQty);
      const price = parseFloat(pos.ltp) > 0 ? parseFloat(pos.ltp) : parseFloat(pos.average_price || '0');
      // No instrument-row lookup for positions (see note above) — regex-only.
      const optionDetails = resolveOptionDetails(pos.symbol, null);

      let spotPrice: number | undefined;
      let marginParams = emptyMarginParams;
      if (optionDetails && side === 'SELL') {
        spotPrice = resolveSpotPrice(optionDetails.underlying).price;
        marginParams = await getMarginParams(optionDetails.underlying);
      }

      total += marginForLeg({
        productType: pos.product_type,
        side,
        quantity,
        price,
        optionType: optionDetails?.optionType,
        strike: optionDetails?.strike,
        spotPrice,
        marginParams,
        charges: ZERO_CHARGES, // already filled — no re-charge of entry fees on every recompute
      }).requiredMargin;
    }

    for (const order of pendingOrders) {
      const quantity = parseInt(order.quantity, 10);
      if (!quantity || quantity <= 0) continue;

      // Mirrors RMS's square-off & flip logic: a pending order that reduces an
      // existing opposite-sign position reserves no additional margin for the
      // closing portion. If the order is larger than the position (position flip),
      // only the excess new opening exposure reserves margin.
      const existingPos = positions.find((p: any) => p.symbol === order.symbol && p.product_type === order.product_type);
      const existingNetQty = existingPos ? parseInt(existingPos.net_qty, 10) : 0;
      const isOpposite = (existingNetQty > 0 && order.side === 'SELL') || (existingNetQty < 0 && order.side === 'BUY');

      let effectiveQty = quantity;
      if (isOpposite) {
        const absExisting = Math.abs(existingNetQty);
        if (quantity <= absExisting) {
          continue; // Pure position reduction / square-off: reserves 0 margin
        }
        effectiveQty = quantity - absExisting; // Position flip: reserve margin on new exposure
      }

      const instrumentRow = order.instrument_token ? instrumentsByToken.get(order.instrument_token) : null;
      let price = parseFloat(order.price || '0');
      if (!price || price <= 0) {
        // Zero-price pending MARKET order — resolve the same way RMS does at
        // placement time rather than pricing it at 0 (which would silently
        // under-margin a resting market order with no fresh tick yet).
        const fallback = instrumentRow && parseFloat(instrumentRow.strike || '0') > 0 ? parseFloat(instrumentRow.strike) : 100.0;
        price = resolveOrderReferencePrice(order.instrument_token || order.symbol, fallback).price;
      }

      const optionDetails = resolveOptionDetails(order.symbol, instrumentRow);
      let spotPrice: number | undefined;
      let marginParams = emptyMarginParams;
      if (optionDetails && order.side === 'SELL') {
        spotPrice = resolveSpotPrice(optionDetails.underlying).price;
        marginParams = await getMarginParams(optionDetails.underlying);
      }

      total += marginForLeg({
        productType: order.product_type,
        side: order.side,
        quantity: effectiveQty,
        price,
        optionType: optionDetails?.optionType,
        strike: optionDetails?.strike,
        spotPrice,
        marginParams,
        charges: ZERO_CHARGES, // not yet filled — no charges due until execution
      }).requiredMargin;
    }

    total = Number(total.toFixed(2));
    await client.query('UPDATE virtual_wallets SET used_margin = $1, updated_at = NOW() WHERE user_id = $2', [total, userId]);

    return total;
  }

  /**
   * @deprecated superseded by recomputeUsedMarginForUser, which every caller
   * of blockMargin has been migrated to. Left in place (not deleted) pending
   * a full-repo grep beyond server/src to confirm nothing else calls it.
   * Block virtual margin for a pending order using SELECT ... FOR UPDATE.
   */
  public static async blockMargin(
    userId: string,
    amount: number,
    referenceId: string,
    createdBy: string = 'OMS'
  ): Promise<boolean> {
    if (amount <= 0) return true;

    try {
      await withTransaction(async (client) => {
        const walletRow = await client.query(
          'SELECT * FROM virtual_wallets WHERE user_id = $1 FOR UPDATE',
          [userId]
        );

        if (walletRow.rows.length === 0) throw new Error('Wallet not found');

        const wallet = walletRow.rows[0];
        const cashBalance = parseFloat(wallet.cash_balance);
        const usedMargin  = parseFloat(wallet.used_margin);
        const buyingPower = Math.max(0, cashBalance - usedMargin);

        if (buyingPower < amount) {
          throw new Error(`Insufficient buying power. Required: ₹${amount.toFixed(2)}, Available: ₹${buyingPower.toFixed(2)}`);
        }

        const newUsedMargin = usedMargin + amount;

        await client.query(
          'UPDATE virtual_wallets SET used_margin = $1, updated_at = NOW() WHERE user_id = $2',
          [newUsedMargin, userId]
        );

        await client.query(
          `INSERT INTO wallet_ledger (id, transaction_id, user_id, transaction_type, amount, balance_before, balance_after, reference_id, created_by, metadata)
           VALUES ($1, $2, $3, 'MARGIN_BLOCK', $4, $5, $6, $7, $8, $9)`,
          [
            'led_' + generateUUID(), generateUUID(), userId,
            amount, cashBalance, cashBalance - newUsedMargin,
            referenceId, createdBy,
            JSON.stringify({ reason: 'Pre-Trade Virtual Margin Block' })
          ]
        );
      });

      return true;
    } catch (err: any) {
      console.error('[VirtualWalletLedger] blockMargin failed:', err.message);
      return false;
    }
  }

  /**
   * @deprecated superseded by recomputeUsedMarginForUser — a cancelled/
   * rejected order simply drops out of the pending-order sum on its next
   * call, so no separate release calculation is needed. Left in place
   * pending a full-repo grep beyond server/src.
   * Release blocked margin for a cancelled or rejected order.
   */
  public static async releaseMargin(
    userId: string,
    amount: number,
    referenceId: string,
    createdBy: string = 'OMS'
  ): Promise<void> {
    if (amount <= 0) return;

    await withTransaction(async (client) => {
      const walletRow = await client.query(
        'SELECT * FROM virtual_wallets WHERE user_id = $1 FOR UPDATE',
        [userId]
      );

      if (walletRow.rows.length === 0) return;

      const wallet = walletRow.rows[0];
      const cashBalance = parseFloat(wallet.cash_balance);
      const usedMargin  = parseFloat(wallet.used_margin);
      const releaseAmt  = Math.min(usedMargin, amount);
      const newUsedMargin = Math.max(0, usedMargin - releaseAmt);

      await client.query(
        'UPDATE virtual_wallets SET used_margin = $1, updated_at = NOW() WHERE user_id = $2',
        [newUsedMargin, userId]
      );

      await client.query(
        `INSERT INTO wallet_ledger (id, transaction_id, user_id, transaction_type, amount, balance_before, balance_after, reference_id, created_by, metadata)
         VALUES ($1, $2, $3, 'MARGIN_RELEASE', $4, $5, $6, $7, $8, $9)`,
        [
          'led_' + generateUUID(), generateUUID(), userId,
          releaseAmt, cashBalance, cashBalance - newUsedMargin,
          referenceId, createdBy,
          JSON.stringify({ reason: 'Virtual Margin Release' })
        ]
      );
    });
  }

  /**
   * Settle trade execution atomically within an active database transaction.
   * Realized P&L flows directly into cash balance & realized_pnl with zero charges.
   */
  public static async settleTradeExecutionInTransaction(
    client: any,
    userId: string,
    tradeType: 'BUY' | 'SELL',
    tradeAmount: number,
    releasedPositionCapital: number,
    realizedPnlDelta: number,
    referenceId: string
  ): Promise<void> {
    const walletRow = await client.query(
      'SELECT * FROM virtual_wallets WHERE user_id = $1 FOR UPDATE',
      [userId]
    );

    if (walletRow.rows.length === 0) return;

    const wallet = walletRow.rows[0];
    const cashBalance = parseFloat(wallet.cash_balance);
    const realizedPnl = parseFloat(wallet.realized_pnl);

    // 1. Realized P&L increases or decreases cash balance directly (safeguarded against negative cash constraint)
    const newCash = Math.max(0.00, cashBalance + realizedPnlDelta);
    const newRealizedPnl = realizedPnl + realizedPnlDelta;

    await client.query(
      `UPDATE virtual_wallets SET cash_balance = $1, realized_pnl = $2, updated_at = NOW()
       WHERE user_id = $3`,
      [newCash, newRealizedPnl, userId]
    );

    // 2. Recompute used_margin from the position this fill just updated (the
    // caller runs this after PortfolioService.recordExecutionInTransaction,
    // so `positions` already reflects the new net_qty) plus any other
    // pending orders — the one shared, SPAN-aware formula, not a naive
    // notional sum.
    const newUsedMargin = await VirtualWalletLedger.recomputeUsedMarginForUser(userId, client);

    await client.query(
      `INSERT INTO wallet_ledger (id, transaction_id, user_id, transaction_type, amount, balance_before, balance_after, reference_id, created_by, metadata)
       VALUES ($1, $2, $3, 'PNL_SETTLEMENT', $4, $5, $6, $7, 'SIMULATED_EXECUTION', $8)`,
      [
        'led_' + generateUUID(), generateUUID(), userId,
        tradeAmount, cashBalance, newCash, referenceId,
        JSON.stringify({ tradeType, realizedPnlDelta, releasedPositionCapital, newCash, newUsedMargin })
      ]
    );
  }

  /**
   * Admin balance adjustment (Add or Remove virtual capital).
   *
   * Accepts an optional external `client` (B1 fix) so a caller that needs a
   * second write — e.g. a `fund_requests` audit row — to commit or roll back
   * together with the balance change can pass its own transaction in, instead
   * of the balance mutation committing on its own before the second write is
   * even attempted (which would leave a real balance change with no matching
   * audit record if that second write ever throws). When no client is passed,
   * behavior is unchanged: this opens and manages its own transaction.
   */
  public static async adminAdjustBalance(
    userId: string,
    amount: number,
    adminUserId: string,
    reason: string,
    externalClient?: any
  ): Promise<WalletState | null> {
    const run = async (client: any) => {
      const walletRow = await client.query(
        'SELECT * FROM virtual_wallets WHERE user_id = $1 FOR UPDATE',
        [userId]
      );

      if (walletRow.rows.length === 0) throw new Error('Wallet not found');

      const wallet = walletRow.rows[0];
      const cashBalance = parseFloat(wallet.cash_balance);
      const newCash = cashBalance + amount;

      if (newCash < 0) throw new Error('Admin adjustment would result in negative balance');

      await client.query(
        'UPDATE virtual_wallets SET cash_balance = $1, updated_at = NOW() WHERE user_id = $2',
        [newCash, userId]
      );

      await client.query(
        `INSERT INTO wallet_ledger (id, transaction_id, user_id, transaction_type, amount, balance_before, balance_after, reference_id, created_by, metadata)
         VALUES ($1, $2, $3, 'ADMIN_ADJUSTMENT', $4, $5, $6, $7, $8, $9)`,
        [
          'led_' + generateUUID(), generateUUID(), userId,
          Math.abs(amount), cashBalance, newCash,
          adminUserId, adminUserId,
          JSON.stringify({ reason, adjustmentType: amount >= 0 ? 'CREDIT' : 'DEBIT' })
        ]
      );
    };

    if (externalClient) {
      await run(externalClient);
    } else {
      await withTransaction(run);
    }

    return this.getWallet(userId);
  }
}
