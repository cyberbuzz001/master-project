import { Router, Request, Response, NextFunction } from 'express';
import argon2 from 'argon2';
import { authenticateToken, checkPermission, checkRole, AuthenticatedRequest } from '../middleware/auth';
import { SYSTEM_PERMISSION_CATEGORIES } from '../config/permissionCatalog';
import { query, queryOne, execute, withTransaction } from '../db/schema';
import { logAuditAction } from '../middleware/audit';
import { VirtualWalletLedger } from '../trading/VirtualWalletLedger';
import { MarketDataEngine } from '../marketData/MarketDataEngine';
import { MarketDataStorageService } from '../services/MarketDataStorageService';
import { checkDatabaseHealth } from '../db/pool';
import { redis } from '../db/redis';
import { generateUUID } from '../utils/crypto';
import { SafetyLock } from '../services/SafetyLock';
import { updateDhanToken, getTokenExpiryMinutes, setDhanAdapterRef } from '../utils/dhanTokenRefresh';
import { updateFyersToken, setFyersAdapterRef, generateFyersAuthUrl, exchangeAuthCodeForToken } from '../utils/fyersTokenRefresh';
import { ClientCreationService } from '../services/ClientCreationService';
import { adminEventBus, emitAdminFundsUpdate, emitAdminFundRequestEvent, emitAdminOrderEvent } from '../utils/adminEventBus';
import { createAdminNotification } from '../utils/adminNotifications';
import { recordChatMessage, getChatHistory, markChatReadByStaff } from '../utils/chatMessages';
import { deliverToUser } from '../websocket/server';
import { RmsAutoSquareOffEngine } from '../trading/RmsAutoSquareOffEngine';


function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
  return req.ip ?? '127.0.0.1';
}

// A4c: MANAGER is the only role with a book-of-assigned-clients concept
// (SUPER_ADMIN/ADMIN oversee everyone; functional roles like RISK_MANAGER/
// FINANCE_MANAGER/KYC_OFFICER need to act across all customers for their
// function). Applied only to routes whose permission key's defaultRoles
// actually include MANAGER — routes MANAGER can't reach at all need no scoping.
async function restrictManagerToOwnCustomer(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  if (req.user!.role !== 'MANAGER') {
    next();
    return;
  }
  const customerId = req.params.id;
  try {
    const assignment = await queryOne<{ user_id: string }>(
      'SELECT user_id FROM manager_assignments WHERE manager_id = $1 AND user_id = $2',
      [req.user!.userId, customerId]
    );
    if (!assignment) {
      res.status(403).json({
        success: false,
        error: { code: 'PERMISSION_DENIED', message: 'This customer is not assigned to your book.' }
      });
      return;
    }
    next();
  } catch (err: any) {
    res.status(403).json({ success: false, error: { code: 'PERMISSION_DENIED', message: 'Unable to verify customer assignment. Access denied.' } });
  }
}

const router = Router();
const ADMIN_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'MANAGER',
  'OPERATIONS_MANAGER',
  'FINANCE_MANAGER',
  'KYC_OFFICER',
  'COMPLIANCE_OFFICER',
  'RISK_MANAGER',
  'RISK_OFFICER',
  'DEALER',
  'ANALYST',
  'SUPPORT_AGENT',
  'READ_ONLY_AUDITOR'
];

// ============================================================
// 1. EXECUTIVE DASHBOARD
// ============================================================
router.get('/dashboard/executive', authenticateToken, checkPermission('ADMIN_BROAD_VIEW'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [
      totalUsersRow, activeUsersRow, newUsersRow,
      kycPendingRow, kycRejectedRow, suspendedRow,
      ordersRow, tradesRow, turnoverRow,
      buyValueRow, sellValueRow, activeTradersRow,
      totalFundsRow, marginRow, brokerageRow, pendingWithdrawalsRow,
      highRiskRow, marginAlertsRow, rmsBlocksRow, frozenRow
    ] = await Promise.all([
      queryOne<any>('SELECT COUNT(*) as c FROM users'),
      queryOne<any>("SELECT COUNT(*) as c FROM users WHERE status = 'ACTIVE'"),
      queryOne<any>("SELECT COUNT(*) as c FROM users WHERE created_at > NOW() - INTERVAL '30 days'"),
      queryOne<any>("SELECT COUNT(*) as c FROM kyc_applications WHERE status IN ('SUBMITTED','UNDER_REVIEW')"),
      queryOne<any>("SELECT COUNT(*) as c FROM kyc_applications WHERE status = 'REJECTED'"),
      queryOne<any>("SELECT COUNT(*) as c FROM users WHERE status = 'SUSPENDED'"),
      queryOne<any>("SELECT COUNT(*) as c FROM orders WHERE created_at > NOW() - INTERVAL '1 day'"),
      queryOne<any>("SELECT COUNT(*) as c FROM executions WHERE executed_at > NOW() - INTERVAL '1 day'"),
      queryOne<any>('SELECT COUNT(*) as c FROM executions'),
      queryOne<any>('SELECT COALESCE(SUM(quantity * price), 0) as s FROM executions'),
      queryOne<any>("SELECT COALESCE(SUM(quantity * price), 0) as s FROM executions WHERE side = 'BUY'"),
      queryOne<any>("SELECT COALESCE(SUM(quantity * price), 0) as s FROM executions WHERE side = 'SELL'"),
      queryOne<any>("SELECT COUNT(DISTINCT user_id) as c FROM orders WHERE created_at > NOW() - INTERVAL '1 day'"),
      queryOne<any>('SELECT COALESCE(SUM(cash_balance), 0) as s FROM virtual_wallets'),
      queryOne<any>('SELECT COALESCE(SUM(used_margin), 0) as s FROM virtual_wallets'),
      queryOne<any>("SELECT COALESCE(SUM(amount), 0) as s FROM wallet_ledger WHERE transaction_type = 'BROKERAGE'"),
      queryOne<any>("SELECT COUNT(*) as c FROM wallet_ledger WHERE transaction_type = 'WITHDRAWAL' AND metadata->>'status' = 'PENDING'"),
      queryOne<any>("SELECT COUNT(*) as c FROM risk_events WHERE severity = 'HIGH' AND resolved = FALSE"),
      queryOne<any>("SELECT COUNT(*) as c FROM risk_events WHERE event_type = 'MARGIN_ALERT' AND resolved = FALSE"),
      queryOne<any>("SELECT COUNT(*) as c FROM risk_events WHERE event_type = 'RMS_BLOCK' AND resolved = FALSE"),
      queryOne<any>("SELECT COUNT(*) as c FROM users WHERE status = 'SUSPENDED'"),
    ]);

    const dbHealth = await checkDatabaseHealth();
    const mdProvider = MarketDataEngine.getInstance().getActiveProviderName();

    const totalTurnover = parseFloat(buyValueRow?.s || '0') + parseFloat(sellValueRow?.s || '0');
    const totalFunds = parseFloat(totalFundsRow?.s || '0');
    const marginUtilized = parseFloat(marginRow?.s || '0');
    const brokerage = parseFloat(brokerageRow?.s || '0');
    const pendingWithdrawals = parseInt(pendingWithdrawalsRow?.c || '0');

    const kpisPayload = {
      timestamp: new Date().toISOString(),
      customers: {
        total: parseInt(totalUsersRow?.c || '0'),
        active: parseInt(activeUsersRow?.c || '0'),
        new: parseInt(newUsersRow?.c || '0'),
        newLast30Days: parseInt(newUsersRow?.c || '0'),
        suspended: parseInt(suspendedRow?.c || '0'),
        frozen: parseInt(frozenRow?.c || '0'),
        kycPending: parseInt(kycPendingRow?.c || '0'),
        kycRejected: parseInt(kycRejectedRow?.c || '0')
      },
      trading: {
        ordersToday: parseInt(ordersRow?.c || '0'),
        tradesToday: parseInt(tradesRow?.c || '0'),
        totalTrades: parseInt(turnoverRow?.c || '0'),
        activeTraders: parseInt(activeTradersRow?.c || '0'),
        activeTradersToday: parseInt(activeTradersRow?.c || '0'),
        turnover: totalTurnover,
        totalTurnover: totalTurnover,
        buyValue: parseFloat(buyValueRow?.s || '0'),
        buyTurnover: parseFloat(buyValueRow?.s || '0'),
        sellValue: parseFloat(sellValueRow?.s || '0'),
        sellTurnover: parseFloat(sellValueRow?.s || '0')
      },
      financial: {
        totalFunds: totalFunds,
        totalFundsUnderCustody: totalFunds,
        marginUtilized: marginUtilized,
        totalMarginUtilized: marginUtilized,
        brokerage: brokerage,
        totalBrokerageEarned: brokerage,
        pendingWithdrawals: pendingWithdrawals,
        pendingWithdrawalsCount: pendingWithdrawals
      },
      financials: {
        totalFundsUnderCustody: totalFunds,
        totalMarginUtilized: marginUtilized,
        totalBrokerageEarned: brokerage,
        pendingWithdrawalsCount: pendingWithdrawals
      },
      risk: {
        highRiskClients: parseInt(highRiskRow?.c || '0'),
        highRiskEvents: parseInt(highRiskRow?.c || '0'),
        marginAlerts: parseInt(marginAlertsRow?.c || '0'),
        rmsBlocks: parseInt(rmsBlocksRow?.c || '0'),
        frozenAccounts: parseInt(frozenRow?.c || '0')
      },
      technology: {
        apiStatus: 'OPERATIONAL',
        wsStatus: 'CONNECTED',
        brokerStatus: mdProvider.toUpperCase(),
        marketDataStatus: 'LIVE',
        omsStatus: 'OPERATIONAL',
        rmsStatus: 'ACTIVE',
        databaseHealth: dbHealth.healthy ? 'HEALTHY' : 'DEGRADED'
      },
      system: {
        databaseHealthy: dbHealth.healthy,
        databaseLatencyMs: dbHealth.latencyMs,
        marketDataProvider: mdProvider,
        activeFeeds: 13,
        realMoneyAllowed: SafetyLock.REAL_MONEY_TRADING_ALLOWED
      }
    };

    res.json({
      success: true,
      kpis: kpisPayload,
      data: kpisPayload
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// 2. CUSTOMER MANAGEMENT
// ============================================================
router.get('/customers', authenticateToken, checkPermission('ADMIN_BROAD_VIEW'), async (req: AuthenticatedRequest, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string || '50', 10), 200);
  const offset = parseInt(req.query.offset as string || '0', 10);
  const search = req.query.search as string || '';
  const status = req.query.status as string || '';
  const role = req.query.role as string || '';

  let where = 'WHERE 1=1';
  const params: any[] = [];
  let paramIdx = 1;

  if (search) {
    where += ` AND (u.username ILIKE $${paramIdx} OR u.email ILIKE $${paramIdx} OR u.id ILIKE $${paramIdx} OR u.client_id ILIKE $${paramIdx})`;
    params.push(`%${search}%`);
    paramIdx++;
  }
  if (status) {
    where += ` AND u.status = $${paramIdx}`;
    params.push(status);
    paramIdx++;
  }
  if (role) {
    where += ` AND u.role = $${paramIdx}`;
    params.push(role);
    paramIdx++;
  }
  if (req.user!.role === 'MANAGER') {
    where += ` AND u.id IN (SELECT user_id FROM manager_assignments WHERE manager_id = $${paramIdx})`;
    params.push(req.user!.userId);
    paramIdx++;
  }

  const countRow = await queryOne<any>(`SELECT COUNT(*) as c FROM users u ${where}`, params);
  const users = await query(
    `SELECT u.id, u.client_id, u.username, u.email, u.full_name, u.phone_number, u.role, u.status, u.created_at, u.last_login_at, u.failed_login_attempts, u.is_kyc_completed,
            COALESCE(u.email_notifications_enabled, true) as email_notifications_enabled,
            w.cash_balance, w.used_margin,
            COALESCE(
              (SELECT status FROM kyc_applications WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1),
              (SELECT kyc_status FROM kyc_records WHERE customer_id = u.id ORDER BY created_at DESC LIMIT 1),
              CASE WHEN u.is_kyc_completed THEN 'APPROVED' ELSE 'NOT_SUBMITTED' END
            ) as kyc_status
     FROM users u
     LEFT JOIN virtual_wallets w ON u.id = w.user_id
     ${where}
     ORDER BY u.created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset]
  );

  res.json({ success: true, customers: users, total: parseInt(countRow?.c || '0'), pagination: { limit, offset } });
});

// ============================================================
// 2.1 TODAY'S ACTIVE CLIENTS & POSITIONS OVERVIEW
// ============================================================
router.get('/positions/overview', authenticateToken, checkPermission('ADMIN_BROAD_VIEW'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string || '50', 10), 200);
    const offset = Math.max(parseInt(req.query.offset as string || '0', 10), 0);
    const search = (req.query.search as string || '').trim();
    const tab = ((req.query.tab as string || 'ALL').toUpperCase()) as 'ALL' | 'OPEN' | 'CLOSED';

    let userWhere = 'WHERE 1=1';
    const params: any[] = [];
    let paramIdx = 1;

    // Search filter
    if (search) {
      userWhere += ` AND (u.username ILIKE $${paramIdx} OR u.email ILIKE $${paramIdx} OR u.id ILIKE $${paramIdx} OR u.client_id ILIKE $${paramIdx} OR u.full_name ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    // Manager role scoping (managers only see assigned clients)
    if (req.user!.role === 'MANAGER') {
      userWhere += ` AND u.id IN (SELECT user_id FROM manager_assignments WHERE manager_id = $${paramIdx})`;
      params.push(req.user!.userId);
      paramIdx++;
    }

    // Tab filter for "Today" scope (IST calendar day boundary)
    const openCondition = `EXISTS (SELECT 1 FROM positions p WHERE p.user_id = u.id AND p.net_qty != 0)`;
    const closedCondition = `EXISTS (SELECT 1 FROM closed_trades ct WHERE ct.user_id = u.id AND ct.closed_at >= (NOW() AT TIME ZONE 'Asia/Kolkata')::date)`;

    if (tab === 'OPEN') {
      userWhere += ` AND ${openCondition}`;
    } else if (tab === 'CLOSED') {
      userWhere += ` AND ${closedCondition}`;
    } else {
      userWhere += ` AND (${openCondition} OR ${closedCondition})`;
    }

    // 1. Total count of matching clients
    const countRow = await queryOne<{ c: string }>(
      `SELECT COUNT(*) as c FROM users u ${userWhere}`,
      params
    );
    const total = parseInt(countRow?.c || '0', 10);

    // 2. Summary Totals (totalUnrealizedPnl, totalRealizedPnl) across ALL matching today-scoped clients
    const realizedSummaryRow = await queryOne<{ total_realized: string }>(
      `SELECT COALESCE(SUM(ct.net_pnl), 0) as total_realized
       FROM closed_trades ct
       JOIN users u ON ct.user_id = u.id
       ${userWhere}
       AND ct.closed_at >= (NOW() AT TIME ZONE 'Asia/Kolkata')::date`,
      params
    );
    const totalRealizedPnl = parseFloat(realizedSummaryRow?.total_realized || '0');

    const allOpenPositions = await query<any>(
      `SELECT p.symbol, p.net_qty, p.average_price, p.ltp, p.unrealized_pnl
       FROM positions p
       JOIN users u ON p.user_id = u.id
       ${userWhere}
       AND p.net_qty != 0`,
      params
    );

    const marketEngine = MarketDataEngine.getInstance();
    let totalUnrealizedPnl = 0;
    for (const pos of allOpenPositions) {
      const netQty = parseInt(pos.net_qty || '0', 10);
      const avgPx = parseFloat(pos.average_price || '0');
      const cachedTick = marketEngine.getCachedTick(pos.symbol);
      const liveLtp = cachedTick?.ltp ?? parseFloat(pos.ltp || pos.average_price || '0');
      const pnl = netQty !== 0 ? (liveLtp - avgPx) * netQty : parseFloat(pos.unrealized_pnl || '0');
      totalUnrealizedPnl += pnl;
    }

    // 3. Paginated client list
    const clientRows = await query<any>(
      `SELECT u.id, u.client_id, u.username, u.full_name,
              w.cash_balance, w.used_margin
       FROM users u
       LEFT JOIN virtual_wallets w ON u.id = w.user_id
       ${userWhere}
       ORDER BY u.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    );

    const userIds = clientRows.map(u => u.id);
    let pagePositions: any[] = [];
    let pageClosedTrades: any[] = [];

    if (userIds.length > 0) {
      const [posRows, closedRows] = await Promise.all([
        query<any>(
          `SELECT id, user_id, symbol, exchange, product_type, net_qty, average_price, ltp, unrealized_pnl, updated_at
           FROM positions
           WHERE user_id = ANY($1) AND net_qty != 0
           ORDER BY updated_at DESC`,
          [userIds]
        ),
        query<any>(
          `SELECT id, user_id, symbol, exchange, product_type, quantity, entry_price, exit_price, net_pnl, exit_reason, closed_at
           FROM closed_trades
           WHERE user_id = ANY($1) AND closed_at >= (NOW() AT TIME ZONE 'Asia/Kolkata')::date
           ORDER BY closed_at DESC`,
          [userIds]
        )
      ]);
      pagePositions = posRows;
      pageClosedTrades = closedRows;
    }

    // Map open positions by user_id with live tick enrichment
    const positionsByUser = new Map<string, any[]>();
    for (const pos of pagePositions) {
      const netQty = parseInt(pos.net_qty || '0', 10);
      const avgPx = parseFloat(pos.average_price || '0');
      const cachedTick = marketEngine.getCachedTick(pos.symbol);
      const liveLtp = cachedTick?.ltp ?? parseFloat(pos.ltp || pos.average_price || '0');
      const unrealizedPnl = netQty !== 0 ? (liveLtp - avgPx) * netQty : parseFloat(pos.unrealized_pnl || '0');

      const enriched = {
        id: pos.id,
        symbol: pos.symbol,
        exchange: pos.exchange,
        productType: pos.product_type,
        netQty,
        averagePrice: avgPx,
        ltp: liveLtp,
        unrealizedPnl
      };

      const userList = positionsByUser.get(pos.user_id) || [];
      userList.push(enriched);
      positionsByUser.set(pos.user_id, userList);
    }

    // Map closed trades by user_id
    const closedByUser = new Map<string, any[]>();
    for (const ct of pageClosedTrades) {
      const closed = {
        id: ct.id,
        symbol: ct.symbol,
        exchange: ct.exchange,
        productType: ct.product_type,
        quantity: parseInt(ct.quantity || '0', 10),
        entryPrice: parseFloat(ct.entry_price || '0'),
        exitPrice: parseFloat(ct.exit_price || '0'),
        netPnl: parseFloat(ct.net_pnl || '0'),
        exitReason: ct.exit_reason,
        closedAt: ct.closed_at
      };

      const userList = closedByUser.get(ct.user_id) || [];
      userList.push(closed);
      closedByUser.set(ct.user_id, userList);
    }

    const clients = clientRows.map(u => ({
      id: u.id,
      clientId: u.client_id || u.id,
      username: u.username,
      fullName: u.full_name || u.username,
      marginUtilized: parseFloat(u.used_margin || '0'),
      availableFunds: parseFloat(u.cash_balance || '0'),
      openPositions: positionsByUser.get(u.id) || [],
      closedPositions: closedByUser.get(u.id) || []
    }));

    res.json({
      success: true,
      total,
      summary: {
        totalUnrealizedPnl,
        totalRealizedPnl
      },
      clients,
      pagination: {
        limit,
        offset
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// Real-Time Duplicate Identity Checker API
router.get('/customers/check-duplicate', authenticateToken, checkPermission('ADMIN_BROAD_VIEW'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const email = req.query.email as string || '';
    const username = req.query.username as string || '';
    const clientId = req.query.clientId as string || '';
    const excludeUserId = req.query.excludeUserId as string || '';

    const result = await ClientCreationService.checkDuplicate({ email, username, clientId, excludeUserId });
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// Admin Add Customer / Create Client API
router.post('/customers/create', authenticateToken, checkPermission('USER_CREATE'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { username, email, password, role, clientId, fullName, phoneNumber, initialCapital, city, address } = req.body;

    // Mirrors the same role-change gate PATCH /customers/:id already enforces (line ~2169) —
    // USER_CREATE's default roles include MANAGER/OPERATIONS_MANAGER, so without this check
    // a manager-tier staff member could mint a brand-new SUPER_ADMIN account outright.
    if (role && role !== 'USER' && req.user!.role !== 'SUPER_ADMIN' && req.user!.role !== 'ADMIN') {
      res.status(403).json({ success: false, error: { code: 'PERMISSION_DENIED', message: 'Only SUPER_ADMIN or ADMIN can create a staff account with an elevated role.' } });
      return;
    }

    const result = await ClientCreationService.createClient({
      username,
      email,
      password,
      role: role || 'USER',
      clientId,
      fullName,
      phoneNumber,
      city,
      address,
      initialCapital: parseFloat(initialCapital) || 0.0,
      creatorId: req.user!.userId,
      creatorRole: req.user!.role,
      creatorIp: getClientIp(req)
    });

    if (!result.success || !result.user) {
      const statusCode = result.error?.code?.startsWith('DUPLICATE_') ? 409 : 400;
      res.status(statusCode).json({ success: false, error: result.error });
      return;
    }

    res.status(201).json({
      success: true,
      message: `Customer ${result.user.username} (Client ID: ${result.user.clientId}) created successfully.`,
      user: result.user
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// Scan Database for Duplicate Identities (Email, Phone, PAN)
router.get('/customers/duplicates', authenticateToken, checkPermission('CUSTOMERS_DUPLICATE_SCAN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    // 1. Find users with identical normalized emails (if any)
    const emailDups = await query<any>(
      `SELECT LOWER(TRIM(email)) as norm_email, COUNT(*) as count, ARRAY_AGG(id) as user_ids, ARRAY_AGG(username) as usernames, ARRAY_AGG(client_id) as client_ids
       FROM users
       GROUP BY LOWER(TRIM(email))
       HAVING COUNT(*) > 1`
    );

    // 2. Find users with identical phone numbers (if populated)
    const phoneDups = await query<any>(
      `SELECT phone_number, COUNT(*) as count, ARRAY_AGG(id) as user_ids, ARRAY_AGG(username) as usernames, ARRAY_AGG(client_id) as client_ids
       FROM users
       WHERE phone_number IS NOT NULL AND phone_number != ''
       GROUP BY phone_number
       HAVING COUNT(*) > 1`
    );

    // 3. Find users with identical PAN in KYC records
    const panDups = await query<any>(
      `SELECT pan_number, COUNT(*) as count, ARRAY_AGG(customer_id) as user_ids
       FROM kyc_records
       WHERE pan_number IS NOT NULL AND pan_number != ''
       GROUP BY pan_number
       HAVING COUNT(*) > 1`
    );

    res.json({
      success: true,
      duplicates: {
        byEmail: emailDups,
        byPhone: phoneDups,
        byPan: panDups,
        totalFlaggedGroups: emailDups.length + phoneDups.length + panDups.length
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.get('/customers/:id', authenticateToken, checkPermission('ADMIN_BROAD_VIEW'), restrictManagerToOwnCustomer, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.params.id;
    const [user, wallet, kycApplications, kycRecords, orders, trades, positions, holdings, ledger, auditLogs, managerAssignments] = await Promise.all([
      queryOne<any>(
        `SELECT id, username, email, role, status, created_at, last_login_at, failed_login_attempts, 
                full_name, phone_number, city, address, date_of_birth, is_kyc_completed, 
                bank_name, bank_account_number, bank_account_name, bank_ifsc, onboarding_completed, risk_restriction,
                COALESCE(email_notifications_enabled, true) as email_notifications_enabled
         FROM users WHERE id = $1`, 
        [customerId]
      ),
      queryOne<any>('SELECT * FROM virtual_wallets WHERE user_id = $1', [customerId]),
      query<any>(
        `SELECT ka.*, 
                (SELECT json_agg(json_build_object(
                  'id', kd.id, 'document_type', kd.document_type, 
                  'original_filename', kd.original_filename, 'mime_type', kd.mime_type,
                  'file_size', kd.file_size, 'uploaded_at', kd.uploaded_at
                )) FROM kyc_documents kd WHERE kd.kyc_application_id = ka.id) as documents
         FROM kyc_applications ka WHERE ka.user_id = $1 ORDER BY ka.created_at DESC`,
        [customerId]
      ),
      query('SELECT * FROM kyc_records WHERE customer_id = $1 ORDER BY created_at DESC', [customerId]),
      query('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50', [customerId]),
      query('SELECT * FROM executions WHERE user_id = $1 ORDER BY executed_at DESC LIMIT 50', [customerId]),
      query('SELECT * FROM positions WHERE user_id = $1', [customerId]),
      query('SELECT * FROM holdings WHERE user_id = $1', [customerId]),
      query('SELECT * FROM wallet_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50', [customerId]),
      query('SELECT * FROM audit_logs WHERE actor_id = $1 OR resource_id = $1 ORDER BY timestamp DESC LIMIT 50', [customerId]),
      // Surfaced here per the Phase F1 gap analysis: manager_assignments allows the same
      // customer to be assigned to more than one manager with no visibility into that at
      // all today — showing it on Customer360 makes that state visible for the first time.
      query(`SELECT ma.manager_id, u.username AS manager_username, u.role AS manager_role
             FROM manager_assignments ma JOIN users u ON ma.manager_id = u.id
             WHERE ma.user_id = $1 ORDER BY ma.created_at DESC`, [customerId]),
    ]);

    if (!user) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });
      return;
    }

    const marketEngine = MarketDataEngine.getInstance();
    const enrichedPositions = (positions || []).map((p: any) => {
      const netQty = parseInt(p.net_qty || '0', 10);
      const avgPx = parseFloat(p.average_price || '0');
      const cachedTick = marketEngine.getCachedTick(p.symbol) || 
                         (p.instrument_token ? marketEngine.getCachedTick(p.instrument_token) : undefined);
      const liveLtp = cachedTick?.ltp ?? parseFloat(p.ltp || p.average_price || '0');
      const unrealized = netQty !== 0 ? (liveLtp - avgPx) * netQty : parseFloat(p.unrealized_pnl || '0');
      return {
        ...p,
        ltp: liveLtp,
        unrealized_pnl: unrealized
      };
    });

    const enrichedHoldings = (holdings || []).map((h: any) => {
      const qty = parseInt(h.quantity || '0', 10);
      const avgPx = parseFloat(h.average_price || '0');
      const cachedTick = marketEngine.getCachedTick(h.symbol) || 
                         (h.instrument_token ? marketEngine.getCachedTick(h.instrument_token) : undefined);
      const liveLtp = cachedTick?.ltp ?? parseFloat(h.ltp || h.average_price || '0');
      const pnl = qty > 0 ? (liveLtp - avgPx) * qty : 0;
      return {
        ...h,
        ltp: liveLtp,
        pnl
      };
    });

    const synthesizedKycRecords = (kycApplications && kycApplications.length > 0)
      ? kycApplications.map((ka: any) => ({
          id: ka.id,
          customer_id: ka.user_id,
          kyc_status: ka.status,
          verification_status: ka.status === 'APPROVED' ? 'VERIFIED' : (ka.status === 'REJECTED' ? 'REJECTED' : 'PENDING'),
          pan_number: ka.pan_number,
          aadhaar_number: ka.aadhaar_number,
          bank_account_no: ka.bank_account_number,
          bank_name: ka.bank_name,
          bank_account_name: ka.bank_account_name,
          ifsc_code: ka.bank_ifsc,
          verification_method: ka.verification_method,
          didit_session_id: ka.didit_session_id,
          didit_session_url: ka.didit_session_url,
          didit_session_status: ka.didit_session_status,
          didit_decision_data: ka.didit_decision_data,
          documents: ka.documents || [],
          notes: ka.rejection_reason,
          created_at: ka.created_at,
          updated_at: ka.updated_at
        }))
      : (kycRecords || []).map((kr: any) => ({
          ...kr,
          documents: []
        }));

    res.json({
      success: true,
      customer: {
        profile: user,
        wallet,
        kycRecords: synthesizedKycRecords,
        kycApplications: kycApplications || [],
        orders,
        trades,
        positions: enrichedPositions,
        holdings: enrichedHoldings,
        ledger,
        auditLogs,
        managerAssignments
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/customers/:id/freeze', authenticateToken, checkPermission('USER_LOCK_UNLOCK'), restrictManagerToOwnCustomer, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reason } = req.body;
    const targetId = req.params.id as string;
    // 'FROZEN' was never a legal value for users.status (only for virtual_wallets.status) —
    // this previously violated the users_status_check constraint on every real call.
    await execute("UPDATE users SET status = 'SUSPENDED', updated_at = NOW() WHERE id = $1", [targetId]);
    await logAuditAction(req.user!.userId, req.user!.role, 'FREEZE_ACCOUNT', 'USER', targetId, null, { reason }, getClientIp(req));
    res.json({ success: true, message: 'Account frozen' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/customers/:id/unfreeze', authenticateToken, checkPermission('USER_LOCK_UNLOCK'), restrictManagerToOwnCustomer, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reason } = req.body;
    const targetId = req.params.id as string;
    await execute("UPDATE users SET status = 'ACTIVE', updated_at = NOW() WHERE id = $1", [targetId]);
    await logAuditAction(req.user!.userId, req.user!.role, 'UNFREEZE_ACCOUNT', 'USER', targetId, null, { reason }, getClientIp(req));
    res.json({ success: true, message: 'Account unfrozen' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/customers/:id/clear-risk-restriction', authenticateToken, checkPermission('USER_LOCK_UNLOCK'), restrictManagerToOwnCustomer, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetId = req.params.id as string;
    await execute("UPDATE users SET risk_restriction = NULL, updated_at = NOW() WHERE id = $1", [targetId]);
    await logAuditAction(req.user!.userId, req.user!.role, 'CLEAR_RISK_RESTRICTION', 'USER', targetId, null, { reason: 'Cleared by admin' }, getClientIp(req));
    res.json({ success: true, message: 'Risk restriction cleared. Normal trading restored.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/customers/:id/sync-margin', authenticateToken, checkPermission('FUNDS_MANAGE'), restrictManagerToOwnCustomer, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetId = req.params.id as string;
    const recomputed = await VirtualWalletLedger.recomputeUsedMarginForUser(targetId);
    await logAuditAction(req.user!.userId, req.user!.role, 'SYNC_USED_MARGIN', 'USER', targetId, null, { recomputedMargin: recomputed }, getClientIp(req));
    res.json({ success: true, message: `Used margin synchronized successfully (₹${recomputed.toLocaleString('en-IN')})`, used_margin: recomputed });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/customers/:id/reset-password', authenticateToken, checkPermission('USER_RESET_PASSWORD'), restrictManagerToOwnCustomer, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetUserId = req.params.id as string;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ success: false, error: { code: 'INVALID_PASSWORD', message: 'New password must be at least 6 characters long' } });
      return;
    }

    const targetUser = await queryOne<any>('SELECT id, username, email, role FROM users WHERE id = $1', [targetUserId]);
    if (!targetUser) {
      res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'Target user not found' } });
      return;
    }

    // Hash password with Argon2
    const passwordHash = await argon2.hash(newPassword);

    await execute(
      `UPDATE users 
       SET password_hash = $1, failed_login_attempts = 0, updated_at = NOW() 
       WHERE id = $2`,
      [passwordHash, targetUserId]
    );

    await logAuditAction(
      req.user!.userId,
      req.user!.role,
      'ADMIN_RESET_PASSWORD',
      'USER',
      targetUserId,
      null,
      { targetUsername: targetUser.username, targetEmail: targetUser.email },
      getClientIp(req)
    );

    res.json({
      success: true,
      message: `Password successfully reset for user ${targetUser.username} (${targetUser.email}).`
    });
  } catch (err: any) {
    console.error('[Admin Reset Password Error]', err);
    res.status(500).json({ success: false, error: { message: err.message || 'Failed to reset user password' } });
  }
});

// Admin Permanently Delete Customer Account
router.delete('/customers/:id', authenticateToken, checkPermission('CUSTOMERS_DELETE'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetUserId = req.params.id as string;

    // Prevent deleting self (current logged-in admin)
    if (targetUserId === req.user!.userId) {
      res.status(400).json({ success: false, error: { code: 'CANNOT_DELETE_SELF', message: 'You cannot delete your own admin account.' } });
      return;
    }

    const user = await queryOne<any>('SELECT id, username, email, role, status FROM users WHERE id = $1', [targetUserId]);
    if (!user) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found.' } });
      return;
    }

    // Only SUPER_ADMIN can delete other ADMIN/SUPER_ADMIN accounts
    if (['ADMIN', 'SUPER_ADMIN'].includes(user.role) && req.user!.role !== 'SUPER_ADMIN') {
      res.status(403).json({ success: false, error: { code: 'PERMISSION_DENIED', message: 'Only SUPER_ADMIN can delete administrator accounts.' } });
      return;
    }

    await withTransaction(async (client) => {
      // 1. Delete records from tables without ON DELETE CASCADE
      await client.query('DELETE FROM kyc_records WHERE customer_id = $1', [targetUserId]);
      await client.query('DELETE FROM risk_events WHERE customer_id = $1', [targetUserId]);
      await client.query('DELETE FROM support_tickets WHERE customer_id = $1 OR user_id = $1', [targetUserId]);
      await client.query('DELETE FROM duplicate_account_reviews WHERE primary_user_id = $1 OR duplicate_user_id = $1', [targetUserId]);
      await client.query('DELETE FROM manager_assignments WHERE user_id = $1 OR manager_id = $1', [targetUserId]);

      // 2. Delete user (all other FKs: virtual_wallets, wallet_ledger, orders, positions, holdings, closed_trades, kyc_applications, chat_messages, notifications, sessions cascade automatically)
      await client.query('DELETE FROM users WHERE id = $1', [targetUserId]);
    });

    await logAuditAction(
      req.user!.userId,
      req.user!.role,
      'DELETE_CUSTOMER',
      'USER',
      targetUserId,
      null,
      { deletedUsername: user.username, deletedEmail: user.email, deletedRole: user.role },
      getClientIp(req)
    );

    res.json({
      success: true,
      message: `Account for ${user.username} (${user.email}) has been permanently deleted.`
    });
  } catch (err: any) {
    console.error('[Delete Customer Error]', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message || 'Failed to delete customer account' } });
  }
});

// ============================================================
// 3. KYC MANAGEMENT
// ============================================================
router.get('/kyc/queue', authenticateToken, checkPermission('KYC_QUEUE_VIEW'), async (req: AuthenticatedRequest, res: Response) => {
  const status = req.query.status as string || '';
  let where = '';
  const params: any[] = [];
  if (status) { where = 'WHERE k.kyc_status = $1'; params.push(status); }

  const records = await query(
    `SELECT k.*, u.username, u.email FROM kyc_records k
     JOIN users u ON k.customer_id = u.id
     ${where}
     ORDER BY k.created_at DESC LIMIT 200`,
    params
  );
  res.json({ success: true, records });
});

router.post('/kyc/:id/approve', authenticateToken, checkPermission('KYC_VERIFY_APPROVE'), async (req: AuthenticatedRequest, res: Response) => {
  const { notes } = req.body;
  const kycId = req.params.id as string;
  await execute(
    "UPDATE kyc_records SET kyc_status = 'APPROVED', verification_status = 'VERIFIED', verified_by = $1, verified_at = NOW(), notes = $2, updated_at = NOW() WHERE id = $3",
    [req.user!.userId, notes || '', kycId]
  );
  await logAuditAction(req.user!.userId, req.user!.role, 'APPROVE_KYC', 'KYC', kycId, null, { notes }, getClientIp(req));
  res.json({ success: true, message: 'KYC approved' });
});

router.post('/kyc/:id/reject', authenticateToken, checkPermission('KYC_VERIFY_APPROVE'), async (req: AuthenticatedRequest, res: Response) => {
  const { reason } = req.body;
  const kycId = req.params.id as string;
  await execute(
    "UPDATE kyc_records SET kyc_status = 'REJECTED', verification_status = 'FAILED', verified_by = $1, verified_at = NOW(), notes = $2, updated_at = NOW() WHERE id = $3",
    [req.user!.userId, reason || '', kycId]
  );
  await logAuditAction(req.user!.userId, req.user!.role, 'REJECT_KYC', 'KYC', kycId, null, { reason }, getClientIp(req));
  res.json({ success: true, message: 'KYC rejected' });
});

// ============================================================
// 4. ORDER MONITOR
// ============================================================
router.get('/orders/monitor', authenticateToken, checkPermission('ORDERS_MONITOR_VIEW'), async (req: AuthenticatedRequest, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string || '100', 10), 500);
  const status = req.query.status as string || '';
  const exchange = req.query.exchange as string || '';
  const side = req.query.side as string || '';

  let where = 'WHERE 1=1';
  const params: any[] = [];
  let paramIdx = 1;

  if (status) { where += ` AND o.status = $${paramIdx}`; params.push(status); paramIdx++; }
  if (exchange) { where += ` AND o.exchange = $${paramIdx}`; params.push(exchange); paramIdx++; }
  if (side) { where += ` AND o.side = $${paramIdx}`; params.push(side); paramIdx++; }

  const orders = await query(
    `SELECT o.*, u.username as client_name
     FROM orders o
     JOIN users u ON o.user_id = u.id
     ${where}
     ORDER BY o.created_at DESC LIMIT $${paramIdx}`,
    [...params, limit]
  );
  res.json({ success: true, orders });
});

router.get('/orders/:id/events', authenticateToken, checkPermission('ORDERS_MONITOR_VIEW'), async (req: AuthenticatedRequest, res: Response) => {
  const orderId = req.params.id as string;
  const events = await query(
    'SELECT * FROM order_events WHERE order_id = $1 ORDER BY created_at ASC',
    [orderId]
  );
  // If no order_events table exists yet, return the order itself as a single event
  if (!events || events.length === 0) {
    const order = await queryOne<any>('SELECT * FROM orders WHERE order_id = $1', [orderId]);
    res.json({ success: true, events: order ? [{ event_type: order.status, created_at: order.created_at, payload: order }] : [] });
    return;
  }
  res.json({ success: true, events });
});

// ============================================================
// 5. RISK COMMAND CENTER
// ============================================================
router.get('/risk/dashboard', authenticateToken, checkPermission('RISK_DASHBOARD_VIEW'), async (req: AuthenticatedRequest, res: Response) => {
  const [totalExposure, marginUsed, highRisk, marginAlerts, frozenAccounts, rmsBlocks] = await Promise.all([
    queryOne<any>('SELECT COALESCE(SUM(used_margin), 0) as s FROM virtual_wallets'),
    queryOne<any>('SELECT COALESCE(SUM(used_margin), 0) as s FROM virtual_wallets WHERE used_margin > 0'),
    query("SELECT u.id, u.username, u.email, w.cash_balance, w.used_margin FROM users u JOIN virtual_wallets w ON u.id = w.user_id WHERE w.used_margin > w.cash_balance * 0.8 LIMIT 20"),
    query("SELECT * FROM risk_events WHERE event_type = 'MARGIN_ALERT' AND resolved = FALSE ORDER BY created_at DESC LIMIT 50"),
    query("SELECT u.id, u.username, u.email FROM users u WHERE u.status = 'SUSPENDED'"),
    query("SELECT * FROM risk_events WHERE event_type = 'RMS_BLOCK' AND resolved = FALSE ORDER BY created_at DESC LIMIT 50")
  ]);

  res.json({
    success: true,
    risk: {
      totalExposure: parseFloat(totalExposure?.s || '0'),
      marginUsed: parseFloat(marginUsed?.s || '0'),
      highRiskClients: highRisk,
      marginAlerts,
      frozenAccounts,
      rmsBlocks
    }
  });
});

router.get('/risk/alerts', authenticateToken, checkPermission('RISK_DASHBOARD_VIEW'), async (req: AuthenticatedRequest, res: Response) => {
  const alerts = await query(
    `SELECT re.*, u.username FROM risk_events re
     LEFT JOIN users u ON re.customer_id = u.id
     WHERE re.resolved = FALSE
     ORDER BY CASE re.severity WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END, re.created_at DESC
     LIMIT 100`
  );
  res.json({ success: true, alerts });
});

// `resolved`/`resolved_by`/`resolved_at` have existed on risk_events since the
// original migration, but no route ever set them — a risk event, once written,
// could never be marked handled. This closes that gap (found during Phase F3).
router.post('/risk/alerts/:id/resolve', authenticateToken, checkPermission('RISK_DASHBOARD_VIEW'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const updated = await queryOne<any>(
      `UPDATE risk_events SET resolved = TRUE, resolved_by = $1, resolved_at = NOW()
       WHERE id = $2 AND resolved = FALSE
       RETURNING id`,
      [req.user!.userId, id]
    );
    if (!updated) {
      res.status(409).json({ success: false, error: { code: 'ALREADY_RESOLVED', message: 'Risk event not found or already resolved.' } });
      return;
    }
    await logAuditAction(req.user!.userId, req.user!.role, 'RESOLVE_RISK_EVENT', 'RISK_EVENT', id, null, null, getClientIp(req));
    res.json({ success: true, message: 'Risk event marked resolved.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// Resolve client risk: intelligent de-risk (cancel resting orders, optional square-off, authoritative margin recompute)
router.post('/risk/clients/:id/resolve', authenticateToken, checkPermission('RISK_DASHBOARD_VIEW'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.params.id as string;
    const { cancelOrders = true, squareOffPositions = false, resetMargin = false } = req.body || {};

    const user = await queryOne<any>('SELECT id, username, email FROM users WHERE id = $1', [customerId]);
    if (!user) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Client not found' } });
      return;
    }

    let cancelledOrdersCount = 0;
    let squaredOffCount = 0;

    // 1. Cancel resting orders if requested
    if (cancelOrders) {
      const pendingOrders = await query<any>(
        `SELECT id, order_id, symbol, status FROM orders 
         WHERE user_id = $1 AND status IN ('ACCEPTED', 'PENDING', 'OPEN', 'TRIGGER_PENDING')`,
        [customerId]
      );

      for (const ord of pendingOrders) {
        let wasCancelled = false;
        await withTransaction(async (client: any) => {
          const upd = await client.query(
            `UPDATE orders SET status = 'CANCELLED', updated_at = NOW()
             WHERE id = $1 AND status IN ('ACCEPTED', 'PENDING', 'OPEN', 'TRIGGER_PENDING')
             RETURNING id`,
            [ord.id]
          );
          if (upd.rows.length > 0) {
            wasCancelled = true;
            await client.query(
              `INSERT INTO order_events (id, order_id, from_status, to_status, reason, actor)
               VALUES ($1, $2, $3, 'CANCELLED', $4, 'ADMIN')`,
              ['evt_' + generateUUID(), ord.id, ord.status, 'Cancelled via Risk Command Center de-risk']
            );
          }
        });
        if (wasCancelled) {
          cancelledOrdersCount++;
          emitAdminOrderEvent(customerId, 'ORDER_UPDATED', { id: ord.id, status: 'CANCELLED' });
        }
      }
    }

    // 2. Square off active positions if requested
    if (squareOffPositions) {
      const { PortfolioService } = require('../trading/PortfolioService');
      const openPositions = await query<any>(
        `SELECT id, symbol, exchange, product_type, net_qty, average_price, ltp 
         FROM positions WHERE user_id = $1 AND net_qty != 0`,
        [customerId]
      );

      for (const pos of openPositions) {
        const netQty = parseInt(pos.net_qty, 10);
        if (netQty === 0) continue;
        const exitSide = netQty > 0 ? 'SELL' : 'BUY';
        const exitQty = Math.abs(netQty);
        const exitPrice = parseFloat(pos.ltp) || parseFloat(pos.average_price) || 100;

        await withTransaction(async (client: any) => {
          const locked = await client.query('SELECT net_qty FROM positions WHERE id = $1 FOR UPDATE', [pos.id]);
          if (locked.rows.length === 0 || parseInt(locked.rows[0].net_qty, 10) !== netQty) return;

          const tradeRes = await PortfolioService.recordExecutionInTransaction(
            client, customerId, pos.symbol, pos.exchange || 'NSE', pos.product_type || 'MIS',
            exitSide, exitQty, exitPrice, 'ADMIN_SQUARE_OFF', 'RISK_DE_RISK', 'exc_' + generateUUID()
          );

          await VirtualWalletLedger.settleTradeExecutionInTransaction(
            client, customerId, exitSide, exitPrice * exitQty,
            tradeRes.releasedPositionCapital, tradeRes.realizedPnlDelta, 'RISK_COMMAND_CENTER'
          );
          squaredOffCount++;
        });
      }
    }

    // 3. Recompute used margin
    let recomputedMargin = 0;
    if (resetMargin) {
      await execute('UPDATE virtual_wallets SET used_margin = 0, updated_at = NOW() WHERE user_id = $1', [customerId]);
      recomputedMargin = 0;
    } else {
      recomputedMargin = await VirtualWalletLedger.recomputeUsedMarginForUser(customerId);
    }

    // 4. Mark active risk events for this client as resolved
    await execute(
      `UPDATE risk_events SET resolved = TRUE, resolved_by = $1, resolved_at = NOW()
       WHERE customer_id = $2 AND resolved = FALSE`,
      [req.user!.userId, customerId]
    );

    await logAuditAction(req.user!.userId, req.user!.role, 'RESOLVE_CLIENT_RISK', 'USER', customerId, null, {
      cancelledOrdersCount,
      squaredOffCount,
      recomputedMargin,
      cancelOrders,
      squareOffPositions
    }, getClientIp(req));

    emitAdminFundsUpdate(customerId, { userId: customerId });

    res.json({
      success: true,
      message: `Risk resolved for ${user.username}. Cancelled ${cancelledOrdersCount} orders, squared off ${squaredOffCount} positions. Current margin: ₹${recomputedMargin.toLocaleString('en-IN')}`,
      cancelledOrdersCount,
      squaredOffCount,
      used_margin: recomputedMargin
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// Cancel all pending orders for a client and recompute margin
router.post('/risk/clients/:id/cancel-orders', authenticateToken, checkPermission('RISK_DASHBOARD_VIEW'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.params.id as string;
    const pendingOrders = await query<any>(
      `SELECT id, status FROM orders 
       WHERE user_id = $1 AND status IN ('ACCEPTED', 'PENDING', 'OPEN', 'TRIGGER_PENDING')`,
      [customerId]
    );

    let count = 0;
    for (const ord of pendingOrders) {
      let cancelled = false;
      await withTransaction(async (client: any) => {
        const upd = await client.query(
          `UPDATE orders SET status = 'CANCELLED', updated_at = NOW()
           WHERE id = $1 AND status IN ('ACCEPTED', 'PENDING', 'OPEN', 'TRIGGER_PENDING')
           RETURNING id`,
          [ord.id]
        );
        if (upd.rows.length > 0) {
          cancelled = true;
          await client.query(
            `INSERT INTO order_events (id, order_id, from_status, to_status, reason, actor)
             VALUES ($1, $2, $3, 'CANCELLED', $4, 'ADMIN')`,
            ['evt_' + generateUUID(), ord.id, ord.status, 'Cancelled by Admin in Risk Command Center']
          );
        }
      });
      if (cancelled) count++;
    }

    const recomputed = await VirtualWalletLedger.recomputeUsedMarginForUser(customerId);
    await logAuditAction(req.user!.userId, req.user!.role, 'CANCEL_ALL_ORDERS', 'USER', customerId, null, { cancelledCount: count }, getClientIp(req));

    res.json({ success: true, message: `Cancelled ${count} orders. Current margin: ₹${recomputed.toLocaleString('en-IN')}`, cancelledCount: count, used_margin: recomputed });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// Synchronize / recompute margin for a single client
router.post('/risk/clients/:id/sync-margin', authenticateToken, checkPermission('RISK_DASHBOARD_VIEW'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.params.id as string;
    const recomputed = await VirtualWalletLedger.recomputeUsedMarginForUser(customerId);
    await logAuditAction(req.user!.userId, req.user!.role, 'SYNC_USED_MARGIN', 'USER', customerId, null, { recomputedMargin: recomputed }, getClientIp(req));
    res.json({ success: true, message: `Used margin synchronized successfully (₹${recomputed.toLocaleString('en-IN')})`, used_margin: recomputed });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// Recompute and heal margins across all high-risk accounts platform-wide
router.post('/risk/sync-all-margins', authenticateToken, checkPermission('RISK_DASHBOARD_VIEW'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clients = await query<any>(
      `SELECT DISTINCT u.id, u.username, w.used_margin, w.cash_balance 
       FROM users u JOIN virtual_wallets w ON u.id = w.user_id 
       WHERE w.used_margin > 0 OR w.used_margin > (w.cash_balance * 0.8)`
    );

    let healedCount = 0;
    const results: any[] = [];

    for (const c of clients) {
      const oldMargin = parseFloat(c.used_margin || '0');
      const newMargin = await VirtualWalletLedger.recomputeUsedMarginForUser(c.id);
      if (Math.abs(oldMargin - newMargin) > 0.01) {
        healedCount++;
        results.push({ id: c.id, username: c.username, oldMargin, newMargin });
      }
    }

    await logAuditAction(req.user!.userId, req.user!.role, 'SYNC_ALL_MARGINS', 'RISK', 'GLOBAL', null, {
      checkedCount: clients.length,
      healedCount,
      results
    }, getClientIp(req));

    res.json({
      success: true,
      message: `Margin synchronization complete. Checked ${clients.length} accounts, healed ${healedCount} out-of-sync margins.`,
      checkedCount: clients.length,
      healedCount
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// ADMIN NOTIFICATIONS (Phase F3 — global alert feed)
// A single shared feed across all staff, backed by the admin_notifications
// table (provisioned since migration 016, never wired to anything until now).
// read_at is one column, not per-admin — any staff member marking a
// notification read marks it read for everyone, matching the table's schema.
// ============================================================
router.get('/notifications', authenticateToken, checkRole(ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 200);
    const unreadOnly = req.query.unreadOnly === 'true';
    const rows = await query<any>(
      `SELECT n.*, u.username, u.email FROM admin_notifications n
       LEFT JOIN users u ON n.user_id = u.id
       ${unreadOnly ? 'WHERE n.read_at IS NULL' : ''}
       ORDER BY n.created_at DESC LIMIT $1`,
      [limit]
    );
    const unreadCount = await queryOne<any>('SELECT COUNT(*) as c FROM admin_notifications WHERE read_at IS NULL');
    res.json({ success: true, notifications: rows, unreadCount: parseInt(unreadCount?.c || '0', 10) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/notifications/:id/read', authenticateToken, checkRole(ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    await execute('UPDATE admin_notifications SET read_at = NOW() WHERE id = $1 AND read_at IS NULL', [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/notifications/mark-all-read', authenticateToken, checkRole(ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    await execute('UPDATE admin_notifications SET read_at = NOW() WHERE read_at IS NULL');
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// 6. KILL SWITCH
// ============================================================
router.get('/risk/kill-switch', authenticateToken, checkPermission('RISK_DASHBOARD_VIEW'), async (req: AuthenticatedRequest, res: Response) => {
  const states = await query('SELECT * FROM kill_switch_state ORDER BY scope');
  res.json({ success: true, states });
});

router.post('/risk/kill-switch', authenticateToken, checkPermission('KILL_SWITCH_TRIGGER'), async (req: AuthenticatedRequest, res: Response) => {
  const { scope, action, reason } = req.body;
  if (!scope || !action || !reason) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'scope, action, and reason are required' } });
    return;
  }

  const isActive = action === 'ACTIVATE';
  await execute(
    'UPDATE kill_switch_state SET is_active = $1, activated_by = $2, activated_at = NOW(), reason = $3 WHERE scope = $4',
    [isActive, req.user!.userId, reason, scope]
  );

  const logId = 'ksl_' + generateUUID();
  await execute(
    'INSERT INTO kill_switch_log (id, actor_id, actor_role, scope, action, reason) VALUES ($1, $2, $3, $4, $5, $6)',
    [logId, req.user!.userId, req.user!.role, scope, action, reason]
  );
  await logAuditAction(req.user!.userId, req.user!.role, `KILL_SWITCH_${action}`, 'KILL_SWITCH', scope, null, { action, reason }, getClientIp(req));

  res.json({ success: true, message: `Kill switch ${action.toLowerCase()}d for ${scope}` });
});

// ============================================================
// 7. BROKER HEALTH
// ============================================================
router.get('/broker/health', authenticateToken, checkPermission('ADMIN_BROAD_VIEW'), async (req: AuthenticatedRequest, res: Response) => {
  const mdEngine = MarketDataEngine.getInstance();
  const provider = mdEngine.getActiveProviderName();
  const tickCount = mdEngine.getAllCachedTicks().length;
  const dbHealth = await checkDatabaseHealth();

  res.json({
    success: true,
    broker: {
      provider,
      apiStatus: provider !== 'MOCK' ? 'CONNECTED' : 'DISCONNECTED',
      wsStatus: 'CONNECTED',
      orderApiStatus: 'HEALTHY',
      marketDataStatus: tickCount > 0 ? 'LIVE' : 'WAITING',
      latencyMs: dbHealth.latencyMs,
      activeSubscriptions: tickCount,
      lastTickAt: new Date().toISOString()
    }
  });
});

// ============================================================
// 8. MARKET DATA STATUS
// ============================================================
router.get('/market/status', authenticateToken, checkPermission('ADMIN_BROAD_VIEW'), async (req: AuthenticatedRequest, res: Response) => {
  const mdEngine = MarketDataEngine.getInstance();
  const ticks = mdEngine.getAllCachedTicks();
  const staleThreshold = Date.now() - 60000;
  let staleCount = 0;
  ticks.forEach((t: any) => { if (t.timestamp && t.timestamp < staleThreshold) staleCount++; });

  res.json({
    success: true,
    marketData: {
      feedStatus: ticks.length > 0 ? 'ACTIVE' : 'IDLE',
      provider: mdEngine.getActiveProviderName(),
      activeSubscriptions: ticks.length,
      staleDataCount: staleCount,
      tickRate: `${ticks.length} instruments`,
      wsConnections: 0 // Placeholder — would need WS server reference
    }
  });
});

// ============================================================
// 9. FUNDS OVERVIEW
// ============================================================
router.get('/funds/overview', authenticateToken, checkPermission('FUNDS_OVERVIEW_VIEW'), async (req: AuthenticatedRequest, res: Response) => {
  const [totalFunds, usedMargin, pendingRequests, recentTransactions] = await Promise.all([
    queryOne<any>('SELECT COALESCE(SUM(cash_balance), 0) as total, COALESCE(SUM(used_margin), 0) as margin FROM virtual_wallets'),
    queryOne<any>('SELECT COALESCE(SUM(used_margin), 0) as s FROM virtual_wallets WHERE used_margin > 0'),
    queryOne<any>("SELECT COUNT(*) as c, COALESCE(SUM(amount), 0) as s FROM fund_requests WHERE status = 'PENDING'"),
    query('SELECT wl.*, u.username FROM wallet_ledger wl JOIN users u ON wl.user_id = u.id ORDER BY wl.created_at DESC LIMIT 50')
  ]);

  res.json({
    success: true,
    funds: {
      totalFunds: parseFloat(totalFunds?.total || '0'),
      available: parseFloat(totalFunds?.total || '0') - parseFloat(totalFunds?.margin || '0'),
      blocked: parseFloat(totalFunds?.margin || '0'),
      pendingWithdrawals: parseInt(pendingRequests?.c || '0'),
      pendingWithdrawalAmount: parseFloat(pendingRequests?.s || '0'),
      recentTransactions
    }
  });
});

// ============================================================
// 9B. ADMIN FUND REQUEST APPROVAL / REJECTION API
// ============================================================
router.get('/funds/requests', authenticateToken, checkPermission('FUNDS_OVERVIEW_VIEW'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const statusFilter = req.query.status as string || '';
    let whereClause = '';
    const params: any[] = [];

    if (statusFilter) {
      whereClause = 'WHERE fr.status = $1';
      params.push(statusFilter);
    }

    const requests = await query<any>(
      `SELECT fr.*, u.username, u.email
       FROM fund_requests fr
       JOIN users u ON fr.user_id = u.id
       ${whereClause}
       ORDER BY fr.created_at DESC LIMIT 100`,
      params
    );

    res.json({ success: true, requests });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/funds/requests/:id/approve', authenticateToken, checkPermission('WITHDRAWALS_APPROVE'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const reqId = id as string;
    const actorId = req.user!.userId;
    const actorRole = req.user!.role;
    const customApprovedAmount = req.body?.approvedAmount !== undefined && req.body?.approvedAmount !== null ? parseFloat(req.body.approvedAmount) : null;
    const adminNote = req.body?.adminNote ? String(req.body.adminNote).trim() : '';

    const result = await withTransaction(async (client) => {
      // 1. Lock fund request row FOR UPDATE
      const reqRes = await client.query(
        'SELECT * FROM fund_requests WHERE id = $1 OR request_id = $1 FOR UPDATE',
        [reqId]
      );
      if (reqRes.rows.length === 0) {
        throw new Error('NOT_FOUND:Fund request not found');
      }

      const request = reqRes.rows[0];
      if (request.status !== 'PENDING') {
        throw new Error(`INVALID_STATUS:Request is already ${request.status}`);
      }

      const originalRequestedAmount = parseFloat(request.amount);
      const isPartial = customApprovedAmount !== null && customApprovedAmount > 0 && customApprovedAmount < originalRequestedAmount;
      const amount = isPartial ? customApprovedAmount : originalRequestedAmount;

      if (amount <= 0) {
        throw new Error('INVALID_AMOUNT:Approved amount must be greater than zero');
      }
      if (amount > originalRequestedAmount) {
        throw new Error(`INVALID_AMOUNT:Approved amount (₹${amount}) cannot exceed requested amount (₹${originalRequestedAmount})`);
      }

      const userId = request.user_id;

      if (request.request_type === 'DEPOSIT') {
        // Enforce duplicate reference note prevention on deposits
        if (request.reference_note && request.reference_note.trim().length > 0) {
          const dupRes = await client.query(
            `SELECT id, request_id FROM fund_requests 
             WHERE payment_method = $1 AND reference_note = $2 AND status IN ('APPROVED', 'PARTIALLY_APPROVED') AND id != $3 LIMIT 1`,
            [request.payment_method || 'UPI', request.reference_note.trim(), request.id]
          );
          if (dupRes.rows.length > 0) {
            throw new Error(`DUPLICATE_REFERENCE:Deposit reference '${request.reference_note}' was already approved under request ${dupRes.rows[0].request_id}`);
          }
        }

        // Lock user's wallet
        const wRes = await client.query(
          'SELECT cash_balance FROM virtual_wallets WHERE user_id = $1 FOR UPDATE',
          [userId]
        );
        if (wRes.rows.length === 0) throw new Error('NOT_FOUND:User wallet not found');
        const currentCash = parseFloat(wRes.rows[0].cash_balance);
        const newCash = currentCash + amount;

        // Credit wallet
        await client.query(
          'UPDATE virtual_wallets SET cash_balance = $1, updated_at = NOW() WHERE user_id = $2',
          [newCash, userId]
        );

        // Record immutable ledger entry
        await client.query(
          `INSERT INTO wallet_ledger (id, transaction_id, user_id, transaction_type, amount, balance_before, balance_after, reference_id, created_by, metadata)
           VALUES ($1, $2, $3, 'DEPOSIT', $4, $5, $6, $7, $8, $9)`,
          [
            'led_' + generateUUID(), generateUUID(), userId,
            amount, currentCash, newCash,
            request.request_id, actorId,
            JSON.stringify({ 
              reason: isPartial ? `Partially Approved Deposit ${request.request_id} (₹${amount} of ₹${originalRequestedAmount})` : `Approved Deposit ${request.request_id}`, 
              paymentMethod: request.payment_method, 
              referenceNote: request.reference_note,
              adminNote: adminNote || undefined,
              approvedBy: actorId
            })
          ]
        );
      } else if (request.request_type === 'WITHDRAWAL') {
        // RBAC Multi-level approval check based on matrix limits
        let canApprove = false;
        
        if (actorRole === 'SUPER_ADMIN') {
          canApprove = true; // Unlimited
        } else if (actorRole === 'ADMIN' || actorRole === 'FINANCE_MANAGER') {
          if (amount <= 100000) canApprove = true;
        }

        if (!canApprove) {
          // Escalate to TIER_2_SENIOR if they cannot approve it directly (e.g., MANAGER always escalates, ADMIN/FINANCE_MANAGER escalates > 100k)
          await client.query(
            `UPDATE fund_requests 
             SET review_tier = 'TIER_2_SENIOR', first_approved_by = $1, first_approved_at = NOW(), updated_at = NOW() 
             WHERE id = $2`,
            [actorId, request.id]
          );
          return { escalated: true, message: `Withdrawal request of ₹${amount.toLocaleString('en-IN')} escalated for Senior approval due to limits.` };
        }

        // Check withdrawable balance (Cash - Used Margin + min(0, Unrealized P&L))
        const wRes = await client.query(
          'SELECT cash_balance, used_margin FROM virtual_wallets WHERE user_id = $1 FOR UPDATE',
          [userId]
        );
        if (wRes.rows.length === 0) throw new Error('NOT_FOUND:User wallet not found');
        const currentCash = parseFloat(wRes.rows[0].cash_balance);
        const usedMargin = parseFloat(wRes.rows[0].used_margin);
        const buyingPower = Math.max(0, currentCash - usedMargin);

        if (buyingPower < amount) {
          throw new Error(`INSUFFICIENT_FUNDS:Insufficient buying power. Required: ₹${amount.toFixed(2)}, Available: ₹${buyingPower.toFixed(2)}`);
        }

        const newCash = currentCash - amount;
        if (newCash < 0) {
          throw new Error('NEGATIVE_BALANCE:Withdrawal would produce negative balance');
        }

        // Debit wallet
        await client.query(
          'UPDATE virtual_wallets SET cash_balance = $1, updated_at = NOW() WHERE user_id = $2',
          [newCash, userId]
        );

        // Record immutable ledger entry
        await client.query(
          `INSERT INTO wallet_ledger (id, transaction_id, user_id, transaction_type, amount, balance_before, balance_after, reference_id, created_by, metadata)
           VALUES ($1, $2, $3, 'WITHDRAWAL', $4, $5, $6, $7, $8, $9)`,
          [
            'led_' + generateUUID(), generateUUID(), userId,
            amount, currentCash, newCash,
            request.request_id, actorId,
            JSON.stringify({ 
              reason: isPartial ? `Partially Approved Withdrawal ${request.request_id} (₹${amount} of ₹${originalRequestedAmount})` : `Approved Withdrawal Payout ${request.request_id}`, 
              paymentMethod: request.payment_method, 
              referenceNote: request.reference_note,
              adminNote: adminNote || undefined,
              approvedBy: actorId 
            })
          ]
        );
      }

      const finalStatus = isPartial ? 'PARTIALLY_APPROVED' : 'APPROVED';
      const updatedNote = isPartial 
        ? `${request.reference_note ? request.reference_note + ' | ' : ''}Partially approved ₹${amount.toLocaleString('en-IN')} of ₹${originalRequestedAmount.toLocaleString('en-IN')}${adminNote ? ` (${adminNote})` : ''}`
        : (adminNote ? `${request.reference_note ? request.reference_note + ' | ' : ''}${adminNote}` : request.reference_note);

      // Update fund request status & amount
      await client.query(
        `UPDATE fund_requests SET status = $1, amount = $2, reference_note = $3, approved_by = $4, approved_at = NOW(), updated_at = NOW() WHERE id = $5`,
        [finalStatus, amount, updatedNote, actorId, request.id]
      );

      return { 
        escalated: false, 
        isPartial,
        approvedAmount: amount,
        message: isPartial 
          ? `Fund request ${request.request_id} PARTIALLY APPROVED for ₹${amount.toLocaleString('en-IN')} (Requested: ₹${originalRequestedAmount.toLocaleString('en-IN')}).`
          : `Fund request ${request.request_id} APPROVED for ₹${amount.toLocaleString('en-IN')} and wallet updated.`
      };
    });

    await logAuditAction(
      actorId, actorRole,
      'APPROVE_FUND_REQUEST', 'FUND_REQUEST', reqId,
      null, { reqId, customApprovedAmount, adminNote }, getClientIp(req)
    );

    if (!result.escalated) {
      const freshReq = await queryOne<any>('SELECT * FROM fund_requests WHERE id = $1 OR request_id = $1', [reqId]);
      if (freshReq) {
        emitAdminFundRequestEvent(freshReq.user_id, 'FUND_REQUEST_UPDATED', freshReq);
        const freshWallet = await queryOne<any>('SELECT * FROM virtual_wallets WHERE user_id = $1', [freshReq.user_id]);
        if (freshWallet) {
          emitAdminFundsUpdate(freshReq.user_id, freshWallet);
          setImmediate(async () => {
            try {
              const u = await queryOne<{ id: string; email: string; full_name?: string }>('SELECT id, email, full_name FROM users WHERE id = $1', [freshReq.user_id]);
              if (u && u.email) {
                const { EmailService } = await import('../services/EmailService');
                await EmailService.getInstance().sendFundCreditEmail(u, {
                  amount: Number(freshReq.amount),
                  balance: Number(freshWallet.balance),
                  referenceId: freshReq.request_id || freshReq.reference_note || reqId,
                });
              }
            } catch (_) {}
          });
        }
      }
    } else {
      const escalatedReq = await queryOne<any>('SELECT * FROM fund_requests WHERE id = $1 OR request_id = $1', [reqId]);
      if (escalatedReq) {
        await createAdminNotification('FUND_REQUEST_UPDATED', escalatedReq.user_id, {
          severity: 'HIGH', requestId: escalatedReq.request_id, reviewTier: 'TIER_2_SENIOR',
          amount: escalatedReq.amount, firstApprovedBy: actorId,
        });
      }
    }

    res.json({ success: true, ...result });
  } catch (err: any) {
    const colonIdx = err.message ? err.message.indexOf(':') : -1;
    const code = colonIdx !== -1 ? err.message.slice(0, colonIdx) : 'SERVER_ERROR';
    const msg = colonIdx !== -1 ? err.message.slice(colonIdx + 1) : (err.message || 'Server error occurred');
    res.status(code === 'NOT_FOUND' ? 404 : 400).json({ success: false, error: { code, message: msg } });
  }
});

router.post('/funds/requests/:id/reject', authenticateToken, checkPermission('WITHDRAWALS_APPROVE'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const reqId = id as string;
    const { reason } = req.body;

    const request = await queryOne<any>('SELECT * FROM fund_requests WHERE id = $1 OR request_id = $1', [reqId]);
    if (!request) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Fund request not found' } });
      return;
    }

    // Status is re-checked as part of the UPDATE's WHERE clause below (not just here) so a
    // concurrent /approve on the same request can't be silently overwritten back to REJECTED
    // after money has already moved — see A4/B1 audit notes in .design/admin-panel-upgrade/.
    const updated = await queryOne<any>(
      `UPDATE fund_requests SET status = 'REJECTED', rejection_reason = $1, approved_by = $2, approved_at = NOW(), updated_at = NOW()
       WHERE id = $3 AND status = 'PENDING'
       RETURNING id, request_id`,
      [reason || 'Rejected by Admin', req.user!.userId, request.id]
    );

    if (!updated) {
      res.status(409).json({ success: false, error: { code: 'INVALID_STATUS', message: `Request is no longer PENDING (already processed).` } });
      return;
    }

    // B2 fix: /approve logs an audit action for every transition; this route never did, leaving
    // fund-request rejections with no audit trail entry at all despite being a real state change.
    await logAuditAction(req.user!.userId, req.user!.role, 'REJECT_FUND_REQUEST', 'FUND_REQUEST', updated.id, null, { reqId, reason }, getClientIp(req));

    emitAdminFundRequestEvent(request.user_id, 'FUND_REQUEST_UPDATED', { ...request, status: 'REJECTED', rejection_reason: reason });

    res.json({ success: true, message: `Fund request ${updated.request_id} REJECTED.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// Admin-Only Payment Credentials Configuration (Merchant UPI, QR & Bank Account)
router.get('/funds/payment-settings', authenticateToken, checkPermission('PAYMENT_GATEWAYS_MANAGE'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const keys = [
      'LINKPE_UPI_ID', 'LINKPE_MERCHANT_NAME', 'MERCHANT_QR_IMAGE',
      'MERCHANT_QUICK_PAY_LINKS', 'MERCHANT_BANK_NAME', 'MERCHANT_ACCOUNT_NAME',
      'MERCHANT_ACCOUNT_NUMBER', 'MERCHANT_IFSC', 'MERCHANT_BRANCH'
    ];
    const settingsRows = await query<any>(
      `SELECT key, value FROM system_settings WHERE key = ANY($1)`,
      [keys]
    );

    const settingsMap: Record<string, string> = {};
    settingsRows.forEach(r => { settingsMap[r.key] = r.value; });

    let quickPayLinks = [
      { amount: 1000, url: 'https://onetapay.com/pp/MjkzNw==' },
      { amount: 5000, url: 'https://onetapay.com/pp/MjkzNQ==' },
      { amount: 10000, url: 'https://onetapay.com/pp/MjkzNg==' }
    ];

    if (settingsMap['MERCHANT_QUICK_PAY_LINKS']) {
      try {
        const parsed = JSON.parse(settingsMap['MERCHANT_QUICK_PAY_LINKS']);
        if (Array.isArray(parsed) && parsed.length > 0) {
          quickPayLinks = parsed;
        }
      } catch (_) {}
    }

    res.json({
      success: true,
      settings: {
        upiId: settingsMap['LINKPE_UPI_ID'] || process.env.LINKPE_UPI_ID || 'expertstokks@axl',
        merchantName: settingsMap['LINKPE_MERCHANT_NAME'] || process.env.LINKPE_MERCHANT_NAME || 'Trade Grow Brokerage',
        qrImageUrl: settingsMap['MERCHANT_QR_IMAGE'] || '/upi-qr.png',
        quickPayLinks,
        bankName: settingsMap['MERCHANT_BANK_NAME'] || 'HDFC Bank',
        accountName: settingsMap['MERCHANT_ACCOUNT_NAME'] || 'Trade Grow Technologies Pvt Ltd',
        accountNumber: settingsMap['MERCHANT_ACCOUNT_NUMBER'] || '50200098765432',
        ifscCode: settingsMap['MERCHANT_IFSC'] || 'HDFC0001234',
        branch: settingsMap['MERCHANT_BRANCH'] || 'Mumbai Main Branch'
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/funds/payment-settings', authenticateToken, checkPermission('PAYMENT_GATEWAYS_UPDATE'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { upiId, merchantName, bankName, accountName, accountNumber, ifscCode, branch, qrImageUrl, quickPayLinks } = req.body;

    if (!upiId || !merchantName) {
      res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'UPI ID and Merchant Name are required' } });
      return;
    }

    const upsertSetting = async (key: string, val: string) => {
      await execute(
        `INSERT INTO system_settings (key, value, description, updated_at)
         VALUES ($1, $2, 'Merchant Payment Receiving Setting', NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, val]
      );
    };

    const updatePromises: Promise<any>[] = [
      upsertSetting('LINKPE_UPI_ID', upiId.trim()),
      upsertSetting('LINKPE_MERCHANT_NAME', merchantName.trim()),
    ];

    if (qrImageUrl !== undefined) {
      updatePromises.push(upsertSetting('MERCHANT_QR_IMAGE', String(qrImageUrl).trim()));
    }
    if (quickPayLinks !== undefined) {
      const quickPayJson = typeof quickPayLinks === 'string' ? quickPayLinks : JSON.stringify(quickPayLinks);
      updatePromises.push(upsertSetting('MERCHANT_QUICK_PAY_LINKS', quickPayJson));
    }
    if (bankName !== undefined) updatePromises.push(upsertSetting('MERCHANT_BANK_NAME', String(bankName).trim()));
    if (accountName !== undefined) updatePromises.push(upsertSetting('MERCHANT_ACCOUNT_NAME', String(accountName).trim()));
    if (accountNumber !== undefined) updatePromises.push(upsertSetting('MERCHANT_ACCOUNT_NUMBER', String(accountNumber).trim()));
    if (ifscCode !== undefined) updatePromises.push(upsertSetting('MERCHANT_IFSC', String(ifscCode).trim().toUpperCase()));
    if (branch !== undefined) updatePromises.push(upsertSetting('MERCHANT_BRANCH', String(branch).trim()));

    await Promise.all(updatePromises);

    await logAuditAction(
      req.user!.userId,
      req.user!.role,
      'UPDATE_PAYMENT_SETTINGS',
      'SYSTEM_SETTINGS',
      'LINKPE_UPI_ID',
      null,
      { upiId, merchantName, bankName, accountNumber, hasCustomQr: !!qrImageUrl, quickPayCount: Array.isArray(quickPayLinks) ? quickPayLinks.length : undefined },
      getClientIp(req)
    );

    res.json({ success: true, message: 'Merchant payment receiving credentials (UPI, QR & Bank) updated successfully!' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// 10. LEDGER VIEWER
// ============================================================
router.get('/ledger', authenticateToken, checkPermission('LEDGER_VIEW'), async (req: AuthenticatedRequest, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string || '100', 10), 500);
  const offset = parseInt(req.query.offset as string || '0', 10);
  const customerId = req.query.customerId as string || '';
  const txnType = req.query.type as string || '';

  let where = 'WHERE 1=1';
  const params: any[] = [];
  let paramIdx = 1;

  if (customerId) { where += ` AND wl.user_id = $${paramIdx}`; params.push(customerId); paramIdx++; }
  if (txnType) { where += ` AND wl.transaction_type = $${paramIdx}`; params.push(txnType); paramIdx++; }

  const entries = await query(
    `SELECT wl.*, u.username FROM wallet_ledger wl
     JOIN users u ON wl.user_id = u.id
     ${where}
     ORDER BY wl.created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset]
  );
  const countRow = await queryOne<any>(`SELECT COUNT(*) as c FROM wallet_ledger wl ${where}`, params);

  res.json({ success: true, entries, total: parseInt(countRow?.c || '0'), pagination: { limit, offset } });
});

// ============================================================
// 11. SYSTEM HEALTH MONITOR
// ============================================================
router.get('/system/health', authenticateToken, checkPermission('ADMIN_BROAD_VIEW'), async (req: AuthenticatedRequest, res: Response) => {
  const dbHealth = await checkDatabaseHealth();
  const mdEngine = MarketDataEngine.getInstance();

  res.json({
    success: true,
    systems: [
      { name: 'API Gateway', status: 'OPERATIONAL', latencyMs: 1 },
      { name: 'OMS', status: 'OPERATIONAL', latencyMs: 2 },
      { name: 'RMS', status: 'OPERATIONAL', latencyMs: 1 },
      { name: 'Market Data', status: mdEngine.getAllCachedTicks().length > 0 ? 'OPERATIONAL' : 'IDLE', latencyMs: 0 },
      { name: 'WebSocket Gateway', status: 'OPERATIONAL', latencyMs: 0 },
      { name: 'PostgreSQL Database', status: dbHealth.healthy ? 'OPERATIONAL' : 'DEGRADED', latencyMs: dbHealth.latencyMs },
      { name: 'Redis Cache', status: redis.isAvailable() ? 'OPERATIONAL' : 'DEGRADED', latencyMs: 0 },
      { name: 'Broker Gateway', status: mdEngine.getActiveProviderName() !== 'MOCK' ? 'CONNECTED' : 'DISCONNECTED', latencyMs: 0 }
    ]
  });
});

// ============================================================
// 12. MARKET DATA PROVIDER & API KEYS MANAGEMENT
// ============================================================
router.get('/market-data/config', authenticateToken, checkPermission('MARKET_DATA_CONFIG'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const configs = await MarketDataStorageService.getAllSystemConfigs();
    const engine = MarketDataEngine.getInstance();
    const activeProvider = engine.getActiveProviderName();

    res.json({
      success: true,
      activeProvider,
      availableProviders: ['DHAN', 'FYERS', 'ANGELONE', 'MOCK_ENGINE'],
      keys: {
        DHAN_CLIENT_ID: configs.DHAN_CLIENT_ID || process.env.DHAN_CLIENT_ID || '1113019677',
        DHAN_ACCESS_TOKEN: configs.DHAN_ACCESS_TOKEN || process.env.DHAN_ACCESS_TOKEN || '',
        DHAN_API_KEY: configs.DHAN_API_KEY || process.env.DHAN_API_KEY || '21483ef7',
        DHAN_API_SECRET: configs.DHAN_API_SECRET || process.env.DHAN_API_SECRET || 'e9730aa4-682c-4e75-a944-94f703449b09',
        FYERS_APP_ID: configs.FYERS_APP_ID || process.env.FYERS_APP_ID || '',
        FYERS_SECRET_KEY: configs.FYERS_SECRET_KEY || process.env.FYERS_SECRET_KEY || '',
        FYERS_ACCESS_TOKEN: configs.FYERS_ACCESS_TOKEN || process.env.FYERS_ACCESS_TOKEN || '',
        FYERS_REDIRECT_URI: configs.FYERS_REDIRECT_URI || process.env.FYERS_REDIRECT_URI || 'http://localhost:5000/api/v1/auth/fyers/callback',
        ANGELONE_API_KEY: configs.ANGELONE_API_KEY || process.env.ANGELONE_API_KEY || '',
        ANGELONE_CLIENT_ID: configs.ANGELONE_CLIENT_ID || process.env.ANGELONE_CLIENT_ID || '',
        ANGELONE_CLIENT_SECRET: configs.ANGELONE_CLIENT_SECRET || process.env.ANGELONE_CLIENT_SECRET || '',
        ANGELONE_TOTP_SECRET: configs.ANGELONE_TOTP_SECRET || process.env.ANGELONE_TOTP_SECRET || ''
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/market-data/config', authenticateToken, checkPermission('MARKET_DATA_CONFIG'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { primaryProvider, keys } = req.body;

    if (keys && typeof keys === 'object') {
      for (const [k, v] of Object.entries(keys)) {
        if (typeof v === 'string') {
          await MarketDataStorageService.setSystemConfig(k, v);
        }
      }
      MarketDataEngine.getInstance().updateProviderCredentials(keys);
    }

    if (primaryProvider && typeof primaryProvider === 'string') {
      await MarketDataStorageService.setSystemConfig('PRIMARY_MARKET_DATA_PROVIDER', primaryProvider);
      await MarketDataEngine.getInstance().switchPrimaryProvider(primaryProvider);
    }

    await logAuditAction(req.user!.userId, req.user!.role, 'UPDATE_MARKET_DATA_CONFIG', 'SYSTEM', 'MARKET_DATA', null, { primaryProvider, keysUpdated: Object.keys(keys || {}) }, getClientIp(req));

    res.json({
      success: true,
      message: `Market Data Provider set to ${MarketDataEngine.getInstance().getActiveProviderName()} and API keys updated successfully.`,
      activeProvider: MarketDataEngine.getInstance().getActiveProviderName()
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'CONFIG_ERROR', message: err.message } });
  }
});

// ============================================================
// 13. LOCAL MARKET DATA DOWNLOADER & STORAGE API
// ============================================================
router.post('/market-data/download', authenticateToken, checkPermission('ADMIN_BROAD_VIEW'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tokens, timeframe = '1D', count = 100 } = req.body;
    const targetTokens = Array.isArray(tokens) && tokens.length > 0
      ? tokens
      : ['NSE_NIFTY50', 'NSE_BANKNIFTY', 'NSE_RELIANCE', 'NSE_TCS', 'NSE_INFY', 'NSE_HDFCBANK', 'NSE_ICICIBANK', 'NSE_TATAMOTORS'];

    const result = await MarketDataStorageService.downloadAndStoreData(targetTokens, timeframe, count);

    await logAuditAction(req.user!.userId, req.user!.role, 'DOWNLOAD_MARKET_DATA', 'SYSTEM', 'LOCAL_STORAGE', null, { tokens: targetTokens, timeframe, count, stored: result.totalStored }, getClientIp(req));

    res.json({
      success: true,
      result
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'DOWNLOAD_ERROR', message: err.message } });
  }
});

router.get('/market-data/local-stats', authenticateToken, checkPermission('ADMIN_BROAD_VIEW'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stats = await MarketDataStorageService.getLocalStorageStats();
    res.json({ success: true, stats });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// 14. ADMIN KYC MANAGEMENT & DOCUMENT VERIFICATION
// ============================================================
router.get('/kyc/applications', authenticateToken, checkPermission('ADMIN_BROAD_VIEW'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    // C1 fix: this had no LIMIT at all — every KYC application platform-wide, unbounded — plus
    // an N+1 query firing one extra round trip per application to fetch its documents. Added
    // pagination + an optional status filter, and batched the documents lookup into one query.
    const limit = Math.min(parseInt(req.query.limit as string || '100', 10), 500);
    const offset = parseInt(req.query.offset as string || '0', 10);
    const status = req.query.status as string || '';

    let where = '';
    const params: any[] = [];
    if (status) {
      where = 'WHERE ka.status = $1';
      params.push(status);
    }

    const countRow = await queryOne<any>(`SELECT COUNT(*) as c FROM kyc_applications ka ${where}`, params);
    const apps = await query<any>(
      `SELECT ka.*, u.username, u.email, u.role
       FROM kyc_applications ka
       JOIN users u ON ka.user_id = u.id
       ${where}
       ORDER BY ka.submitted_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const appIds = apps.map((a: any) => a.id);
    const documentsByApp: Record<string, any[]> = {};
    if (appIds.length > 0) {
      const allDocs = await query<any>(
        'SELECT id, kyc_application_id, document_type, original_filename, mime_type, file_size, uploaded_at FROM kyc_documents WHERE kyc_application_id = ANY($1)',
        [appIds]
      );
      for (const doc of allDocs) {
        (documentsByApp[doc.kyc_application_id] ||= []).push(doc);
      }
    }

    const appsWithDocs = apps.map((a: any) => ({ ...a, documents: documentsByApp[a.id] || [] }));

    res.json({ success: true, applications: appsWithDocs, total: parseInt(countRow?.c || '0'), pagination: { limit, offset } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/kyc/documents/:id/download', authenticateToken, checkPermission('ADMIN_BROAD_VIEW'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const doc = await queryOne<any>('SELECT * FROM kyc_documents WHERE id = $1', [req.params.id]);
    if (!doc) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Document record not found' } });
      return;
    }

    const fs = require('fs');
    if (!fs.existsSync(doc.file_path)) {
      res.status(404).json({ success: false, error: { code: 'FILE_NOT_FOUND', message: 'Physical file not found on server' } });
      return;
    }

    await logAuditAction(req.user!.userId, req.user!.role, 'DOWNLOAD_KYC_DOCUMENT', 'KYC_DOCUMENT', doc.id, null, { filename: doc.original_filename }, getClientIp(req));

    res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${doc.original_filename}"`);
    fs.createReadStream(doc.file_path).pipe(res);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/kyc/review', authenticateToken, checkPermission('KYC_REJECT'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { applicationId, action, rejectionReason, rejectionCategory } = req.body;

    if (!applicationId || !action || !['APPROVE', 'REJECT', 'REQUEST_RESUBMISSION'].includes(action)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Application ID and valid action (APPROVE/REJECT/REQUEST_RESUBMISSION) are required' } });
      return;
    }

    const newStatus = action === 'APPROVE' ? 'APPROVED' : action === 'REJECT' ? 'REJECTED' : 'RESUBMISSION_REQUIRED';

    await execute(
      `UPDATE kyc_applications
       SET status = $1, rejection_reason = $2, rejection_category = $3, reviewed_at = NOW(), reviewed_by = $4, updated_at = NOW()
       WHERE id = $5`,
      [newStatus, rejectionReason || null, rejectionCategory || null, req.user!.userId, applicationId]
    );

    await logAuditAction(req.user!.userId, req.user!.role, `KYC_${action}`, 'KYC_APPLICATION', applicationId, null, { action, rejectionReason, rejectionCategory }, getClientIp(req));

    res.json({ success: true, message: `KYC Application ${applicationId} has been ${newStatus}.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// 15. ADMIN DIRECT FUND ADJUSTMENT (CREDIT / DEBIT)
// ============================================================
router.post('/funds/direct-adjust', authenticateToken, checkPermission('DIRECT_BALANCE_ADJUST'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, requestType, amount, reason } = req.body;
    const reqAmount = parseFloat(amount);

    if (!userId || !requestType || !['CREDIT', 'DEBIT'].includes(requestType) || isNaN(reqAmount) || reqAmount <= 0) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Valid userId, requestType (CREDIT/DEBIT), and positive amount required' } });
      return;
    }

    const adjustAmount = requestType === 'CREDIT' ? reqAmount : -reqAmount;
    const id = 'freq_' + generateUUID();
    const requestId = 'ADM' + generateUUID().slice(0, 8).toUpperCase();

    // B1 fix: the balance mutation and this audit-trail row used to be two separate,
    // independently-committing operations — if the fund_requests INSERT ever threw after
    // adminAdjustBalance had already committed, a real balance change would be left with no
    // matching request record. Passing adminAdjustBalance our own client makes both commit or
    // roll back together.
    await withTransaction(async (client: any) => {
      await VirtualWalletLedger.adminAdjustBalance(
        userId,
        adjustAmount,
        req.user!.userId,
        reason || `Direct Admin ${requestType}`,
        client
      );

      await client.query(
        `INSERT INTO fund_requests (id, request_id, user_id, request_type, amount, status, payment_method, reference_note, approved_by, approved_at)
         VALUES ($1, $2, $3, $4, $5, 'APPROVED', 'ADMIN_DIRECT', $6, $7, NOW())`,
        [id, requestId, userId, requestType === 'CREDIT' ? 'DEPOSIT' : 'WITHDRAWAL', reqAmount, reason || 'Direct Admin Adjustment', req.user!.userId]
      );
    });

    const updatedWallet = await VirtualWalletLedger.getWallet(userId);

    await logAuditAction(req.user!.userId, req.user!.role, `ADMIN_DIRECT_FUNDS_${requestType}`, 'WALLET', userId, null, { amount: reqAmount, reason }, getClientIp(req));

    res.json({
      success: true,
      message: `Successfully ${requestType === 'CREDIT' ? 'credited' : 'debited'} ₹${reqAmount.toLocaleString('en-IN')} for user.`,
      wallet: updatedWallet
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// 16. ADMIN ORDER MONITOR & ORDER MANAGEMENT SYSTEM
// ============================================================
router.post('/orders/:orderId/price', authenticateToken, checkPermission('ORDERS_MANAGE_ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { orderId } = req.params;
    const { price } = req.body;
    const newPrice = parseFloat(price);

    if (isNaN(newPrice) || newPrice <= 0) {
      res.status(400).json({ success: false, error: { code: 'INVALID_PRICE', message: 'Price must be greater than 0' } });
      return;
    }

    const order = await queryOne<any>('SELECT * FROM orders WHERE id = $1 OR order_id = $1', [orderId]);
    if (!order) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
      return;
    }

    if (!['ACCEPTED', 'PENDING'].includes(order.status)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: `Cannot edit price for order in status ${order.status}` } });
      return;
    }

    await execute('UPDATE orders SET price = $1, updated_at = NOW() WHERE id = $2', [newPrice, order.id]);
    await execute(
      `INSERT INTO order_events (id, order_id, from_status, to_status, reason, actor)
       VALUES ($1, $2, $3, $3, $4, 'ADMIN')`,
      ['evt_' + generateUUID(), order.id, order.status, `Admin modified price from ₹${order.price} to ₹${newPrice}`]
    );

    await logAuditAction(req.user!.userId, req.user!.role, 'ADMIN_MODIFY_ORDER_PRICE', 'ORDER', order.id, null, { oldPrice: order.price, newPrice }, getClientIp(req));

    res.json({ success: true, message: `Order ${order.order_id} limit price updated to ₹${newPrice}.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/orders/:orderId/cancel', authenticateToken, checkPermission('ORDERS_MANAGE_ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    const order = await queryOne<any>('SELECT * FROM orders WHERE id = $1 OR order_id = $1', [orderId]);
    if (!order) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
      return;
    }

    if (!['ACCEPTED', 'PENDING', 'OPEN', 'TRIGGER_PENDING'].includes(order.status)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: `Order is already ${order.status}` } });
      return;
    }

    // B1 fix: the UPDATE itself is now the guard (WHERE status IN (...)), not just the earlier
    // unlocked read above — otherwise a concurrent fill (ExecutionEngine's 500ms loop) could
    // commit status='FILLED' between this route's read and its UPDATE, and this would then
    // blindly overwrite a real fill back to 'CANCELLED', silently hiding that money and a
    // position actually moved. If no row matches, someone else already transitioned this order.
    let cancelled = false;
    await withTransaction(async (client: any) => {
      const upd = await client.query(
        `UPDATE orders SET status = 'CANCELLED', updated_at = NOW()
         WHERE id = $1 AND status IN ('ACCEPTED', 'PENDING', 'OPEN', 'TRIGGER_PENDING')
         RETURNING id`,
        [order.id]
      );
      if (upd.rows.length === 0) return;
      cancelled = true;
      // Cancelled order drops out of the pending-order margin sum on its own — no separate release calc needed.
      await VirtualWalletLedger.recomputeUsedMarginForUser(order.user_id, client);
    });
    if (!cancelled) {
      res.status(409).json({ success: false, error: { code: 'INVALID_STATUS', message: 'Order was already processed (filled/cancelled/rejected) by another request.' } });
      return;
    }
    await execute(
      `INSERT INTO order_events (id, order_id, from_status, to_status, reason, actor)
       VALUES ($1, $2, $3, 'CANCELLED', $4, 'ADMIN')`,
      ['evt_' + generateUUID(), order.id, order.status, reason || 'Cancelled by Admin']
    );

    await logAuditAction(req.user!.userId, req.user!.role, 'ADMIN_CANCEL_ORDER', 'ORDER', order.id, null, { reason }, getClientIp(req));

    emitAdminOrderEvent(order.user_id, 'ORDER_UPDATED', { ...order, status: 'CANCELLED' });

    res.json({ success: true, message: `Order ${order.order_id} cancelled by Admin.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/orders/:orderId/execute', authenticateToken, checkPermission('ORDERS_MANAGE_ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { orderId } = req.params;
    const { price } = req.body;

    const order = await queryOne<any>('SELECT * FROM orders WHERE id = $1 OR order_id = $1', [orderId]);
    if (!order) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
      return;
    }

    if (!['ACCEPTED', 'PENDING'].includes(order.status)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: `Order is already ${order.status}` } });
      return;
    }

    const fillPrice = price ? parseFloat(price) : (parseFloat(order.price || '0') || 100);
    const { ExecutionEngine } = require('../trading/ExecutionEngine');
    await ExecutionEngine.executeOrder(order, fillPrice);

    await logAuditAction(req.user!.userId, req.user!.role, 'ADMIN_FORCE_EXECUTE_ORDER', 'ORDER', order.id, null, { fillPrice }, getClientIp(req));

    res.json({ success: true, message: `Order ${order.order_id} force-executed @ ₹${fillPrice}.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/orders/:orderId/reject', authenticateToken, checkPermission('ORDERS_MANAGE_ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    const order = await queryOne<any>('SELECT * FROM orders WHERE id = $1 OR order_id = $1', [orderId]);
    if (!order) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
      return;
    }

    if (!['ACCEPTED', 'PENDING'].includes(order.status)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: `Order is already ${order.status}` } });
      return;
    }

    // B1 fix: same class of race as /cancel above — make the UPDATE itself the status guard.
    let rejected = false;
    await withTransaction(async (client: any) => {
      const upd = await client.query(
        `UPDATE orders SET status = 'REJECTED', updated_at = NOW()
         WHERE id = $1 AND status IN ('ACCEPTED', 'PENDING')
         RETURNING id`,
        [order.id]
      );
      if (upd.rows.length === 0) return;
      rejected = true;
      await VirtualWalletLedger.recomputeUsedMarginForUser(order.user_id, client);
    });
    if (!rejected) {
      res.status(409).json({ success: false, error: { code: 'INVALID_STATUS', message: 'Order was already processed (filled/cancelled/rejected) by another request.' } });
      return;
    }
    await execute(
      `INSERT INTO order_events (id, order_id, from_status, to_status, reason, actor)
       VALUES ($1, $2, $3, 'REJECTED', $4, 'ADMIN')`,
      ['evt_' + generateUUID(), order.id, order.status, reason || 'Rejected by Admin']
    );

    await logAuditAction(req.user!.userId, req.user!.role, 'ADMIN_REJECT_ORDER', 'ORDER', order.id, null, { reason }, getClientIp(req));

    emitAdminOrderEvent(order.user_id, 'ORDER_UPDATED', { ...order, status: 'REJECTED' });

    res.json({ success: true, message: `Order ${order.order_id} rejected by Admin.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/orders/create', authenticateToken, checkPermission('ORDERS_MANAGE_ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, symbol, exchange, side, orderType, quantity, price, productType } = req.body;

    if (!userId || !symbol || !side || !quantity || !price) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'userId, symbol, side, quantity, and price are required' } });
      return;
    }

    const { OMS } = require('../trading/OMS');
    const orderResult = await OMS.submitOrder({
      userId,
      symbol,
      instrumentToken: req.body.instrumentToken || symbol,
      exchange: exchange || 'NSE',
      side,
      orderType: (orderType || 'LIMIT') as any,
      productType: (productType || 'MIS') as any,
      quantity: parseInt(quantity, 10),
      price: parseFloat(price),
      triggerPrice: req.body.triggerPrice ? parseFloat(req.body.triggerPrice) : 0,
      source: 'ADMIN',
      reason: 'ADMIN_MANUAL'
    });

    if (!orderResult.success) {
      res.status(400).json({ success: false, error: { code: 'ORDER_REJECTED', message: orderResult.error || 'Failed to submit order' } });
      return;
    }

    await logAuditAction(req.user!.userId, req.user!.role, 'ADMIN_PLACE_ORDER', 'ORDER', orderResult.orderId, null, { userId, symbol, side, quantity, price }, getClientIp(req));

    res.json({ success: true, message: `Admin successfully placed order for client. Order ID: ${orderResult.orderId}`, order: orderResult });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// ADMIN POSITION MANAGEMENT & EXCLUSIVE RIGHTS
// ============================================================
router.post('/positions/:id/edit', authenticateToken, checkPermission('POSITIONS_EDIT_ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const positionId = req.params.id as string;
    const { netQty, averagePrice, buyPrice, sellPrice } = req.body;

    const pos = await queryOne<any>('SELECT * FROM positions WHERE id = $1', [positionId]);
    if (!pos) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Position not found' } });
      return;
    }

    const nQty = netQty !== undefined ? parseInt(netQty, 10) : parseInt(pos.net_qty, 10);
    const avgPx = averagePrice !== undefined ? parseFloat(averagePrice) : parseFloat(pos.average_price);
    const bPx = buyPrice !== undefined ? parseFloat(buyPrice) : parseFloat(pos.buy_price);
    const sPx = sellPrice !== undefined ? parseFloat(sellPrice) : parseFloat(pos.sell_price);

    await execute(
      `UPDATE positions
       SET net_qty = $1, average_price = $2, buy_price = $3, sell_price = $4, updated_at = NOW()
       WHERE id = $5`,
      [nQty, avgPx, bPx, sPx, positionId]
    );

    // B1 fix: every other code path that changes positions.net_qty (fills, cancels, square-off)
    // immediately recomputes used_margin from the new position set; this route didn't, so an
    // admin qty edit could leave used_margin reflecting the pre-edit quantity indefinitely,
    // overstating the user's buying power/withdrawable balance until an unrelated order event
    // happened to trigger a recompute.
    await VirtualWalletLedger.recomputeUsedMarginForUser(pos.user_id);

    await logAuditAction(req.user!.userId, req.user!.role, 'ADMIN_EDIT_POSITION', 'POSITION', positionId, null, { netQty: nQty, averagePrice: avgPx }, getClientIp(req));

    res.json({ success: true, message: `Position updated successfully. Net Qty: ${nQty}, Avg Price: ₹${avgPx}` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/positions/:id/square-off', authenticateToken, checkPermission('POSITIONS_FORCE_CLOSE'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const positionId = req.params.id as string;
    const { price } = req.body;

    const pos = await queryOne<any>('SELECT * FROM positions WHERE id = $1', [positionId]);
    if (!pos || parseInt(pos.net_qty, 10) === 0) {
      res.status(400).json({ success: false, error: { code: 'INVALID_POSITION', message: 'Position is already closed or not found' } });
      return;
    }

    const netQty = parseInt(pos.net_qty, 10);
    const exitSide = netQty > 0 ? 'SELL' : 'BUY';
    const exitQty = Math.abs(netQty);
    const exitPrice = price ? parseFloat(price) : (parseFloat(pos.ltp) || parseFloat(pos.average_price) || 100);

    const { PortfolioService } = require('../trading/PortfolioService');
    const { VirtualWalletLedger } = require('../trading/VirtualWalletLedger');

    try {
      await withTransaction(async (client: any) => {
        // B1 fix: net_qty/exitSide/exitQty were computed from an unlocked read above, before
        // this transaction started. recordExecutionInTransaction takes its own row lock, but
        // treats whatever (side, qty) it's handed as a normal trade — if the position was
        // already flattened by a concurrent square-off (a double-click, or two admin sessions)
        // by the time this transaction acquires the lock, it has no way to know this call was
        // meant to be a no-op close-out rather than a legitimate new trade, and would open a
        // fabricated opposite-side position instead. Re-check the locked row matches what was
        // read outside the transaction before doing anything else; abort (rollback, no money
        // moved) if a concurrent square-off already closed it out from under us.
        const lockedPos = await client.query('SELECT net_qty FROM positions WHERE id = $1 FOR UPDATE', [positionId]);
        if (lockedPos.rows.length === 0 || parseInt(lockedPos.rows[0].net_qty, 10) !== netQty) {
          throw new Error('SQUAREOFF_POSITION_ALREADY_MODIFIED');
        }

        const res = await PortfolioService.recordExecutionInTransaction(
          client,
          pos.user_id,
          pos.symbol,
          pos.exchange || 'NSE',
          pos.product_type || 'MIS',
          exitSide,
          exitQty,
          exitPrice,
          'ADMIN_SQUARE_OFF',
          'ADMIN_FORCE_EXIT',
          'exc_' + generateUUID()
        );

        const tradeVal = exitPrice * exitQty;

        await VirtualWalletLedger.settleTradeExecutionInTransaction(
          client,
          pos.user_id,
          exitSide,
          tradeVal,
          res.releasedPositionCapital,
          res.realizedPnlDelta,
          'ADMIN_SQUARE_OFF'
        );
      });
    } catch (txErr: any) {
      if (txErr.message === 'SQUAREOFF_POSITION_ALREADY_MODIFIED') {
        res.status(409).json({ success: false, error: { code: 'ALREADY_MODIFIED', message: 'Position was already closed or changed by another request. No action taken.' } });
        return;
      }
      throw txErr;
    }

    await logAuditAction(req.user!.userId, req.user!.role, 'ADMIN_SQUARE_OFF_POSITION', 'POSITION', positionId, null, { exitSide, exitQty, exitPrice }, getClientIp(req));

    res.json({ success: true, message: `Position ${pos.symbol} squared off by admin @ ₹${exitPrice}.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// Manual trigger for the scheduled MIS auto square-off engine — same code
// path the daily cron job calls, so admins can verify behavior (in
// SIMULATION mode, or LIVE) without waiting for the configured cutoff time.
router.post('/rms/auto-square-off/run', authenticateToken, checkPermission('RMS_SQUAREOFF_RUN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const summary = await RmsAutoSquareOffEngine.run();
    await logAuditAction(req.user!.userId, req.user!.role, 'ADMIN_TRIGGER_RMS_AUTO_SQUARE_OFF', 'SYSTEM', 'rms-engine', null, summary, getClientIp(req));
    res.json({ success: true, ...summary });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// Manual trigger for Contract Expiry Settlement
router.post('/expiry/settle', authenticateToken, checkPermission('RMS_SQUAREOFF_RUN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { ExpirySettlementEngine } = await import('../trading/ExpirySettlementEngine');
    const force = req.body.force === true;
    const summary = await ExpirySettlementEngine.settleExpiredContracts(force);
    await logAuditAction(req.user!.userId, req.user!.role, 'ADMIN_TRIGGER_EXPIRY_SETTLEMENT', 'SYSTEM', 'expiry-engine', null, summary, getClientIp(req));
    res.json({ success: true, ...summary });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET open derivative positions and expiry status
router.get('/expiry/status', authenticateToken, checkPermission('ADMIN_BROAD_VIEW'), async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const { ExpirySettlementEngine } = await import('../trading/ExpirySettlementEngine');
    const status = await ExpirySettlementEngine.getExpiryStatus();
    res.json({ success: true, count: status.length, positions: status });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET RMS Configuration & Settings
router.get('/rms/settings', authenticateToken, checkPermission('ADMIN_BROAD_VIEW'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rows = await query<any>(
      `SELECT key, value, description, updated_at FROM system_settings WHERE key IN ('RMS_MODE','MIS_AUTO_SQUARE_OFF_ENABLED','MIS_AUTO_SQUARE_OFF_TIME','MIS_AUTO_SQUARE_OFF_PRODUCT_TYPES')`
    );
    const map = new Map(rows.map((r: any) => [r.key, r.value]));
    res.json({
      success: true,
      settings: {
        mode: map.get('RMS_MODE') || 'LIVE',
        enabled: (map.get('MIS_AUTO_SQUARE_OFF_ENABLED') || 'true') === 'true',
        time: map.get('MIS_AUTO_SQUARE_OFF_TIME') || '15:15',
        productTypes: map.get('MIS_AUTO_SQUARE_OFF_PRODUCT_TYPES') || 'MIS'
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST Update RMS Settings
router.post('/rms/settings', authenticateToken, checkPermission('ADMIN_SYSTEM_CONFIG'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { mode, enabled, time, productTypes } = req.body;
    if (mode && !['LIVE', 'SIMULATION'].includes(mode)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Mode must be LIVE or SIMULATION' } });
      return;
    }

    if (mode) {
      await execute(`INSERT INTO system_settings (key, value, updated_at) VALUES ('RMS_MODE', $1, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`, [mode]);
    }
    if (enabled !== undefined) {
      await execute(`INSERT INTO system_settings (key, value, updated_at) VALUES ('MIS_AUTO_SQUARE_OFF_ENABLED', $1, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`, [String(enabled)]);
    }
    if (time) {
      await execute(`INSERT INTO system_settings (key, value, updated_at) VALUES ('MIS_AUTO_SQUARE_OFF_TIME', $1, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`, [time]);
    }
    if (productTypes) {
      await execute(`INSERT INTO system_settings (key, value, updated_at) VALUES ('MIS_AUTO_SQUARE_OFF_PRODUCT_TYPES', $1, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`, [productTypes]);
    }

    await logAuditAction(req.user!.userId, req.user!.role, 'UPDATE_RMS_SETTINGS', 'SYSTEM', 'rms-config', null, { mode, enabled, time, productTypes }, getClientIp(req));
    res.json({ success: true, message: 'RMS settings updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// ADMIN CLIENT FUNDS MANAGEMENT
// ============================================================
router.post('/customers/:id/funds', authenticateToken, checkPermission('CUSTOMER_FUNDS_ADJUST_ADMIN'), restrictManagerToOwnCustomer, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.params.id as string;
    const { amount, action, reason } = req.body;

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0 || !['ADD', 'DEDUCT'].includes(action)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Valid positive amount and action (ADD/DEDUCT) required' } });
      return;
    }

    const wallet = await queryOne<any>('SELECT id FROM virtual_wallets WHERE user_id = $1', [customerId]);
    if (!wallet) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User wallet not found' } });
      return;
    }

    // B1 fix: this used to read cash_balance, compute the new value in JS, then write it back
    // outside any row lock — two concurrent adjustments (or a double-click) could both read the
    // same stale balance and each apply their delta on top of it, silently losing one of the two
    // credits/debits while the ledger ends up with two rows that don't sum to the real change.
    // adminAdjustBalance takes a row lock (SELECT ... FOR UPDATE) and computes the new balance
    // from the locked read, inside the same transaction as the ledger insert.
    let newWallet;
    try {
      newWallet = await VirtualWalletLedger.adminAdjustBalance(
        customerId,
        action === 'ADD' ? amt : -amt,
        req.user!.userId,
        reason || 'Admin Manual Capital Adjustment'
      );
    } catch (adjErr: any) {
      res.status(409).json({ success: false, error: { code: 'INVALID_ADJUSTMENT', message: adjErr.message || 'Adjustment could not be applied.' } });
      return;
    }

    await logAuditAction(req.user!.userId, req.user!.role, `ADMIN_${action}_FUNDS`, 'WALLET', wallet.id, null, { amount: amt, action, reason }, getClientIp(req));

    const newCash = newWallet?.cashBalance ?? 0;
    res.json({ success: true, message: `Successfully ${action === 'ADD' ? 'added' : 'deducted'} ₹${amt.toLocaleString('en-IN')} ${action === 'ADD' ? 'to' : 'from'} customer wallet. New Balance: ₹${newCash.toLocaleString('en-IN')}` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// DHAN TOKEN HOT-SWAP ENDPOINT
// POST /api/v1/admin/broker/update-dhan-token
// Protected: SUPER_ADMIN and ADMIN only
// Description: Updates the Dhan access token in the live adapter
//              AND writes it to .env — no server restart required.
// Usage:
//   curl -X POST http://localhost:5000/api/v1/admin/broker/update-dhan-token \
//     -H "Authorization: Bearer YOUR_ADMIN_JWT" \
//     -H "Content-Type: application/json" \
//     -d '{"accessToken": "YOUR_NEW_DHAN_TOKEN"}'
// ============================================================
router.post('/broker/update-dhan-token', authenticateToken, checkPermission('BROKER_TOKEN_MANAGE'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken || typeof accessToken !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_TOKEN', message: 'accessToken is required in request body.' }
      });
    }

    // Connect the live DhanAdapter instance to the token refresh utility
    const engine = MarketDataEngine.getInstance();
    const dhanProvider = (engine as any).providers?.get('DHAN');
    if (dhanProvider) {
      setDhanAdapterRef(dhanProvider);
    }

    const result = await updateDhanToken(accessToken);

    if (!result.success) {
      return res.status(400).json({ success: false, error: { code: 'TOKEN_UPDATE_FAILED', message: result.message } });
    }

    await logAuditAction(
      req.user!.userId,
      req.user!.role,
      'DHAN_TOKEN_UPDATED',
      'SYSTEM',
      'dhan_access_token',
      null,
      { expiresInMinutes: result.expiresInMinutes },
      getClientIp(req)
    );

    return res.json({
      success: true,
      message: result.message,
      expiresInMinutes: result.expiresInMinutes,
      expiresInHours: result.expiresInMinutes ? (result.expiresInMinutes / 60).toFixed(1) : null
    });
  } catch (err: any) {
    console.error('[AdminAPI] Dhan token update error:', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/v1/admin/broker/dhan-token-status
// Returns current Dhan token expiry information
router.get('/broker/dhan-token-status', authenticateToken, checkPermission('BROKER_TOKEN_STATUS_VIEW'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const dhanToken = process.env.DHAN_ACCESS_TOKEN || '';
    const minutesLeft = getTokenExpiryMinutes(dhanToken);
    const isExpired = minutesLeft < 0;
    const isExpiringSoon = minutesLeft >= 0 && minutesLeft <= 60;

    return res.json({
      success: true,
      status: isExpired ? 'EXPIRED' : isExpiringSoon ? 'EXPIRING_SOON' : 'HEALTHY',
      expiresInMinutes: minutesLeft,
      expiresInHours: minutesLeft > 0 ? (minutesLeft / 60).toFixed(1) : null,
      isExpired,
      isExpiringSoon,
      message: isExpired
        ? '🚨 Token is expired. Update required immediately.'
        : isExpiringSoon
        ? `⚠️ Token expires in ${minutesLeft} minutes. Please renew soon.`
        : `✅ Token is healthy. Expires in ~${(minutesLeft/60).toFixed(1)} hours.`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// FYERS TOKEN HOT-SWAP & OAUTH ENDPOINTS
// ============================================================
router.post('/broker/update-fyers-token', authenticateToken, checkPermission('BROKER_TOKEN_MANAGE'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken || typeof accessToken !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_TOKEN', message: 'accessToken is required in request body.' }
      });
    }

    const engine = MarketDataEngine.getInstance();
    const fyersProvider = (engine as any).providers?.get('FYERS');
    if (fyersProvider) {
      setFyersAdapterRef(fyersProvider);
    }

    const result = await updateFyersToken(accessToken);

    if (!result.success) {
      return res.status(400).json({ success: false, error: { code: 'TOKEN_UPDATE_FAILED', message: result.message } });
    }

    await logAuditAction(
      req.user!.userId,
      req.user!.role,
      'FYERS_TOKEN_UPDATED',
      'SYSTEM',
      'fyers_access_token',
      null,
      {},
      getClientIp(req)
    );

    return res.json({
      success: true,
      message: result.message
    });
  } catch (err: any) {
    console.error('[AdminAPI] Fyers token update error:', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.get('/broker/fyers-auth-url', authenticateToken, checkPermission('BROKER_TOKEN_MANAGE'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const appId = String(req.query.appId || process.env.FYERS_APP_ID || '');
    const redirectUri = String(req.query.redirectUri || process.env.FYERS_REDIRECT_URI || 'http://localhost:5000/api/v1/auth/fyers/callback');

    if (!appId) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_APP_ID', message: 'FYERS_APP_ID is required to generate auth URL.' } });
    }

    const authUrl = generateFyersAuthUrl(appId, redirectUri);
    return res.json({ success: true, authUrl });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/broker/fyers-validate-code', authenticateToken, checkPermission('BROKER_TOKEN_MANAGE'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { authCode, appId, appSecret } = req.body;

    if (!authCode) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_AUTH_CODE', message: 'authCode is required.' } });
    }

    const engine = MarketDataEngine.getInstance();
    const fyersProvider = (engine as any).providers?.get('FYERS');
    if (fyersProvider) {
      setFyersAdapterRef(fyersProvider);
    }

    const result = await exchangeAuthCodeForToken(authCode, appId, appSecret);

    if (!result.success) {
      return res.status(400).json({ success: false, error: { code: 'AUTH_VALIDATION_FAILED', message: result.message } });
    }

    await logAuditAction(
      req.user!.userId,
      req.user!.role,
      'FYERS_AUTH_CODE_VALIDATED',
      'SYSTEM',
      'fyers_access_token',
      null,
      {},
      getClientIp(req)
    );

    return res.json({ success: true, message: result.message, accessToken: result.accessToken });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// 15. FILL PROVENANCE & DISPUTE AUDITOR
// ============================================================
router.get('/executions/provenance', authenticateToken, checkPermission('EXECUTIONS_PROVENANCE_VIEW'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, symbol, freshness, offset = '0' } = req.query;
    // C1 fix: `limit` was passed straight through from the query string with no cap — a caller
    // could request an arbitrarily large page (e.g. ?limit=999999) and pull the entire table.
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 500);
    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (userId) {
      params.push(userId);
      where += ` AND e.user_id = $${params.length}`;
    }
    if (symbol) {
      params.push(`%${String(symbol).toUpperCase()}%`);
      where += ` AND e.symbol ILIKE $${params.length}`;
    }
    if (freshness) {
      params.push(freshness);
      where += ` AND e.freshness_tag = $${params.length}`;
    }

    params.push(parseInt(String(limit), 10));
    params.push(parseInt(String(offset), 10));

    const rows = await query<any>(
      `SELECT e.*, u.username, u.email, o.order_type, o.price as order_price, o.trigger_price
       FROM executions e
       JOIN users u ON e.user_id = u.id
       LEFT JOIN orders o ON e.order_id = o.id
       ${where}
       ORDER BY e.executed_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const countRow = await queryOne<any>(
      `SELECT COUNT(*) as c FROM executions e ${where.replace(/LIMIT.*$/, '')}`,
      params.slice(0, params.length - 2)
    );

    res.json({
      success: true,
      executions: rows,
      total: parseInt(countRow?.c || '0')
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// 16. PLATFORM SOLVENCY & CASH RESERVE RECONCILER
// ============================================================
router.get('/finance/reserves', authenticateToken, checkPermission('RESERVES_RECONCILE'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { totalCash, totalLiability, totalUsedMargin } = await VirtualWalletLedger.getPlatformTotalLiability();
    
    // Get latest recorded platform bank reserve snapshot
    const latestSnapshot = await queryOne<any>(
      'SELECT * FROM platform_reserves ORDER BY created_at DESC LIMIT 1'
    );

    const bankReserve = latestSnapshot ? parseFloat(latestSnapshot.bank_cash_reserve) : totalCash;
    const reserveRatio = totalLiability > 0 ? (bankReserve / totalLiability) : 1.0;
    const status = reserveRatio >= 1.0 ? 'HEALTHY' : (reserveRatio >= 0.8 ? 'WARNING' : 'DEFICIT');

    res.json({
      success: true,
      solvency: {
        totalUserCashBalance: totalCash,
        totalUsedMargin,
        totalWithdrawableLiabilities: totalLiability,
        bankCashReserve: bankReserve,
        reserveRatio: Number(reserveRatio.toFixed(4)),
        status,
        lastReconciledAt: latestSnapshot?.created_at || null,
        reconciledBy: latestSnapshot?.reconciled_by || null,
        notes: latestSnapshot?.notes || null
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/finance/reserves/reconcile', authenticateToken, checkPermission('RESERVES_RECONCILE'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { bankCashReserve, notes } = req.body;
    const bankReserveNum = parseFloat(bankCashReserve);
    if (isNaN(bankReserveNum) || bankReserveNum < 0) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Bank cash reserve must be a valid non-negative number' } });
      return;
    }

    const { totalLiability, totalCash } = await VirtualWalletLedger.getPlatformTotalLiability();
    const reserveRatio = totalLiability > 0 ? (bankReserveNum / totalLiability) : 1.0;
    const status = reserveRatio >= 1.0 ? 'HEALTHY' : (reserveRatio >= 0.8 ? 'WARNING' : 'DEFICIT');

    const id = 'res_' + generateUUID();
    await execute(
      `INSERT INTO platform_reserves (id, bank_cash_reserve, total_user_liabilities, reserve_ratio, status, reconciled_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, bankReserveNum, totalLiability, reserveRatio, status, req.user!.userId, notes || null]
    );

    await logAuditAction(
      req.user!.userId, req.user!.role,
      'RECONCILE_RESERVES', 'FINANCE', id,
      null, { bankReserveNum, totalLiability, reserveRatio, status }, getClientIp(req)
    );

    res.json({
      success: true,
      message: `Platform reserves reconciled successfully. Solvency status: ${status} (Reserve ratio: ${(reserveRatio * 100).toFixed(1)}%).`,
      solvency: {
        bankCashReserve: bankReserveNum,
        totalWithdrawableLiabilities: totalLiability,
        reserveRatio: Number(reserveRatio.toFixed(4)),
        status
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// B3: per-user ledger-vs-balance drift check. `/finance/reserves` above checks platform-wide
// solvency (bank reserve vs aggregate liability); this checks a different, narrower invariant —
// that each user's virtual_wallets.cash_balance still matches the balance_after of their most
// recent CASH-BALANCE-mutating wallet_ledger row. Every such route this session's B1 pass
// touched now writes both inside the same locked transaction, so on a healthy system this
// should never drift; this endpoint exists to prove that (or catch it if some other code path,
// or a bug this audit missed, still lets them diverge).
//
// MARGIN_BLOCK/MARGIN_RELEASE rows are deliberately excluded: those two transaction types never
// touch cash_balance at all (they only move used_margin) but reuse the same balance_after column
// to record post-op *buying power* (cash_balance - used_margin) instead — a real, found-in-
// production false-positive if included (confirmed against two live users during this task).
router.get('/finance/ledger-reconciliation', authenticateToken, checkPermission('RESERVES_RECONCILE'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const drifted = await query<any>(
      `SELECT w.user_id, w.cash_balance, latest.balance_after AS ledger_balance_after, latest.transaction_type AS ledger_last_type, latest.created_at AS ledger_last_entry_at
       FROM virtual_wallets w
       JOIN LATERAL (
         SELECT balance_after, transaction_type, created_at FROM wallet_ledger
         WHERE user_id = w.user_id
           AND transaction_type NOT IN ('MARGIN_BLOCK', 'MARGIN_RELEASE')
         ORDER BY created_at DESC, id DESC
         LIMIT 1
       ) latest ON true
       WHERE ABS(w.cash_balance - latest.balance_after) > 0.01
       ORDER BY ABS(w.cash_balance - latest.balance_after) DESC
       LIMIT 200`
    );

    const totalUsersWithLedgerRow = await queryOne<any>(
      `SELECT COUNT(DISTINCT user_id) as c FROM wallet_ledger`
    );

    res.json({
      success: true,
      driftedUsers: drifted,
      driftedCount: drifted.length,
      totalUsersWithLedgerHistory: parseInt(totalUsersWithLedgerRow?.c || '0'),
      status: drifted.length === 0 ? 'RECONCILED' : 'DRIFT_DETECTED'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// 17. MANAGER HIERARCHY & CAPACITY CONTROLS
// ============================================================
router.get('/managers', authenticateToken, checkPermission('MANAGERS_VIEW'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const managers = await query<any>(
      `SELECT u.id, u.username, u.email, u.role, u.status, u.created_at,
              COALESCE(ml.max_users, 100) as max_users,
              COALESCE(ml.max_exposure_per_user, 1000000) as max_exposure_per_user,
              COALESCE(ml.max_deposit_approval, 50000) as max_deposit_approval,
              COALESCE(ml.max_withdrawal_approval, 25000) as max_withdrawal_approval,
              COUNT(ma.user_id) as assigned_users_count
       FROM users u
       LEFT JOIN manager_limits ml ON u.id = ml.manager_id
       LEFT JOIN manager_assignments ma ON u.id = ma.manager_id
       WHERE u.role IN ('ADMIN', 'MANAGER', 'RISK_MANAGER', 'FINANCE_MANAGER', 'MANAGER')
       GROUP BY u.id, ml.max_users, ml.max_exposure_per_user, ml.max_deposit_approval, ml.max_withdrawal_approval
       ORDER BY u.created_at ASC`
    );

    res.json({ success: true, managers });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/managers/assign', authenticateToken, checkPermission('MANAGERS_ASSIGN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { managerId, userId } = req.body;
    if (!managerId || !userId) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'managerId and userId are required' } });
      return;
    }

    const id = 'asgn_' + generateUUID();
    await execute(
      `INSERT INTO manager_assignments (id, manager_id, user_id, assigned_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (manager_id, user_id) DO NOTHING`,
      [id, managerId, userId, req.user!.userId]
    );

    await logAuditAction(
      req.user!.userId, req.user!.role,
      'ASSIGN_USER_TO_MANAGER', 'USER', userId,
      null, { managerId, userId }, getClientIp(req)
    );

    res.json({ success: true, message: 'User assigned to manager successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// `manager_assignments` was insert-only (ON CONFLICT DO NOTHING) with no way to remove an
// assignment through the API at all — found during Phase F1's gap analysis, closed here.
router.post('/managers/unassign', authenticateToken, checkPermission('MANAGERS_ASSIGN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { managerId, userId } = req.body;
    if (!managerId || !userId) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'managerId and userId are required' } });
      return;
    }

    const deleted = await queryOne<any>(
      `DELETE FROM manager_assignments WHERE manager_id = $1 AND user_id = $2 RETURNING id`,
      [managerId, userId]
    );
    if (!deleted) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'That customer is not currently assigned to this manager.' } });
      return;
    }

    await logAuditAction(
      req.user!.userId, req.user!.role,
      'UNASSIGN_USER_FROM_MANAGER', 'USER', userId,
      null, { managerId, userId }, getClientIp(req)
    );

    res.json({ success: true, message: 'Customer unassigned from manager.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// Lists everyone currently assigned to one manager — needed for a real Manager Management
// UI (previously nothing displayed this; `assigned_users_count` on /managers was fetched
// but never actually rendered anywhere per the F1 gap analysis).
router.get('/managers/:managerId/assignments', authenticateToken, checkPermission('MANAGERS_VIEW'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { managerId } = req.params;
    const assignments = await query<any>(
      `SELECT ma.id, ma.user_id, ma.assigned_by, ma.created_at, u.username, u.email, u.client_id, u.status
       FROM manager_assignments ma
       JOIN users u ON ma.user_id = u.id
       WHERE ma.manager_id = $1
       ORDER BY ma.created_at DESC`,
      [managerId]
    );
    res.json({ success: true, assignments });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});


// ============================================================
// 18. CUSTOMER PROFILE MODIFICATION (PATCH)
// ============================================================
router.patch('/customers/:id', authenticateToken, checkPermission('CUSTOMERS_PROFILE_EDIT'), restrictManagerToOwnCustomer, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.params.id as string;
    const { fullName, phoneNumber, email, address, city, role, status } = req.body;

    const current = await queryOne<any>(
      'SELECT id, username, email, full_name, phone_number, address, city, role, status FROM users WHERE id = $1',
      [customerId]
    );
    if (!current) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });
      return;
    }

    // Protect sensitive fields from unauthorized roles
    if (role && role !== current.role && req.user!.role !== 'SUPER_ADMIN' && req.user!.role !== 'ADMIN') {
      res.status(403).json({ success: false, error: { code: 'PERMISSION_DENIED', message: 'Only SUPER_ADMIN or ADMIN can change user role' } });
      return;
    }

    // Validate email uniqueness if changing
    if (email && email.toLowerCase().trim() !== current.email) {
      const normalizedEmail = email.toLowerCase().trim();
      const existing = await queryOne<any>(
        'SELECT id FROM users WHERE LOWER(TRIM(email)) = $1 AND id != $2',
        [normalizedEmail, customerId]
      );
      if (existing) {
        res.status(409).json({ success: false, error: { code: 'DUPLICATE_EMAIL', message: `Email '${normalizedEmail}' is already in use by another account.` } });
        return;
      }
    }

    const updates: string[] = [];
    const params: any[] = [];
    let pIdx = 1;
    const changes: Record<string, { from: any; to: any }> = {};

    if (fullName !== undefined && fullName !== current.full_name) {
      updates.push(`full_name = $${pIdx}`); params.push(fullName.trim()); pIdx++;
      changes.fullName = { from: current.full_name, to: fullName.trim() };
    }
    if (phoneNumber !== undefined && phoneNumber !== current.phone_number) {
      updates.push(`phone_number = $${pIdx}`); params.push(phoneNumber.trim()); pIdx++;
      changes.phoneNumber = { from: current.phone_number, to: phoneNumber.trim() };
    }
    if (email !== undefined && email.toLowerCase().trim() !== current.email) {
      updates.push(`email = $${pIdx}`); params.push(email.toLowerCase().trim()); pIdx++;
      changes.email = { from: current.email, to: email.toLowerCase().trim() };
    }
    if (address !== undefined && address !== current.address) {
      updates.push(`address = $${pIdx}`); params.push(address.trim()); pIdx++;
      changes.address = { from: current.address, to: address.trim() };
    }
    if (city !== undefined && city !== current.city) {
      updates.push(`city = $${pIdx}`); params.push(city.trim()); pIdx++;
      changes.city = { from: current.city, to: city.trim() };
    }
    if (role !== undefined && role !== current.role) {
      updates.push(`role = $${pIdx}`); params.push(role); pIdx++;
      changes.role = { from: current.role, to: role };
    }

    if (updates.length === 0) {
      res.json({ success: true, message: 'No changes detected.' });
      return;
    }

    updates.push(`updated_at = NOW()`);
    params.push(customerId);
    await execute(`UPDATE users SET ${updates.join(', ')} WHERE id = $${pIdx}`, params);

    await logAuditAction(
      req.user!.userId, req.user!.role,
      'ADMIN_UPDATED_CUSTOMER', 'USER', customerId,
      current, changes, getClientIp(req)
    );

    adminEventBus.emitUserEvent('USER_PROFILE_UPDATED', customerId, { changes });

    res.json({ success: true, message: 'Customer profile updated successfully.', changes });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// 19. SUSPEND CUSTOMER
// ============================================================
router.post('/customers/:id/suspend', authenticateToken, checkPermission('CUSTOMERS_SUSPEND'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.params.id as string;
    const { reason, notes, suspendUntil } = req.body;

    if (!reason || !reason.trim()) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Reason is required to suspend an account' } });
      return;
    }

    const user = await queryOne<any>('SELECT id, username, status FROM users WHERE id = $1', [customerId]);
    if (!user) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });
      return;
    }

    if (user.status === 'SUSPENDED') {
      res.status(400).json({ success: false, error: { code: 'ALREADY_SUSPENDED', message: 'Account is already suspended' } });
      return;
    }

    await execute(
      `UPDATE users SET status = 'SUSPENDED', suspended_reason = $1, suspended_by = $2, suspended_at = NOW(), suspended_until = $3, updated_at = NOW() WHERE id = $4`,
      [reason.trim(), req.user!.userId, suspendUntil || null, customerId]
    );

    await logAuditAction(
      req.user!.userId, req.user!.role,
      'ADMIN_SUSPENDED_CUSTOMER', 'USER', customerId,
      { status: user.status }, { status: 'SUSPENDED', reason, notes }, getClientIp(req)
    );

    adminEventBus.emitUserEvent('USER_STATUS_UPDATED', customerId, {
      status: 'SUSPENDED', reason, suspendedBy: req.user!.userId
    });

    res.json({ success: true, message: `Account for ${user.username} has been suspended.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// 20. ACTIVATE CUSTOMER
// ============================================================
router.post('/customers/:id/activate', authenticateToken, checkPermission('CUSTOMERS_ACTIVATE'), restrictManagerToOwnCustomer, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.params.id as string;
    const { reason } = req.body;

    const user = await queryOne<any>('SELECT id, username, status FROM users WHERE id = $1', [customerId]);
    if (!user) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });
      return;
    }

    if (user.status === 'ACTIVE') {
      res.status(400).json({ success: false, error: { code: 'ALREADY_ACTIVE', message: 'Account is already active' } });
      return;
    }

    if (user.status === 'CLOSED') {
      res.status(400).json({ success: false, error: { code: 'ACCOUNT_CLOSED', message: 'Closed accounts cannot be reactivated directly. Please create a new account.' } });
      return;
    }

    await execute(
      `UPDATE users SET status = 'ACTIVE', suspended_reason = NULL, suspended_by = NULL, suspended_at = NULL,
       suspended_until = NULL, locked_reason = NULL, locked_by = NULL, locked_at = NULL, updated_at = NOW() WHERE id = $1`,
      [customerId]
    );

    await logAuditAction(
      req.user!.userId, req.user!.role,
      'ADMIN_ACTIVATED_CUSTOMER', 'USER', customerId,
      { status: user.status }, { status: 'ACTIVE', reason }, getClientIp(req)
    );

    adminEventBus.emitUserEvent('USER_STATUS_UPDATED', customerId, {
      status: 'ACTIVE', activatedBy: req.user!.userId
    });

    res.json({ success: true, message: `Account for ${user.username} has been activated.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// 21. LOCK CUSTOMER (Security Hold)
// ============================================================
router.post('/customers/:id/lock', authenticateToken, checkPermission('CUSTOMERS_LOCK'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.params.id as string;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Reason is required to lock an account' } });
      return;
    }

    const user = await queryOne<any>('SELECT id, username, status FROM users WHERE id = $1', [customerId]);
    if (!user) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });
      return;
    }

    await execute(
      `UPDATE users SET status = 'LOCKED', locked_reason = $1, locked_by = $2, locked_at = NOW(), updated_at = NOW() WHERE id = $3`,
      [reason.trim(), req.user!.userId, customerId]
    );

    await logAuditAction(
      req.user!.userId, req.user!.role,
      'ADMIN_LOCKED_CUSTOMER', 'USER', customerId,
      { status: user.status }, { status: 'LOCKED', reason }, getClientIp(req)
    );

    adminEventBus.emitUserEvent('USER_STATUS_UPDATED', customerId, {
      status: 'LOCKED', reason, lockedBy: req.user!.userId
    });

    res.json({ success: true, message: `Account for ${user.username} has been locked.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// 22. UNLOCK CUSTOMER
// ============================================================
router.post('/customers/:id/unlock', authenticateToken, checkPermission('CUSTOMERS_UNLOCK'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.params.id as string;
    const { reason } = req.body;

    const user = await queryOne<any>('SELECT id, username, status FROM users WHERE id = $1', [customerId]);
    if (!user) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });
      return;
    }

    if (user.status !== 'LOCKED') {
      res.status(400).json({ success: false, error: { code: 'NOT_LOCKED', message: 'Account is not currently locked' } });
      return;
    }

    await execute(
      `UPDATE users SET status = 'ACTIVE', locked_reason = NULL, locked_by = NULL, locked_at = NULL,
       unlocked_by = $1, unlocked_at = NOW(), updated_at = NOW() WHERE id = $2`,
      [req.user!.userId, customerId]
    );

    await logAuditAction(
      req.user!.userId, req.user!.role,
      'ADMIN_UNLOCKED_CUSTOMER', 'USER', customerId,
      { status: 'LOCKED' }, { status: 'ACTIVE', reason }, getClientIp(req)
    );

    adminEventBus.emitUserEvent('USER_STATUS_UPDATED', customerId, {
      status: 'ACTIVE', unlockedBy: req.user!.userId
    });

    res.json({ success: true, message: `Account for ${user.username} has been unlocked and reactivated.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// 23. CLOSE CUSTOMER ACCOUNT (Soft Close — with dependency check)
// ============================================================
router.post('/customers/:id/close', authenticateToken, checkPermission('CUSTOMERS_CLOSE'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.params.id as string;
    const { reason, confirmClose } = req.body;

    if (!reason || !reason.trim()) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Reason is required to close an account' } });
      return;
    }

    if (!confirmClose) {
      res.status(400).json({ success: false, error: { code: 'CONFIRMATION_REQUIRED', message: 'confirmClose: true is required to proceed with account closure' } });
      return;
    }

    const user = await queryOne<any>('SELECT id, username, status FROM users WHERE id = $1', [customerId]);
    if (!user) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });
      return;
    }

    if (user.status === 'CLOSED') {
      res.status(400).json({ success: false, error: { code: 'ALREADY_CLOSED', message: 'Account is already closed' } });
      return;
    }

    // Dependency check — cannot close with open positions or non-zero balance
    const [openPositions, wallet] = await Promise.all([
      queryOne<any>('SELECT COUNT(*) as c FROM positions WHERE user_id = $1 AND net_qty != 0', [customerId]),
      queryOne<any>('SELECT cash_balance, used_margin FROM virtual_wallets WHERE user_id = $1', [customerId])
    ]);

    const openPosCount = parseInt(openPositions?.c || '0');
    const cashBalance = parseFloat(wallet?.cash_balance || '0');
    const usedMargin = parseFloat(wallet?.used_margin || '0');

    if (openPosCount > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'OPEN_POSITIONS_EXIST',
          message: `This account has ${openPosCount} open position(s). Please square off all positions before closing the account.`
        }
      });
      return;
    }

    if (usedMargin > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MARGIN_BLOCKED',
          message: `This account has ₹${usedMargin.toLocaleString('en-IN')} margin blocked. Release all margin before closing.`
        }
      });
      return;
    }

    // Soft close — preserve all historical data, just change status
    await execute(
      `UPDATE users SET status = 'CLOSED', closed_reason = $1, closed_by = $2, closed_at = NOW(), updated_at = NOW() WHERE id = $3`,
      [reason.trim(), req.user!.userId, customerId]
    );

    await logAuditAction(
      req.user!.userId, req.user!.role,
      'ADMIN_CLOSED_CUSTOMER', 'USER', customerId,
      { status: user.status, cashBalance }, { status: 'CLOSED', reason }, getClientIp(req)
    );

    adminEventBus.emitUserEvent('USER_STATUS_UPDATED', customerId, {
      status: 'CLOSED', reason, closedBy: req.user!.userId
    });

    res.json({
      success: true,
      message: `Account for ${user.username} has been closed. All trading history and records are preserved.`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// 24. CUSTOMER AUDIT TRAIL (paginated)
// ============================================================
router.get('/customers/:id/audit', authenticateToken, checkPermission('ADMIN_BROAD_VIEW'), restrictManagerToOwnCustomer, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.params.id as string;
    const limit = Math.min(parseInt(req.query.limit as string || '50', 10), 200);
    const offset = parseInt(req.query.offset as string || '0', 10);

    const [logs, countRow] = await Promise.all([
      query<any>(
        `SELECT al.*, u.username as actor_username 
         FROM audit_logs al
         LEFT JOIN users u ON al.actor_id = u.id
         WHERE al.actor_id = $1 OR al.resource_id = $1
         ORDER BY al.timestamp DESC
         LIMIT $2 OFFSET $3`,
        [customerId, limit, offset]
      ),
      queryOne<any>(
        `SELECT COUNT(*) as c FROM audit_logs WHERE actor_id = $1 OR resource_id = $1`,
        [customerId]
      )
    ]);

    await logAuditAction(req.user!.userId, req.user!.role, 'ADMIN_VIEWED_AUDIT', 'USER', customerId, null, null, getClientIp(req));

    res.json({ success: true, logs, total: parseInt(countRow?.c || '0'), pagination: { limit, offset } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// 25. CUSTOMER LOGIN ACTIVITY
// ============================================================
router.get('/customers/:id/login-activity', authenticateToken, checkPermission('ADMIN_BROAD_VIEW'), restrictManagerToOwnCustomer, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.params.id as string;
    const limit = Math.min(parseInt(req.query.limit as string || '30', 10), 100);

    const sessions = await query<any>(
      `SELECT id, ip_address, user_agent, device_type, login_at, logout_at, is_active, login_result, failure_reason
       FROM login_sessions
       WHERE user_id = $1
       ORDER BY login_at DESC
       LIMIT $2`,
      [customerId, limit]
    );

    // Also get basic user security info
    const user = await queryOne<any>(
      `SELECT failed_login_attempts, locked_until, last_login_at FROM users WHERE id = $1`,
      [customerId]
    );

    res.json({
      success: true,
      sessions,
      security: {
        failedLoginAttempts: user?.failed_login_attempts || 0,
        lockedUntil: user?.locked_until || null,
        lastLoginAt: user?.last_login_at || null
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// 26. CUSTOMER KYC DETAIL (full — for Customer360 KYC tab)
// ============================================================
router.get('/customers/:id/kyc', authenticateToken, checkPermission('ADMIN_BROAD_VIEW'), restrictManagerToOwnCustomer, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.params.id as string;

    const [kycRecords, kycApplications] = await Promise.all([
      query<any>('SELECT * FROM kyc_records WHERE customer_id = $1 ORDER BY created_at DESC', [customerId]),
      query<any>(
        `SELECT ka.*, 
                (SELECT json_agg(json_build_object(
                  'id', kd.id, 'document_type', kd.document_type, 
                  'original_filename', kd.original_filename, 'mime_type', kd.mime_type,
                  'file_size', kd.file_size, 'uploaded_at', kd.uploaded_at
                )) FROM kyc_documents kd WHERE kd.kyc_application_id = ka.id) as documents
         FROM kyc_applications ka WHERE ka.user_id = $1 ORDER BY ka.submitted_at DESC`,
        [customerId]
      )
    ]);

    await logAuditAction(req.user!.userId, req.user!.role, 'ADMIN_VIEWED_KYC', 'USER', customerId, null, null, getClientIp(req));

    res.json({ success: true, kycRecords, kycApplications });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// 27. KYC APPROVE FOR CUSTOMER (by customer ID, not KYC record ID)
// ============================================================
router.post('/customers/:id/kyc/approve', authenticateToken, checkPermission('KYC_REJECT'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.params.id as string;
    const { notes, applicationId } = req.body;

    let targetId = applicationId;

    if (!targetId) {
      // Get the most recent pending application
      const app = await queryOne<any>(
        `SELECT id FROM kyc_applications WHERE user_id = $1 AND status IN ('PENDING','UNDER_REVIEW','SUBMITTED') ORDER BY submitted_at DESC LIMIT 1`,
        [customerId]
      );
      if (app) {
        targetId = app.id;
      } else {
        // Fall back to kyc_records
        const rec = await queryOne<any>(
          `SELECT id FROM kyc_records WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [customerId]
        );
        if (rec) {
          await execute(
            `UPDATE kyc_records SET kyc_status = 'APPROVED', verification_status = 'VERIFIED', verified_by = $1, verified_at = NOW(), notes = $2, updated_at = NOW() WHERE id = $3`,
            [req.user!.userId, notes || '', rec.id]
          );
          await execute(`UPDATE users SET is_kyc_completed = TRUE, updated_at = NOW() WHERE id = $1`, [customerId]);
          await logAuditAction(req.user!.userId, req.user!.role, 'ADMIN_APPROVED_KYC', 'USER', customerId, null, { notes }, getClientIp(req));
          adminEventBus.emitUserEvent('KYC_UPDATED', customerId, { kycStatus: 'APPROVED' });
          res.json({ success: true, message: 'KYC approved successfully.' });
          return;
        }
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'No KYC record or application found for this customer' } });
        return;
      }
    }

    await execute(
      `UPDATE kyc_applications SET status = 'APPROVED', reviewed_at = NOW(), reviewed_by = $1, rejection_reason = NULL, updated_at = NOW() WHERE id = $2`,
      [req.user!.userId, targetId]
    );
    await execute(`UPDATE users SET is_kyc_completed = TRUE, updated_at = NOW() WHERE id = $1`, [customerId]);

    await logAuditAction(req.user!.userId, req.user!.role, 'ADMIN_APPROVED_KYC', 'USER', customerId, null, { applicationId: targetId, notes }, getClientIp(req));
    adminEventBus.emitUserEvent('KYC_UPDATED', customerId, { kycStatus: 'APPROVED' });

    res.json({ success: true, message: 'KYC approved successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// 28. KYC REJECT FOR CUSTOMER (by customer ID)
// ============================================================
router.post('/customers/:id/kyc/reject', authenticateToken, checkPermission('KYC_REJECT'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.params.id as string;
    const { reason, rejectionCategory, applicationId } = req.body;

    if (!reason || !reason.trim()) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Rejection reason is required' } });
      return;
    }

    let targetId = applicationId;
    if (!targetId) {
      const app = await queryOne<any>(
        `SELECT id FROM kyc_applications WHERE user_id = $1 AND status NOT IN ('REJECTED') ORDER BY submitted_at DESC LIMIT 1`,
        [customerId]
      );
      if (app) {
        targetId = app.id;
      } else {
        const rec = await queryOne<any>(`SELECT id FROM kyc_records WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 1`, [customerId]);
        if (rec) {
          await execute(
            `UPDATE kyc_records SET kyc_status = 'REJECTED', verification_status = 'FAILED', verified_by = $1, verified_at = NOW(), notes = $2, updated_at = NOW() WHERE id = $3`,
            [req.user!.userId, reason, rec.id]
          );
          await execute(`UPDATE users SET is_kyc_completed = FALSE, updated_at = NOW() WHERE id = $1`, [customerId]);
          await logAuditAction(req.user!.userId, req.user!.role, 'ADMIN_REJECTED_KYC', 'USER', customerId, null, { reason }, getClientIp(req));
          adminEventBus.emitUserEvent('KYC_UPDATED', customerId, { kycStatus: 'REJECTED', reason });
          res.json({ success: true, message: 'KYC rejected.' });
          return;
        }
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'No KYC record found for this customer' } });
        return;
      }
    }

    await execute(
      `UPDATE kyc_applications SET status = 'REJECTED', rejection_reason = $1, rejection_category = $2, reviewed_at = NOW(), reviewed_by = $3, updated_at = NOW() WHERE id = $4`,
      [reason.trim(), rejectionCategory || null, req.user!.userId, targetId]
    );
    await execute(`UPDATE users SET is_kyc_completed = FALSE, updated_at = NOW() WHERE id = $1`, [customerId]);

    await logAuditAction(req.user!.userId, req.user!.role, 'ADMIN_REJECTED_KYC', 'USER', customerId, null, { reason, rejectionCategory }, getClientIp(req));
    adminEventBus.emitUserEvent('KYC_UPDATED', customerId, { kycStatus: 'REJECTED', reason });

    res.json({ success: true, message: 'KYC rejected.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// 29. KYC REQUEST RE-UPLOAD
// ============================================================
router.post('/customers/:id/kyc/request-reupload', authenticateToken, checkPermission('KYC_REJECT'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.params.id as string;
    const { reason, applicationId } = req.body;

    let targetId = applicationId;
    if (!targetId) {
      const app = await queryOne<any>(
        `SELECT id FROM kyc_applications WHERE user_id = $1 ORDER BY submitted_at DESC LIMIT 1`,
        [customerId]
      );
      targetId = app?.id;
    }

    if (targetId) {
      await execute(
        `UPDATE kyc_applications SET status = 'RESUBMISSION_REQUIRED', rejection_reason = $1, reviewed_at = NOW(), reviewed_by = $2, updated_at = NOW() WHERE id = $3`,
        [reason || 'Additional documents required', req.user!.userId, targetId]
      );
    }

    await logAuditAction(req.user!.userId, req.user!.role, 'ADMIN_KYC_REUPLOAD_REQUESTED', 'USER', customerId, null, { reason }, getClientIp(req));
    adminEventBus.emitUserEvent('KYC_UPDATED', customerId, { kycStatus: 'RESUBMISSION_REQUIRED', reason });

    res.json({ success: true, message: 'Re-upload request sent to customer.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// 30. PERMISSIONS & ROLE-BASED ACCESS CONTROL (RBAC) DASHBOARD
// ============================================================
// SYSTEM_PERMISSION_CATEGORIES relocated to ../config/permissionCatalog
// (Phase 3) so middleware/auth.ts's checkPermission can import it without a
// circular dependency on this route file.

// GET: System Permission Definitions & Default Matrix
router.get('/permissions/matrix', authenticateToken, checkPermission('ADMIN_BROAD_VIEW'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const roles = [
      'SUPER_ADMIN', 'ADMIN', 'MANAGER', 'FINANCE_MANAGER', 'RISK_MANAGER', 
      'OPERATIONS_MANAGER', 'KYC_OFFICER', 'DEALER', 'SUPPORT_AGENT', 'ANALYST', 
      'READ_ONLY_AUDITOR', 'USER'
    ];

    res.json({
      success: true,
      roles,
      categories: SYSTEM_PERMISSION_CATEGORIES
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET: All Users with Roles, Custom Permissions & Capacity Limits
// C1 fix: this used to return every row in `users` with no WHERE clause at all — every plain
// customer account included, not just staff — on a screen whose entire purpose is managing
// staff roles/permissions. At the brief's stated 1,000+-user scale target this would return the
// whole platform's user base on every page load. Restricted to non-customer roles below, which
// keeps the natural result size bounded by staff headcount (small) rather than customer count.
router.get('/permissions/users', authenticateToken, checkPermission('ADMIN_BROAD_VIEW'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const users = await query<any>(
      `SELECT u.id, u.username, u.email, u.full_name, u.phone_number, u.role, u.status, u.is_kyc_completed, u.created_at,
              COALESCE(ml.max_users, 100) as max_users,
              COALESCE(ml.max_exposure_per_user, 1000000) as max_exposure_per_user,
              COALESCE(ml.max_deposit_approval, 50000) as max_deposit_approval,
              COALESCE(ml.max_withdrawal_approval, 25000) as max_withdrawal_approval,
              COALESCE(ml.max_daily_loss_cap, 100000) as max_daily_loss_cap,
              COUNT(ma.user_id) as assigned_users_count
       FROM users u
       LEFT JOIN manager_limits ml ON u.id = ml.manager_id
       LEFT JOIN manager_assignments ma ON u.id = ma.manager_id
       WHERE u.role != 'USER'
       GROUP BY u.id, ml.max_users, ml.max_exposure_per_user, ml.max_deposit_approval, ml.max_withdrawal_approval, ml.max_daily_loss_cap
       ORDER BY 
         CASE 
           WHEN u.role = 'SUPER_ADMIN' THEN 1
           WHEN u.role = 'ADMIN' THEN 2
           WHEN u.role = 'MANAGER' THEN 3
           WHEN u.role = 'FINANCE_MANAGER' THEN 4
           WHEN u.role = 'RISK_MANAGER' THEN 5
           WHEN u.role = 'OPERATIONS_MANAGER' THEN 6
           WHEN u.role = 'KYC_OFFICER' THEN 7
           WHEN u.role = 'DEALER' THEN 8
           WHEN u.role = 'SUPPORT_AGENT' THEN 9
           WHEN u.role = 'ANALYST' THEN 10
           WHEN u.role = 'READ_ONLY_AUDITOR' THEN 11
           ELSE 12
         END ASC,
         u.created_at ASC`
    );

    // Fetch granular permissions overrides
    const permissionsRows = await query<any>(
      `SELECT manager_id, permission_key, granted FROM manager_permissions`
    );

    const permMap: Record<string, Record<string, boolean>> = {};
    for (const row of permissionsRows) {
      if (!permMap[row.manager_id]) permMap[row.manager_id] = {};
      permMap[row.manager_id][row.permission_key] = row.granted;
    }

    const enrichedUsers = users.map(u => ({
      ...u,
      customPermissions: permMap[u.id] || {}
    }));

    res.json({ success: true, users: enrichedUsers });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST: Assign User Role
router.post('/permissions/assign-role', authenticateToken, checkPermission('MANAGE_ROLES_PERMISSIONS'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, role } = req.body;
    if (!userId || !role) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'userId and role are required' } });
      return;
    }

    const validRoles = [
      'SUPER_ADMIN', 'ADMIN', 'MANAGER', 'FINANCE_MANAGER', 'RISK_MANAGER', 
      'OPERATIONS_MANAGER', 'KYC_OFFICER', 'DEALER', 'SUPPORT_AGENT', 'ANALYST', 
      'READ_ONLY_AUDITOR', 'USER'
    ];

    if (!validRoles.includes(role)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_ROLE', message: `Invalid role '${role}'` } });
      return;
    }

    const target = await queryOne<any>('SELECT id, username, email, role FROM users WHERE id = $1', [userId]);
    if (!target) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }

    if (target.role === role) {
      res.json({ success: true, message: `User is already assigned role '${role}'` });
      return;
    }

    await execute('UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2', [role, userId]);

    await logAuditAction(
      req.user!.userId, req.user!.role,
      'ADMIN_CHANGED_USER_ROLE', 'USER', userId,
      { oldRole: target.role }, { newRole: role }, getClientIp(req)
    );

    adminEventBus.emitUserEvent('USER_PROFILE_UPDATED', userId, { role });

    res.json({ success: true, message: `Role for ${target.username} successfully updated to ${role}.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST: Toggle Single Permission for User
router.post('/permissions/toggle-permission', authenticateToken, checkPermission('MANAGE_ROLES_PERMISSIONS'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, permissionKey, granted } = req.body;
    if (!userId || !permissionKey) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'userId and permissionKey are required' } });
      return;
    }

    const id = 'perm_' + generateUUID();
    await execute(
      `INSERT INTO manager_permissions (id, manager_id, permission_key, granted, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (manager_id, permission_key)
       DO UPDATE SET granted = EXCLUDED.granted`,
      [id, userId, permissionKey, Boolean(granted)]
    );

    await logAuditAction(
      req.user!.userId, req.user!.role,
      'ADMIN_TOGGLED_USER_PERMISSION', 'USER', userId,
      null, { permissionKey, granted: Boolean(granted) }, getClientIp(req)
    );

    res.json({ success: true, message: `Permission '${permissionKey}' updated.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST: Save User Profile, Role, Granular Permissions & Capacity Limits in One Call
router.post('/permissions/save-user-permissions', authenticateToken, checkPermission('MANAGE_ROLES_PERMISSIONS'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, role, permissions, limits } = req.body;
    if (!userId) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'userId is required' } });
      return;
    }

    const target = await queryOne<any>('SELECT id, username, role FROM users WHERE id = $1', [userId]);
    if (!target) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }

    await withTransaction(async (client) => {
      // 1. Update role if specified
      if (role && role !== target.role) {
        await client.query('UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2', [role, userId]);
      }

      // 2. Update permissions if provided
      if (permissions && typeof permissions === 'object') {
        for (const [key, val] of Object.entries(permissions)) {
          const permId = 'perm_' + generateUUID();
          await client.query(
            `INSERT INTO manager_permissions (id, manager_id, permission_key, granted, created_at)
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT (manager_id, permission_key)
             DO UPDATE SET granted = EXCLUDED.granted`,
            [permId, userId, key, Boolean(val)]
          );
        }
      }

      // 3. Update manager limits if provided
      if (limits && typeof limits === 'object') {
        await client.query(
          `INSERT INTO manager_limits (manager_id, max_users, max_accounts, max_exposure_per_user, max_deposit_approval, max_withdrawal_approval, max_daily_loss_cap, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
           ON CONFLICT (manager_id)
           DO UPDATE SET
             max_users = COALESCE(EXCLUDED.max_users, manager_limits.max_users),
             max_accounts = COALESCE(EXCLUDED.max_accounts, manager_limits.max_accounts),
             max_exposure_per_user = COALESCE(EXCLUDED.max_exposure_per_user, manager_limits.max_exposure_per_user),
             max_deposit_approval = COALESCE(EXCLUDED.max_deposit_approval, manager_limits.max_deposit_approval),
             max_withdrawal_approval = COALESCE(EXCLUDED.max_withdrawal_approval, manager_limits.max_withdrawal_approval),
             max_daily_loss_cap = COALESCE(EXCLUDED.max_daily_loss_cap, manager_limits.max_daily_loss_cap),
             updated_at = NOW()`,
          [
            userId,
            limits.maxUsers ?? 100,
            limits.maxAccounts ?? 100,
            limits.maxExposurePerUser ?? 1000000,
            limits.maxDepositApproval ?? 50000,
            limits.maxWithdrawalApproval ?? 25000,
            limits.maxDailyLossCap ?? 100000
          ]
        );
      }
    });

    await logAuditAction(
      req.user!.userId, req.user!.role,
      'ADMIN_UPDATED_USER_PERMISSIONS_AND_LIMITS', 'USER', userId,
      { oldRole: target.role }, { newRole: role, permissions, limits }, getClientIp(req)
    );

    res.json({ success: true, message: `Permissions & limits for ${target.username} saved successfully.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// 31. SUPPORT TICKET QUEUE (Admin Response)
// Migration 019 added `admin_notes` to support_tickets anticipating a
// POST /admin/support/tickets/:id/status route — that route was never
// actually built. Customers could submit tickets and see "Our team will
// respond shortly," but no admin route, UI, or way to respond existed at
// all. Built here, end-to-end, including the customer-facing display fix
// in ProfilePage.tsx so a written response actually becomes visible.
// ============================================================
router.get('/support/tickets', authenticateToken, checkPermission('SUPPORT_TICKETS_VIEW'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string || '50', 10), 200);
    const offset = parseInt(req.query.offset as string || '0', 10);
    const status = req.query.status as string || '';
    const category = req.query.category as string || '';
    const priority = req.query.priority as string || '';

    let where = 'WHERE 1=1';
    const params: any[] = [];
    let idx = 1;
    if (status) { where += ` AND t.status = $${idx}`; params.push(status); idx++; }
    if (category) { where += ` AND t.category = $${idx}`; params.push(category); idx++; }
    if (priority) { where += ` AND t.priority = $${idx}`; params.push(priority); idx++; }
    if (req.user!.role === 'MANAGER') {
      where += ` AND t.user_id IN (SELECT user_id FROM manager_assignments WHERE manager_id = $${idx})`;
      params.push(req.user!.userId);
      idx++;
    }

    const countRow = await queryOne<any>(`SELECT COUNT(*) as c FROM support_tickets t ${where}`, params);
    const tickets = await query<any>(
      `SELECT t.*, u.username, u.email, u.client_id
       FROM support_tickets t
       JOIN users u ON t.user_id = u.id
       ${where}
       ORDER BY CASE t.status WHEN 'OPEN' THEN 0 WHEN 'IN_PROGRESS' THEN 1 ELSE 2 END, t.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    res.json({ success: true, tickets, total: parseInt(countRow?.c || '0'), pagination: { limit, offset } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/support/tickets/:id/status', authenticateToken, checkPermission('SUPPORT_TICKETS_RESPOND'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ticketId = req.params.id as string;
    const { status, adminNotes } = req.body;
    const validStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
    if (status && !validStatuses.includes(status)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: `Status must be one of ${validStatuses.join(', ')}` } });
      return;
    }

    const existing = await queryOne<any>('SELECT * FROM support_tickets WHERE id = $1', [ticketId]);
    if (!existing) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Support ticket not found' } });
      return;
    }

    if (req.user!.role === 'MANAGER') {
      const assigned = await queryOne<any>('SELECT 1 FROM manager_assignments WHERE manager_id = $1 AND user_id = $2', [req.user!.userId, existing.user_id]);
      if (!assigned) {
        res.status(403).json({ success: false, error: { code: 'PERMISSION_DENIED', message: 'This ticket belongs to a customer outside your book.' } });
        return;
      }
    }

    const updated = await queryOne<any>(
      `UPDATE support_tickets SET status = COALESCE($1, status), admin_notes = COALESCE($2, admin_notes), updated_at = NOW() WHERE id = $3 RETURNING *`,
      [status || null, adminNotes !== undefined ? adminNotes : null, ticketId]
    );

    await logAuditAction(
      req.user!.userId, req.user!.role,
      'RESPOND_SUPPORT_TICKET', 'SUPPORT_TICKET', ticketId,
      { status: existing.status, admin_notes: existing.admin_notes },
      { status: updated?.status, admin_notes: updated?.admin_notes },
      getClientIp(req)
    );

    res.json({ success: true, ticket: updated, message: 'Support ticket updated.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// LIVE CHAT (admin side) — Support Chats, the last of the four
// deferred items from Phase F1's gap analysis, built on request.
// Real-time delivery reuses the same WS gateway Phase E1 wired up
// (ADMIN_SUBSCRIBE / ADMIN_SUBSCRIBE_ALL); these REST routes cover
// history load and the send/read fallback path.
// ============================================================
router.get('/chat/conversations', authenticateToken, checkPermission('SUPPORT_CHAT_VIEW'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isManager = req.user!.role === 'MANAGER';
    const conversations = await query<any>(
      `SELECT u.id AS customer_id, u.username, u.email, u.client_id,
              latest.message AS last_message, latest.created_at AS last_message_at, latest.sender_role AS last_sender_role,
              (SELECT COUNT(*) FROM chat_messages WHERE customer_id = u.id AND sender_role = 'USER' AND read_at IS NULL) AS unread_count
       FROM users u
       JOIN LATERAL (
         SELECT message, created_at, sender_role FROM chat_messages WHERE customer_id = u.id ORDER BY created_at DESC LIMIT 1
       ) latest ON true
       WHERE u.role = 'USER' AND ($1 = FALSE OR u.id IN (SELECT user_id FROM manager_assignments WHERE manager_id = $2))
       ORDER BY (SELECT COUNT(*) FROM chat_messages WHERE customer_id = u.id AND sender_role = 'USER' AND read_at IS NULL) DESC,
                latest.created_at DESC
       LIMIT 100`,
      [isManager, req.user!.userId]
    );
    res.json({ success: true, conversations });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// `restrictManagerToOwnCustomer` reads req.params.id (the file-wide convention, see
// /customers/:id above) — using :id here too rather than :customerId so the shared
// middleware actually applies instead of silently reading undefined and 403ing every
// manager unconditionally.
router.get('/chat/:id/messages', authenticateToken, checkPermission('SUPPORT_CHAT_VIEW'), restrictManagerToOwnCustomer, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const messages = await getChatHistory(req.params.id as string);
    res.json({ success: true, messages });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/chat/:id/messages', authenticateToken, checkPermission('SUPPORT_CHAT_RESPOND'), restrictManagerToOwnCustomer, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.params.id as string;
    const { text } = req.body;
    if (!text || typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ success: false, error: { code: 'MISSING_TEXT', message: 'Message text is required' } });
      return;
    }
    const row = await recordChatMessage(customerId, req.user!.userId, req.user!.role, text.trim().slice(0, 4000));
    const payload = { type: 'CHAT_MESSAGE_RECEIVED', userId: customerId, data: { message: row }, timestamp: Date.now() };
    deliverToUser(customerId, payload);
    deliverToUser(req.user!.userId, payload);
    res.status(201).json({ success: true, message: row });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/chat/:id/read', authenticateToken, checkPermission('SUPPORT_CHAT_VIEW'), restrictManagerToOwnCustomer, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await markChatReadByStaff(req.params.id as string);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// EMAIL & NOTIFICATION MANAGEMENT (Hostinger SMTP Relay)
// ============================================================

router.get('/email/config', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { EmailService } = await import('../services/EmailService');
    const config = await EmailService.getInstance().getConfig();
    res.json({
      success: true,
      config: {
        ...config,
        smtpPass: config.smtpPass ? '••••••••' : '',
        hasPassword: !!config.smtpPass,
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

router.post('/email/config', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { EmailService } = await import('../services/EmailService');
    const { smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass, emailFrom, enabled, highPriorityOnly, requireRegistrationOtp, notifyOrders, notifyFunds, notifyKyc, notifySecurity, superAdminAlertEmail, superAdminNotificationsEnabled } = req.body;
    
    const updatePayload: any = {};
    if (smtpHost !== undefined) updatePayload.smtpHost = String(smtpHost).trim();
    if (smtpPort !== undefined) updatePayload.smtpPort = parseInt(smtpPort, 10);
    if (smtpSecure !== undefined) updatePayload.smtpSecure = Boolean(smtpSecure);
    if (smtpUser !== undefined) updatePayload.smtpUser = String(smtpUser).trim();
    if (smtpPass !== undefined && smtpPass !== '••••••••' && String(smtpPass).trim() !== '') {
      updatePayload.smtpPass = String(smtpPass).trim();
    }
    if (emailFrom !== undefined) updatePayload.emailFrom = String(emailFrom).trim();
    if (enabled !== undefined) updatePayload.enabled = Boolean(enabled);
    if (highPriorityOnly !== undefined) updatePayload.highPriorityOnly = Boolean(highPriorityOnly);
    if (requireRegistrationOtp !== undefined) updatePayload.requireRegistrationOtp = Boolean(requireRegistrationOtp);
    if (notifyOrders !== undefined) updatePayload.notifyOrders = Boolean(notifyOrders);
    if (notifyFunds !== undefined) updatePayload.notifyFunds = Boolean(notifyFunds);
    if (notifyKyc !== undefined) updatePayload.notifyKyc = Boolean(notifyKyc);
    if (notifySecurity !== undefined) updatePayload.notifySecurity = Boolean(notifySecurity);
    if (superAdminAlertEmail !== undefined) updatePayload.superAdminAlertEmail = String(superAdminAlertEmail).trim();
    if (superAdminNotificationsEnabled !== undefined) updatePayload.superAdminNotificationsEnabled = Boolean(superAdminNotificationsEnabled);

    const updated = await EmailService.getInstance().updateConfig(updatePayload);
    res.json({
      success: true,
      message: 'Email & SMTP settings updated successfully.',
      config: {
        ...updated,
        smtpPass: updated.smtpPass ? '••••••••' : '',
        hasPassword: !!updated.smtpPass,
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

router.post('/email/verify', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { EmailService } = await import('../services/EmailService');
    const { smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass } = req.body || {};
    
    let testConfig: any = undefined;
    if (smtpHost && smtpUser && smtpPass && smtpPass !== '••••••••') {
      testConfig = {
        smtpHost: String(smtpHost).trim(),
        smtpPort: parseInt(smtpPort || 465, 10),
        smtpSecure: smtpSecure ?? true,
        smtpUser: String(smtpUser).trim(),
        smtpPass: String(smtpPass).trim(),
      };
    }

    const result = await EmailService.getInstance().verifyConnection(testConfig);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: `SMTP verification error: ${err.message}` });
  }
});

router.post('/email/test-send', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { EmailService } = await import('../services/EmailService');
    const { toEmail } = req.body;
    if (!toEmail || typeof toEmail !== 'string' || !toEmail.includes('@')) {
      res.status(400).json({ success: false, message: 'Valid recipient email address is required.' });
      return;
    }

    const result = await EmailService.getInstance().sendTestEmail(toEmail.trim());
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: `Failed to dispatch test email: ${err.message}` });
  }
});

router.get('/email/logs', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { EmailService } = await import('../services/EmailService');
    const limit = parseInt(req.query.limit as string || '50', 10);
    const logs = await EmailService.getInstance().getDeliveryLogs(limit);
    res.json({ success: true, logs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// ============================================================
// MANUAL EMAIL TRIGGERS, CLIENT EMAIL TOGGLE & BROADCASTS
// ============================================================

/**
 * Toggle email notifications for a specific client (Admin control)
 */
router.patch('/customers/:id/email-preference', authenticateToken, checkPermission('CUSTOMERS_PROFILE_EDIT'), restrictManagerToOwnCustomer, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = String(req.params.id);
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Field "enabled" (boolean) is required' } });
      return;
    }

    const updated = await queryOne<any>(
      `UPDATE users SET email_notifications_enabled = $1, updated_at = NOW() WHERE id = $2 RETURNING id, username, email, email_notifications_enabled`,
      [enabled, customerId]
    );

    if (!updated) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });
      return;
    }

    await logAuditAction(req.user!.userId, req.user!.role, 'CUSTOMER_EMAIL_PREF_UPDATE', 'USER', customerId, undefined, { enabled }, getClientIp(req));

    res.json({
      success: true,
      message: `Email notifications ${enabled ? 'enabled' : 'disabled'} for ${updated.username}`,
      emailNotificationsEnabled: updated.email_notifications_enabled
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

/**
 * Trigger a manual email reminder / offer / activation bonus to a specific client
 */
router.post('/customers/:id/send-email', authenticateToken, checkPermission('ADMIN_BROAD_VIEW'), restrictManagerToOwnCustomer, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = String(req.params.id);
    const { type, customSubject, customBody, bonusAmount, headline, offerTitle, promoCode, bonusText, actionUrl, actionLabel } = req.body;

    const user = await queryOne<any>(
      `SELECT id, username, email, full_name, client_id, email_notifications_enabled FROM users WHERE id = $1`,
      [customerId]
    );

    if (!user) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });
      return;
    }

    if (!user.email) {
      res.status(400).json({ success: false, error: { code: 'NO_EMAIL', message: 'Customer does not have an email address configured' } });
      return;
    }

    const { EmailService } = await import('../services/EmailService');
    const emailService = EmailService.getInstance();

    switch (type) {
      case 'KYC_REMINDER':
        await emailService.sendKycReminderEmail({
          id: user.id,
          email: user.email,
          name: user.full_name || user.username,
          clientId: user.client_id
        });
        break;

      case 'OFFER':
        await emailService.sendOfferBroadcastEmail(
          { id: user.id, email: user.email, name: user.full_name || user.username },
          {
            title: offerTitle || 'Exclusive Trader Privilege & Margin Boost',
            subject: customSubject,
            offerDetails: customBody,
            promoCode,
            bonusText,
            actionUrl,
            actionLabel
          }
        );
        break;

      case 'BONUS':
      case 'ACCOUNT_ACTIVATION':
        await emailService.sendAccountBonusEmail(
          { id: user.id, email: user.email, name: user.full_name || user.username },
          {
            bonusAmount: bonusAmount ? parseFloat(bonusAmount) : 1000,
            headline: headline || 'Account Activation & First Trade Bonus',
            description: customBody,
            actionUrl
          }
        );
        break;

      case 'CUSTOM':
      default:
        if (!customSubject || !customBody) {
          res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Subject and body are required for custom email' } });
          return;
        }
        emailService.sendMailAsync({
          to: user.email,
          subject: customSubject,
          html: customBody,
          templateType: 'ADMIN_CUSTOM',
          userId: user.id,
          priority: 'HIGH'
        });
        break;
    }

    await logAuditAction(req.user!.userId, req.user!.role, 'ADMIN_TRIGGER_EMAIL', 'USER', customerId, undefined, { type, to: user.email }, getClientIp(req));

    res.json({
      success: true,
      message: `Email notification (${type}) queued successfully for ${user.username} <${user.email}>`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

/**
 * Broadcast an email campaign to a segment of clients (All, KYC Pending, or Active)
 */
router.post('/email/broadcast', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { type, targetAudience, customSubject, customBody, bonusAmount, headline, offerTitle, promoCode, bonusText, actionUrl, actionLabel } = req.body;

    let whereClause = 'WHERE email IS NOT NULL AND email != \'\'';
    if (targetAudience === 'KYC_PENDING') {
      whereClause += ' AND is_kyc_completed = FALSE AND email_notifications_enabled = TRUE';
    } else if (targetAudience === 'ACTIVE_USERS') {
      whereClause += ' AND status = \'ACTIVE\' AND email_notifications_enabled = TRUE';
    } else {
      whereClause += ' AND email_notifications_enabled = TRUE';
    }

    const recipients = await query<any>(
      `SELECT id, username, email, full_name, client_id FROM users ${whereClause}`
    );

    if (recipients.length === 0) {
      res.json({ success: true, count: 0, message: 'No eligible recipients found matching the selected audience criteria.' });
      return;
    }

    const { EmailService } = await import('../services/EmailService');
    const emailService = EmailService.getInstance();

    // Asynchronously queue delivery to each recipient in batches
    setImmediate(async () => {
      for (const user of recipients) {
        try {
          if (type === 'KYC_REMINDER') {
            await emailService.sendKycReminderEmail({
              id: user.id,
              email: user.email,
              name: user.full_name || user.username,
              clientId: user.client_id
            });
          } else if (type === 'OFFER') {
            await emailService.sendOfferBroadcastEmail(
              { id: user.id, email: user.email, name: user.full_name || user.username },
              {
                title: offerTitle || 'Special Trader Privilege',
                subject: customSubject,
                offerDetails: customBody,
                promoCode,
                bonusText,
                actionUrl,
                actionLabel
              }
            );
          } else if (type === 'BONUS' || type === 'ACCOUNT_ACTIVATION') {
            await emailService.sendAccountBonusEmail(
              { id: user.id, email: user.email, name: user.full_name || user.username },
              {
                bonusAmount: bonusAmount ? parseFloat(bonusAmount) : 1000,
                headline: headline || 'First Trade Bonus',
                description: customBody,
                actionUrl
              }
            );
          } else {
            emailService.sendMailAsync({
              to: user.email,
              subject: customSubject || 'Important Announcement from TradeGrow',
              html: customBody || '',
              templateType: 'EMAIL_BROADCAST',
              userId: user.id,
              priority: 'NORMAL'
            });
          }
        } catch (e: any) {
          console.error(`[EmailBroadcast] Error dispatching to ${user.email}:`, e.message);
        }
      }
    });

    await logAuditAction(req.user!.userId, req.user!.role, 'EMAIL_BROADCAST_TRIGGER', 'SYSTEM', undefined, undefined, {
      type, targetAudience, recipientCount: recipients.length
    }, getClientIp(req));

    res.json({
      success: true,
      count: recipients.length,
      message: `Email broadcast successfully initiated to ${recipients.length} recipients.`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

export default router;
