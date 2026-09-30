import { Router, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { queryOne, execute } from '../db/schema';
import { SSOTicketPayload, SSOTicketExchangeRequest, SSOTicketExchangeResponse } from '../contracts/SSO';
import { AdvisoryRecommendationPayload, AdvisoryOrderPreviewResponse } from '../contracts/Advisory';

export const ssoRouter = Router();

export const STAFF_ROLES = new Set([
  'SUPER_ADMIN',
  'ADMIN',
  'COMPLIANCE_OFFICER',
  'RESEARCH_ANALYST',
  'RESEARCH_HEAD',
  'CRM_AGENT',
  'RMS_MANAGER',
  'STAFF',
]);

export function isStaffRole(role: string): boolean {
  return STAFF_ROLES.has((role || '').toUpperCase());
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return secret;
}

// In-memory consumed nonce cache to prevent SSO ticket replay attacks
const consumedSsoNonces = new Set<string>();

/**
 * GET /api/v1/auth/sso/staff-desks
 * Returns available internal management desks for employees/staff.
 * Strictly blocked for retail clients to preserve complete brand and data segregation.
 */
ssoRouter.get('/staff-desks', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const role = req.user?.role || '';
  if (!isStaffRole(role)) {
    res.status(403).json({
      success: false,
      error: {
        code: 'ACCESS_DENIED',
        message: 'This feature is strictly reserved for authorized employees and staff.',
      },
    });
    return;
  }

  res.json({
    success: true,
    isStaff: true,
    userRole: role,
    desks: [
      {
        id: 'tradegrow_broker',
        name: 'TradeGrow Brokerage & RMS War Room',
        domain: 'tradegrowx.in',
        portalUrl: '/admin',
        description: 'OMS/RMS risk surveillance, client 360, ledger, deposits & trading executions',
        active: true,
      },
      {
        id: 'expert_stocks_advisory',
        name: 'Expert Stocks Advisory & CRM Desk',
        domain: 'expertstocks.in',
        portalUrl: 'https://expertstocks.in/office',
        description: 'Research report publishing, SEBI compliance audit, telecaller desk & lead funnel',
        active: false,
      },
    ],
  });
});

/**
 * POST /api/v1/auth/sso/ticket
 * Generates an employee SSO switch ticket.
 * Enforces strict SEBI Chinese Wall: Client accounts cannot be merged across platforms.
 */
ssoRouter.post('/ticket', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
      return;
    }

    const user = await queryOne<any>(
      `SELECT id, username, email, phone_number, role, client_id, kyc_status 
       FROM users 
       WHERE id = $1`,
      [userId]
    );

    if (!user) {
      res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User record not found' } });
      return;
    }

    const userIsStaff = isStaffRole(user.role);

    // If client attempts cross-system SSO merge, reject with clear SEBI segregation explanation
    if (!userIsStaff) {
      res.status(403).json({
        success: false,
        error: {
          code: 'SEBI_CHINESE_WALL_SEGREGATION',
          message: 'TradeGrow and Expert Stocks are independent entities. Client accounts remain strictly separated and cannot be merged.',
        },
      });
      return;
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const nonce = crypto.randomUUID();

    const payload: SSOTicketPayload & { isStaff: boolean } = {
      sub: user.id,
      clientCode: user.client_id || user.username || user.id,
      phoneE164: user.phone_number || '',
      email: user.email,
      role: user.role,
      kycStatus: user.kyc_status || 'COMPLETED',
      scope: ['advisory.view', 'advisory.subscribe', 'crm.access', 'trading.execute'],
      nonce,
      iat: nowSec,
      exp: nowSec + 60, // 60 seconds validity
      isStaff: true,
    };

    const ticket = jwt.sign(payload, getJwtSecret(), { algorithm: 'HS256' });

    res.json({
      success: true,
      ticket,
      isStaff: true,
      expiresAt: payload.exp,
      expiresInSeconds: 60,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SSO_ERROR', message: err.message } });
  }
});

/**
 * POST /api/v1/auth/sso/exchange
 * Exchanges an employee SSO ticket for a valid session token on the target staff desk.
 */
ssoRouter.post('/exchange', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { ticket, targetApp } = req.body as SSOTicketExchangeRequest;

    if (!ticket) {
      res.status(400).json({ success: false, error: { code: 'INVALID_REQUEST', message: 'SSO ticket is required' } });
      return;
    }

    let decoded: any;
    try {
      decoded = jwt.verify(ticket, getJwtSecret());
    } catch (err: any) {
      res.status(401).json({ success: false, error: { code: 'INVALID_TICKET', message: 'Ticket expired or signature invalid' } });
      return;
    }

    // Replay protection: check and mark nonce
    if (consumedSsoNonces.has(decoded.nonce)) {
      res.status(401).json({ success: false, error: { code: 'TICKET_ALREADY_USED', message: 'This SSO ticket has already been consumed' } });
      return;
    }
    consumedSsoNonces.add(decoded.nonce);

    // Evict old nonces after 2 minutes
    setTimeout(() => consumedSsoNonces.delete(decoded.nonce), 120000);

    // Ensure only staff tickets can be exchanged across desks
    if (!decoded.isStaff && !isStaffRole(decoded.role)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'SEBI_CHINESE_WALL_SEGREGATION',
          message: 'Client accounts cannot be merged between TradeGrow and Expert Stocks.',
        },
      });
      return;
    }

    // Fetch employee details
    const user = await queryOne<any>(
      `SELECT id, username, email, phone_number, role, status 
       FROM users 
       WHERE id = $1`,
      [decoded.sub]
    );

    if (!user || user.status !== 'ACTIVE') {
      res.status(403).json({ success: false, error: { code: 'ACCOUNT_DISABLED', message: 'Employee account is inactive or disabled' } });
      return;
    }

    // Issue application token for employee
    const token = jwt.sign(
      { userId: user.id, username: user.username, email: user.email, role: user.role, isStaff: true, targetApp: targetApp || 'EXPERT_STOCKS' },
      getJwtSecret(),
      { expiresIn: '12h' }
    );

    const responseData: SSOTicketExchangeResponse = {
      success: true,
      accessToken: token,
      user: {
        id: user.id,
        phone: user.phone_number || '',
        email: user.email,
        name: user.username,
        role: user.role,
      },
    };

    res.json(responseData);
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'EXCHANGE_ERROR', message: err.message } });
  }
});

/**
 * POST /api/v1/advisory/preview-order
 * Decoupled 1-Click Advisory Order Intent Preview (SEBI Chinese Wall compliant)
 * Allows client to preview an advisory trade in TradeGrow without merging their client account with Expert Stocks.
 */
ssoRouter.post('/advisory/preview-order', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const payload = req.body as AdvisoryRecommendationPayload;

    if (!payload.symbol || !payload.action || !payload.targetPrice) {
      res.status(400).json({ success: false, error: { code: 'INVALID_PAYLOAD', message: 'Missing recommendation fields' } });
      return;
    }

    const preview: AdvisoryOrderPreviewResponse = {
      symbol: payload.symbol,
      exchange: payload.exchange || 'NSE',
      action: payload.action,
      productType: payload.productType || 'CNC',
      targetPrice: payload.targetPrice,
      stopLoss: payload.stopLoss,
      advisoryReportId: payload.advisoryReportId || '',
      analystName: payload.analystName || 'SEBI Registered Research Analyst',
      analystRegNumber: payload.analystRegNumber || 'INH000000000',
      disclaimer: 'DISCLAIMER: Investments in securities market are subject to market risks. Read all scheme related documents carefully before investing. TradeGrow and Expert Stocks are independent entities. TradeGrow provides execution-only brokerage and is not liable for performance of recommendations provided by independent registered analysts.',
    };

    res.json({ success: true, preview });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'ADVISORY_PREVIEW_ERROR', message: err.message } });
  }
});
