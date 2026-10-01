import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import argon2 from 'argon2';
import rateLimit from 'express-rate-limit';
import { query, queryOne, execute, withTransaction } from '../db/schema';
import { authenticateToken, checkRole, checkPermission, AuthenticatedRequest, getJwtSecret, getRefreshSecret } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  RegisterSchema, LoginSchema, SubmitOrderSchema,
  AddWatchlistItemSchema, CreateWatchlistSchema,
  AdminAdjustBalanceSchema, UpdateRiskSettingSchema,
  UpdateUserStatusSchema, UpdateUserRoleSchema
} from '../middleware/schemas';
import { logAuditAction } from '../middleware/audit';
import { VirtualWalletLedger } from '../trading/VirtualWalletLedger';
import { emitAdminFundRequestEvent, emitAdminFundsUpdate } from '../utils/adminEventBus';
import { createAdminNotification } from '../utils/adminNotifications';
import { recordChatMessage, getChatHistory } from '../utils/chatMessages';
import { maybeGenerateSupportBotReply } from '../utils/supportBot';
import { deliverToUser } from '../websocket/server';
import { OMS } from '../trading/OMS';
import { PortfolioService } from '../trading/PortfolioService';
import { MarketDataEngine } from '../marketData/MarketDataEngine';
import { GreeksEngine } from '../marketData/GreeksEngine';
import { MarketDataStorageService } from '../services/MarketDataStorageService';
import { InstrumentMasterService } from '../marketData/InstrumentMasterService';
import { generateUUID } from '../utils/crypto';
import { SafetyLock } from '../services/SafetyLock';
import { checkDatabaseHealth } from '../db/pool';
import { kycUpload } from '../middleware/upload';
import { ClientCreationService } from '../services/ClientCreationService';
import { DiditService } from '../services/diditService';
import { gttEngine } from '../trading/GttEngine';
import { priceAlertEngine } from '../trading/PriceAlertEngine';
import { calculateHedgedPortfolioMargin } from '../trading/MarginMath';
import { updateFyersToken, setFyersAdapterRef, generateFyersAuthUrl, exchangeAuthCodeForToken } from '../utils/fyersTokenRefresh';

import { RedisStore } from 'rate-limit-redis';
import { redis } from '../db/redis';

/** Helper to safely extract client IP address from request */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
  return req.ip ?? '127.0.0.1';
}

const router = Router();

// Helper to instantiate distributed Redis-backed rate limiter store
const getRedisStore = (prefix: string) => {
  const rawClient = redis.getRawClient();
  if (!rawClient) return undefined;
  return new RedisStore({
    sendCommand: (...args: string[]) => (rawClient as any).call(...args),
    prefix: `ratelimit:${prefix}:`,
  });
};

// ============================================================
// RATE LIMITERS (DISTRIBUTED REDIS-BACKED)
// ============================================================
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 500 : 50,
  validate: { ip: false },
  store: getRedisStore('auth'),
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Please wait 15 minutes.' } },
  standardHeaders: true,
  legacyHeaders: false
});

const orderLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'development' ? 500 : 30,
  keyGenerator: (req: any) => req.user?.userId || getClientIp(req),
  validate: { ip: false, keyGeneratorIpFallback: false },
  store: getRedisStore('order'),
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Order submission rate limit exceeded. Max 30 orders/minute.' } }
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 10000 : 2000,
  validate: { ip: false },
  store: getRedisStore('api'),
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'API rate limit exceeded.' } }
});

// Apply general rate limiter to all routes
router.use(apiLimiter);

// ============================================================
// 1. HEALTH & SYSTEM INFO
// ============================================================
router.get('/health', async (req: Request, res: Response) => {
  const dbHealth = await checkDatabaseHealth();
  const mdProvider = MarketDataEngine.getInstance().getActiveProviderName();
  res.json({
    status: dbHealth.healthy ? 'HEALTHY' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    service: 'StockSharp Trading API',
    version: '1.0.0',
    uptimeSeconds: Math.floor(process.uptime()),
    realMoneyTradingAllowed: SafetyLock.REAL_MONEY_TRADING_ALLOWED,
    marketDataProvider: mdProvider,
    database: { healthy: dbHealth.healthy, latencyMs: dbHealth.latencyMs, pool: dbHealth.pool, error: dbHealth.error }
  });
});

router.get('/health/live', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ALIVE', timestamp: Date.now() });
});

router.get('/health/ready', async (req: Request, res: Response) => {
  const db = await checkDatabaseHealth();
  if (!db.healthy) {
    return res.status(503).json({ ready: false, reason: 'Database connection failed', error: db.error });
  }
  res.status(200).json({ ready: true, pool: db.pool });
});

router.get('/health/dependencies', async (req: Request, res: Response) => {
  const { redis } = await import('../db/redis');
  const { getWebSocketMetrics } = await import('../websocket/server');
  const dbHealth = await checkDatabaseHealth();
  const redisHealth = await redis.getHealthMetrics();
  const wsMetrics = getWebSocketMetrics();
  const memory = process.memoryUsage();

  const dependenciesHealthy = dbHealth.healthy && (redisHealth.connected || redisHealth.mode === 'IN_MEMORY_FALLBACK');

  res.status(dependenciesHealthy ? 200 : 503).json({
    status: dependenciesHealthy ? 'HEALTHY' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    process: {
      uptimeSeconds: Math.floor(process.uptime()),
      memoryRssMB: (memory.rss / 1024 / 1024).toFixed(2),
      heapUsedMB: (memory.heapUsed / 1024 / 1024).toFixed(2),
      heapTotalMB: (memory.heapTotal / 1024 / 1024).toFixed(2)
    },
    database: {
      healthy: dbHealth.healthy,
      latencyMs: dbHealth.latencyMs,
      pool: dbHealth.pool,
      error: dbHealth.error
    },
    redis: redisHealth,
    marketData: {
      activeProvider: MarketDataEngine.getInstance().getActiveProviderName(),
      cachedTicksCount: MarketDataEngine.getInstance().getAllCachedTicks().length
    },
    websocket: wsMetrics
  });
});

/**
 * Market-data pipeline metrics (Phase 16).
 * Surfaces the numbers that actually predict server load: how many provider
 * connections exist, how many instruments are subscribed upstream, tick throughput,
 * and how many distinct option-chain views are being computed.
 */
router.get('/health/pipeline', async (req: Request, res: Response) => {
  const { getWebSocketMetrics, getConnectedClientCount } = await import('../websocket/server');
  const { optionChainBroadcaster } = await import('../marketData/OptionChainBroadcasterService');
  const engine = MarketDataEngine.getInstance();
  const memory = process.memoryUsage();

  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    feed: engine.getFeedHealth(),
    pipeline: engine.getPipelineMetrics(),
    optionChain: optionChainBroadcaster.getMetrics(),
    websocket: { ...getWebSocketMetrics(), connectedClients: getConnectedClientCount() },
    process: {
      uptimeSeconds: Math.floor(process.uptime()),
      memoryRssMB: Number((memory.rss / 1024 / 1024).toFixed(2)),
      heapUsedMB: Number((memory.heapUsed / 1024 / 1024).toFixed(2)),
      heapTotalMB: Number((memory.heapTotal / 1024 / 1024).toFixed(2)),
      externalMB: Number((memory.external / 1024 / 1024).toFixed(2))
    }
  });
});

router.get('/health/instruments', (req, res) => {
  const status = InstrumentMasterService.getInstance().getHealthStatus();
  res.status(status.isReady ? 200 : 503).json({ success: true, ...status });
});


// ============================================================
// 2. AUTHENTICATION & BROKER OAUTH API
// ============================================================
router.get('/auth/fyers/login', (req: Request, res: Response) => {
  const appId = String(req.query.appId || process.env.FYERS_APP_ID || 'P3U524USN6-100');
  const redirectUri = String(req.query.redirectUri || process.env.FYERS_REDIRECT_URI || 'https://tradegrowx.in/api/v1/auth/fyers/callback');
  const state = String(req.query.state || 'tradegrow_state');
  const authUrl = generateFyersAuthUrl(appId, redirectUri, state);

  if (req.headers.accept?.includes('application/json') && !req.query.redirect) {
    return res.json({ success: true, authUrl });
  }
  return res.redirect(authUrl);
});

router.get('/auth/fyers/callback', async (req: Request, res: Response) => {
  const authCode = String(req.query.auth_code || req.query.code || '');
  const appId = String(process.env.FYERS_APP_ID || 'P3U524USN6-100');
  const appSecret = String(process.env.FYERS_SECRET_KEY || 'SJULLJNM11');

  if (!authCode) {
    const loginUrl = '/api/v1/auth/fyers/login';
    return res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Connect Fyers Market Data - Trade Grow</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #080D14; color: #F1F5F9; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1rem; }
    .card { background: #0E1726; border: 1px solid #1E293B; padding: 2.5rem 2rem; border-radius: 1rem; max-width: 480px; width: 100%; text-align: center; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
    .badge { background: rgba(59, 130, 246, 0.15); color: #60A5FA; border: 1px solid rgba(59, 130, 246, 0.3); padding: 0.35rem 0.85rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; }
    h2 { margin: 1.25rem 0 0.5rem; font-size: 1.35rem; font-weight: 700; color: #FFFFFF; }
    p { color: #94A3B8; font-size: 0.875rem; line-height: 1.6; margin-bottom: 1.75rem; }
    .btn { background: #10B981; color: #022C22; padding: 0.85rem 1.75rem; border-radius: 0.5rem; font-weight: 700; text-decoration: none; display: inline-block; transition: all 0.2s; font-size: 0.95rem; }
    .btn:hover { background: #34D399; transform: translateY(-1px); }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">Trade Grow · Market Data Feed</span>
    <h2>Authorize Fyers Live Market Feed</h2>
    <p>Click below to sign in and grant permission for Trade Grow Engine (<code>${appId}</code>) to stream real-time market quotes from NSE, BSE & MCX.</p>
    <a class="btn" href="${loginUrl}">Authorize Fyers Feed →</a>
  </div>
</body>
</html>`);
  }

  try {
    const engine = MarketDataEngine.getInstance();
    const fyersProvider = (engine as any).providers?.get('FYERS');
    if (fyersProvider) {
      setFyersAdapterRef(fyersProvider);
    }

    const result = await exchangeAuthCodeForToken(authCode, appId, appSecret);

    if (result.success && result.accessToken) {
      return res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Fyers Connected - Trade Grow</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #080D14; color: #F1F5F9; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1rem; }
    .card { background: #0E1726; border: 1px solid #1E293B; padding: 2.5rem 2rem; border-radius: 1rem; max-width: 480px; width: 100%; text-align: center; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
    .badge { background: rgba(16, 185, 129, 0.15); color: #34D399; border: 1px solid rgba(16, 185, 129, 0.3); padding: 0.35rem 0.85rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; }
    h2 { margin: 1.25rem 0 0.5rem; font-size: 1.35rem; font-weight: 700; color: #FFFFFF; }
    p { color: #94A3B8; font-size: 0.875rem; line-height: 1.6; margin-bottom: 1.5rem; }
    .details { background: #131F33; border-radius: 0.5rem; padding: 0.75rem; font-family: monospace; font-size: 0.8rem; color: #38BDF8; margin-bottom: 1.5rem; }
    .btn { background: #3B82F6; color: #FFFFFF; padding: 0.75rem 1.5rem; border-radius: 0.5rem; font-weight: 600; text-decoration: none; display: inline-block; font-size: 0.875rem; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">Connection Active</span>
    <h2>Fyers Market Data Connected!</h2>
    <p>The 24-hour access token has been generated and hot-swapped into Trade Grow Engine. Real-time multi-asset market data streaming is now live.</p>
    <div class="details">App ID: ${appId} · Feed Status: ACTIVE</div>
    <a class="btn" href="/">Return to Platform →</a>
  </div>
</body>
</html>`);
    }

    return res.status(400).send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Fyers Authorization Error - Trade Grow</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #080D14; color: #F1F5F9; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1rem; }
    .card { background: #0E1726; border: 1px solid #7F1D1D; padding: 2.5rem 2rem; border-radius: 1rem; max-width: 480px; width: 100%; text-align: center; }
    .badge { background: rgba(239, 68, 68, 0.15); color: #F87171; border: 1px solid rgba(239, 68, 68, 0.3); padding: 0.35rem 0.85rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; }
    h2 { margin: 1.25rem 0 0.5rem; font-size: 1.35rem; font-weight: 700; color: #EF4444; }
    p { color: #94A3B8; font-size: 0.875rem; line-height: 1.6; margin-bottom: 1.5rem; }
    .btn { background: #1E293B; color: #F1F5F9; padding: 0.75rem 1.5rem; border-radius: 0.5rem; font-weight: 600; text-decoration: none; display: inline-block; font-size: 0.875rem; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">Connection Failed</span>
    <h2>Token Exchange Failed</h2>
    <p>${result.message || 'Fyers auth code could not be exchanged for access token. It may have expired or already been used.'}</p>
    <a class="btn" href="/api/v1/auth/fyers/login">Try Again →</a>
  </div>
</body>
</html>`);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { message: err.message || 'Internal server error in Fyers OAuth callback' } });
  }
});
router.post('/auth/register-otp', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, username, phoneNumber, phone, mobileNumber } = req.body;
    const normEmail = (email || '').trim().toLowerCase();
    const cleanPhone = (phoneNumber || phone || mobileNumber || '').trim();

    if (!normEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail)) {
      res.status(400).json({ success: false, error: { message: 'A valid email address is required.' } });
      return;
    }

    // Check duplicate email & username
    const dupCheck = await ClientCreationService.checkDuplicate({
      email: normEmail,
      username: username ? String(username).trim() : undefined,
    });
    if (dupCheck.isDuplicate) {
      res.status(409).json({
        success: false,
        error: {
          code: `DUPLICATE_${(dupCheck.field || 'EMAIL').toUpperCase()}`,
          message: dupCheck.message || 'An account with these details already exists.'
        }
      });
      return;
    }

    // Check duplicate mobile if provided
    if (cleanPhone) {
      const existingPhone = await queryOne<any>(
        'SELECT id FROM users WHERE TRIM(phone_number) = $1 LIMIT 1',
        [cleanPhone]
      );
      if (existingPhone) {
        res.status(409).json({
          success: false,
          error: {
            code: 'DUPLICATE_PHONE',
            message: `An account already exists with mobile number '${cleanPhone}'.`
          }
        });
        return;
      }
    }

    // Generate 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const redisKey = `reg_otp:${normEmail}`;

    await redis.set(redisKey, otp, 600); // 10 minutes TTL

    // Dispatch branded registration OTP email
    const { EmailService } = await import('../services/EmailService');
    void EmailService.getInstance().sendRegistrationOtpEmail(normEmail, otp, username);

    res.json({
      success: true,
      message: `A 6-digit verification code has been sent to ${normEmail}.`,
      devOtp: process.env.NODE_ENV !== 'production' ? otp : undefined
    });
  } catch (err: any) {
    console.error('[API] /auth/register-otp error:', err);
    res.status(500).json({ success: false, error: { message: err.message || 'Failed to send verification code.' } });
  }
});

router.post('/auth/register', authLimiter, validateBody(RegisterSchema), async (req: Request, res: Response) => {
  try {
    const { username, email, password, phoneNumber, phone, mobileNumber, otp } = req.body;
    const normEmail = (email || '').trim().toLowerCase();
    const resolvedPhone = (phoneNumber || phone || mobileNumber || '').trim();

    // Check if Registration OTP verification is required
    const { EmailService } = await import('../services/EmailService');
    const emailConfig = await EmailService.getInstance().getConfig();

    if (emailConfig.requireRegistrationOtp) {
      const cleanOtp = String(otp || '').trim();
      if (!cleanOtp || cleanOtp.length !== 6) {
        res.status(400).json({
          success: false,
          error: { code: 'OTP_REQUIRED', message: 'A 6-digit email verification code is required.' }
        });
        return;
      }

      const redisKey = `reg_otp:${normEmail}`;
      const storedOtp = await redis.get(redisKey);

      if (!storedOtp) {
        res.status(400).json({
          success: false,
          error: { code: 'OTP_EXPIRED', message: 'Verification code expired or not requested. Please request a new code.' }
        });
        return;
      }

      if (storedOtp !== cleanOtp) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_OTP', message: 'Invalid verification code. Please check your email and try again.' }
        });
        return;
      }

      // Valid OTP: delete to prevent replay
      await redis.del(redisKey);
    }

    const result = await ClientCreationService.createClient({
      username,
      email: normEmail,
      password,
      phoneNumber: resolvedPhone,
      role: 'USER',
      creatorIp: getClientIp(req)
    });

    if (!result.success || !result.user) {
      const statusCode = result.error?.code?.startsWith('DUPLICATE_') ? 409 : 400;
      res.status(statusCode).json({
        success: false,
        error: result.error
      });
      return;
    }

    const newUser = {
      id: result.user.id,
      clientId: result.user.clientId,
      username: result.user.username,
      email: result.user.email,
      phoneNumber: result.user.phoneNumber,
      role: result.user.role
    };

    const token = jwt.sign(newUser, getJwtSecret(), { expiresIn: '24h' });
    const refreshToken = jwt.sign(newUser, getRefreshSecret(), { expiresIn: '30d' });

    // Super Admin Alert: New Client Registered
    try {
      EmailService.getInstance().sendSuperAdminAlert({
        subject: `New Client Registered: ${result.user.username} (${result.user.clientId || 'Client'})`,
        eventType: 'NEW_REGISTRATION',
        summary: `A new client has registered on TradeGrow Platform.`,
        details: [
          { label: 'Username', value: result.user.username },
          { label: 'Client ID', value: result.user.clientId || 'Pending' },
          { label: 'Email', value: result.user.email },
          { label: 'Phone', value: result.user.phoneNumber || 'Not provided' },
          { label: 'User ID', value: result.user.id },
          { label: 'Client IP', value: getClientIp(req) }
        ],
        actionUrl: `https://tradegrowx.in/admin?search=${encodeURIComponent(result.user.username)}`,
        actionLabel: 'View in Admin'
      });
    } catch (_) {}

    res.status(201).json({
      success: true,
      token,
      refreshToken,
      user: newUser
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/auth/login', authLimiter, validateBody(LoginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const normIdentifier = (email || '').trim();

    // Support login by normalized email, normalized username, uppercase client_id, or mobile number
    const user = await queryOne<any>(
      `SELECT * FROM users 
       WHERE LOWER(TRIM(email)) = LOWER($1) 
          OR LOWER(TRIM(username)) = LOWER($1)
          OR UPPER(TRIM(client_id)) = UPPER($1)
          OR TRIM(phone_number) = TRIM($1)
       LIMIT 1`,
      [normIdentifier]
    );

    if (!user) {
      res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
      return;
    }

    // Check account lockout
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const until = new Date(user.locked_until).toISOString();
      res.status(423).json({ success: false, error: { code: 'ACCOUNT_LOCKED', message: `Account locked until ${until}` } });
      return;
    }

    if (user.status !== 'ACTIVE') {
      res.status(403).json({ success: false, error: { code: 'ACCOUNT_DISABLED', message: 'Account is suspended or disabled' } });
      return;
    }

    // Verify password (Argon2id)
    let passwordValid = false;
    try {
      passwordValid = await argon2.verify(user.password_hash, password);
    } catch {
      passwordValid = false;
    }

    if (!passwordValid) {
      // Increment failed attempts
      const attempts = (user.failed_login_attempts || 0) + 1;
      const lockUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
      await execute(
        'UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3',
        [attempts, lockUntil, user.id]
      );
      res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
      return;
    }

    // Reset failed attempts on successful login
    await execute(
      'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE id = $1',
      [user.id]
    );

    const token = jwt.sign({ userId: user.id, username: user.username, email: user.email, role: user.role }, getJwtSecret(), { expiresIn: '24h' });
    const refreshToken = jwt.sign({ userId: user.id, username: user.username, email: user.email, role: user.role }, getRefreshSecret(), { expiresIn: '30d' });

    await logAuditAction(user.id, user.role, 'LOGIN', 'USER', user.id, null, null, getClientIp(req) ?? '127.0.0.1');

    res.json({ success: true, token, refreshToken, user: { id: user.id, username: user.username, email: user.email, role: user.role } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/auth/forgot-password', authLimiter, async (req: Request, res: Response) => {
  try {
    const { identifier } = req.body;
    const norm = (identifier || '').trim();
    if (!norm) {
      res.status(400).json({ success: false, error: 'Please enter your registered email, mobile number or username.' });
      return;
    }

    const user = await queryOne<any>(
      `SELECT id, email, username, phone_number, status FROM users
       WHERE LOWER(TRIM(email)) = LOWER($1)
          OR LOWER(TRIM(username)) = LOWER($1)
          OR TRIM(phone_number) = TRIM($1)
       LIMIT 1`,
      [norm]
    );

    if (!user) {
      res.json({
        success: true,
        message: 'If an account matches that identifier, a 6-digit verification OTP has been generated.'
      });
      return;
    }

    // Generate 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const redisKey = `pwd_reset_otp:${user.id}`;

    try {
      await redis.set(redisKey, otp, 600);
    } catch (_) {}

    // Record notification with OTP
    try {
      await execute(
        `INSERT INTO notifications (user_id, type, title, body, metadata)
         VALUES ($1, 'SYSTEM', 'Password Reset Verification OTP', $2, $3)`,
        [
          user.id,
          `Your password reset OTP is ${otp}. It will expire in 10 minutes. If you did not request this, please ignore.`,
          JSON.stringify({ otp, requestedAt: new Date().toISOString() })
        ]
      );
    } catch (_) {}

    // Dispatch OTP email to user's registered address
    if (user.email) {
      try {
        const { EmailService } = await import('../services/EmailService');
        void EmailService.getInstance().sendOtpEmail(user.email, otp, 'Password Reset');
      } catch (e: any) {
        console.warn('[API] Failed to trigger OTP email:', e.message);
      }
    }

    res.json({
      success: true,
      message: 'A 6-digit verification OTP has been generated.',
      userId: user.id,
      devOtp: process.env.NODE_ENV !== 'production' ? otp : undefined
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/auth/reset-password', authLimiter, async (req: Request, res: Response) => {
  try {
    const { identifier, userId, otp, newPassword } = req.body;
    if (!otp || !newPassword) {
      res.status(400).json({ success: false, error: 'OTP and new password are required.' });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({ success: false, error: 'Password must be at least 8 characters long.' });
      return;
    }

    let targetUserId = userId;
    if (!targetUserId && identifier) {
      const user = await queryOne<any>(
        `SELECT id FROM users
         WHERE LOWER(TRIM(email)) = LOWER($1)
            OR LOWER(TRIM(username)) = LOWER($1)
            OR TRIM(phone_number) = TRIM($1)
         LIMIT 1`,
        [identifier.trim()]
      );
      if (user) targetUserId = user.id;
    }

    if (!targetUserId) {
      res.status(400).json({ success: false, error: 'User account not found.' });
      return;
    }

    // Verify OTP from Redis or notification metadata
    let isValid = false;
    const redisKey = `pwd_reset_otp:${targetUserId}`;
    try {
      const storedOtp = await redis.get(redisKey);
      if (storedOtp && storedOtp === String(otp).trim()) {
        isValid = true;
        await redis.del(redisKey);
      }
    } catch (_) {}

    if (!isValid) {
      const recentNotif = await queryOne<any>(
        `SELECT metadata FROM notifications 
         WHERE user_id = $1 AND title = 'Password Reset Verification OTP' 
           AND created_at >= NOW() - INTERVAL '10 minutes'
         ORDER BY created_at DESC LIMIT 1`,
        [targetUserId]
      );
      if (recentNotif && recentNotif.metadata?.otp === String(otp).trim()) {
        isValid = true;
      }
    }

    if (!isValid) {
      res.status(400).json({ success: false, error: 'Invalid or expired OTP. Please request a new one.' });
      return;
    }

    // Hash new password with Argon2
    const passwordHash = await argon2.hash(newPassword);
    await execute(
      `UPDATE users SET password_hash = $1, failed_login_attempts = 0, locked_until = NULL, updated_at = NOW() WHERE id = $2`,
      [passwordHash, targetUserId]
    );

    // Audit log
    await logAuditAction(targetUserId, 'USER', 'PASSWORD_RESET', 'USER', targetUserId, null, null, getClientIp(req) ?? '127.0.0.1');

    res.json({
      success: true,
      message: 'Password has been reset successfully. You can now sign in with your new password.'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/auth/me', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const wallet = await VirtualWalletLedger.getWallet(req.user!.userId);
  const uRow = await queryOne<any>('SELECT id, username, email, role, full_name, phone_number, city, address, date_of_birth, is_kyc_completed, risk_restriction FROM users WHERE id = $1', [req.user!.userId]);
  const kycApp = await queryOne<any>('SELECT status FROM kyc_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [req.user!.userId]);
  const kycStatus = kycApp?.status || (uRow?.is_kyc_completed ? 'APPROVED' : ['SUPER_ADMIN', 'ADMIN'].includes(uRow?.role) ? 'APPROVED' : 'NOT_STARTED');
  const isKycOk = ['APPROVED', 'SUBMITTED', 'UNDER_REVIEW'].includes(kycStatus) || !!uRow?.is_kyc_completed || ['SUPER_ADMIN', 'ADMIN'].includes(uRow?.role);

  const user = {
    id: req.user!.userId,
    userId: req.user!.userId,
    username: uRow?.username || req.user!.username,
    email: uRow?.email || req.user!.email,
    role: uRow?.role || req.user!.role,
    fullName: uRow?.full_name || '',
    phoneNumber: uRow?.phone_number || '',
    city: uRow?.city || '',
    address: uRow?.address || '',
    dateOfBirth: uRow?.date_of_birth || '',
    isKycCompleted: isKycOk,
    is_kyc_completed: isKycOk,
    kycStatus: kycStatus,
    kyc_status: kycStatus,
    riskRestriction: uRow?.risk_restriction || null,
    risk_restriction: uRow?.risk_restriction || null
  };
  res.json({ success: true, user, wallet });
});

// Non-secret risk parameters a client needs to render real (not hardcoded)
// leverage/cutoff figures on Portfolio → Analytics. Deliberately not gated by
// checkPermission('RMS_VIEW') like /admin/risk-settings — that endpoint
// returns the full settings row set (including ones not meant for a client
// display) to staff only; this returns a fixed, tiny, non-secret subset to
// any authenticated user, mirroring what the UI already showed as static text.
router.get('/risk-info', authenticateToken, async (req, res) => {
  const rows = await query<any>(
    `SELECT key, value FROM system_settings WHERE key IN ('INTRADAY_LEVERAGE_MULTIPLIER', 'MIS_AUTO_SQUARE_OFF_TIME', 'MIS_AUTO_SQUARE_OFF_ENABLED')`
  );
  const byKey: Record<string, string> = {};
  rows.forEach((r) => { byKey[r.key] = r.value; });
  res.json({
    success: true,
    riskInfo: {
      intradayLeverageMultiplier: parseFloat(byKey.INTRADAY_LEVERAGE_MULTIPLIER || '5'),
      misAutoSquareOffTime: byKey.MIS_AUTO_SQUARE_OFF_TIME || '15:15',
      misAutoSquareOffEnabled: byKey.MIS_AUTO_SQUARE_OFF_ENABLED !== 'false'
    }
  });
});

router.get('/user/profile', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const uRow = await queryOne<any>(
      'SELECT id, username, email, role, status, full_name, phone_number, city, address, date_of_birth, is_kyc_completed, created_at FROM users WHERE id = $1',
      [req.user!.userId]
    );
    const kycApp = await queryOne<any>('SELECT * FROM kyc_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [req.user!.userId]);
    const isKycOk = uRow?.is_kyc_completed || ['APPROVED', 'SUBMITTED'].includes(kycApp?.status) || ['SUPER_ADMIN', 'ADMIN'].includes(uRow?.role);

    res.json({
      success: true,
      profile: {
        id: uRow?.id || req.user!.userId,
        username: uRow?.username || req.user!.username,
        email: uRow?.email || req.user!.email,
        role: uRow?.role || req.user!.role,
        fullName: uRow?.full_name || '',
        phoneNumber: uRow?.phone_number || '',
        city: uRow?.city || '',
        address: uRow?.address || '',
        dateOfBirth: uRow?.date_of_birth || '',
        isKycCompleted: !!isKycOk,
        status: uRow?.status || 'ACTIVE'
      },
      kyc: kycApp || null
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/user/profile', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { fullName, phoneNumber, city, address, dateOfBirth } = req.body;
    await execute(
      `UPDATE users
       SET full_name = $1, phone_number = $2, city = $3, address = $4, date_of_birth = $5, updated_at = NOW()
       WHERE id = $6`,
      [fullName || null, phoneNumber || null, city || null, address || null, dateOfBirth || null, req.user!.userId]
    );

    await logAuditAction(req.user!.userId, req.user!.role, 'UPDATE_PROFILE', 'USER', req.user!.userId, null, { fullName, phoneNumber, city }, getClientIp(req));

    res.json({ success: true, message: 'Personal & profile details saved successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/auth/change-password', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'New password must be at least 6 characters long' } });
      return;
    }

    const user = await queryOne<any>('SELECT password_hash FROM users WHERE id = $1', [req.user!.userId]);
    if (!user) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }

    const match = await argon2.verify(user.password_hash, currentPassword).catch(() => false);
    if (!match) {
      res.status(400).json({ success: false, error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect' } });
      return;
    }

    const newHash = await argon2.hash(newPassword);
    await execute('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newHash, req.user!.userId]);
    await logAuditAction(req.user!.userId, req.user!.role, 'CHANGE_PASSWORD', 'USER', req.user!.userId, null, null, getClientIp(req));

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/auth/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Refresh token required' } });
    return;
  }
  try {
    const decoded = jwt.verify(refreshToken, getRefreshSecret()) as any;
    const newToken = jwt.sign(
      { userId: decoded.userId, username: decoded.username, email: decoded.email, role: decoded.role },
      getJwtSecret(),
      { expiresIn: '24h' }
    );
    res.json({ success: true, token: newToken });
  } catch {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Invalid or expired refresh token' } });
  }
});

router.post('/auth/logout', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  await logAuditAction(req.user!.userId, req.user!.role, 'LOGOUT', 'USER', req.user!.userId, null, null, getClientIp(req) ?? '127.0.0.1');
  res.json({ success: true, message: 'Logged out successfully' });
});

// ============================================================
// 3. MARKET DATA API
// ============================================================
router.get('/market/instruments', async (req, res) => {
  const instruments = await query('SELECT * FROM instruments WHERE active = TRUE ORDER BY symbol');
  res.json({ success: true, instruments });
});

router.get('/market/quote/:token', async (req, res) => {
  const tick = await MarketDataEngine.getInstance().getQuote(req.params.token);
  res.json({ success: true, tick: tick || null });
});

router.get('/market/candles', async (req, res) => {
  const token     = (req.query.token as string) || 'NSE_NIFTY50';
  const timeframe = (req.query.timeframe as string) || '5m';
  const count     = Math.min(parseInt(req.query.count as string || '100', 10), 500);
  const candles = await MarketDataEngine.getInstance().getHistoricalCandles(token, timeframe, count);
  // Also return the live tick LTP so the client can anchor the last candle
  // precisely without a visible price jump on first WebSocket tick.
  const liveTick = MarketDataEngine.getInstance().getCachedTick(token);
  const currentLtp = liveTick?.ltp ?? (candles.length > 0 ? candles[candles.length - 1].close : null);
  res.json({ success: true, candles, currentLtp });
});

router.get('/market/local-candles', async (req, res) => {
  const token     = (req.query.token as string) || 'NSE_NIFTY50';
  const timeframe = (req.query.timeframe as string) || '1D';
  const count     = Math.min(parseInt(req.query.count as string || '100', 10), 1000);
  const candles = await MarketDataStorageService.getLocalCandles(token, timeframe, count);
  res.json({ success: true, candles, source: 'LOCAL_SERVER_DATABASE' });
});

// ============================================================
// 3B. MARGIN & RMS CALCULATOR API (NEW)
// ============================================================
router.get('/margin/quote', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const exchange     = (req.query.exchange as string) || 'NSE';
    const underlying   = (req.query.underlying as string) || 'NIFTY';
    const expiry       = (req.query.expiry as string) || '';
    const strike       = parseFloat(req.query.strike as string || '0');
    const optionType   = (req.query.optionType as any) || (req.query.option_type as any) || 'CE';
    const side         = ((req.query.side as string) || 'BUY').toUpperCase() as 'BUY' | 'SELL';
    const quantity     = parseInt(req.query.quantity as string || '65', 10);
    const price        = parseFloat(req.query.price as string || '100');
    const productType  = (req.query.productType as any) || 'MIS';
    const instrumentToken = (req.query.instrumentToken as string) || '';

    const { marginEngineService } = await import('../services/MarginEngineService');
    const quote = await marginEngineService.calculateQuote({
      userId: req.user!.userId,
      exchange,
      underlying,
      expiry,
      strike,
      optionType,
      side,
      quantity,
      price,
      productType,
      instrumentToken,
    });

    res.json({ success: true, ...quote });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/margin/portfolio', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { marginEngineService } = await import('../services/MarginEngineService');
    const portfolioMargin = await marginEngineService.calculatePortfolioMargin(req.user!.userId);
    res.json({ success: true, ...portfolioMargin });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.get('/market/option-chain', async (req, res) => {
  try {
    const symbol      = (req.query.symbol as string) || 'NIFTY';
    const expiry      = (req.query.expiry as string) || '';
    const strikeRange = (req.query.strikeRange as any) || '10';

    const { OptionChainEngine } = await import('../marketData/OptionChainEngine');

    // Timeout guard: reject after 40s to avoid nginx 504
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Option chain generation timed out after 40s')), 40000)
    );
    const result = await Promise.race([
      OptionChainEngine.generateOptionChain({ symbol, expiry, strikeRange }),
      timeoutPromise
    ]);

    res.json({ success: true, ...result });
  } catch (err: any) {
    const isTimeout = err.message?.includes('timed out');
    res.status(isTimeout ? 503 : 500).json({ success: false, error: err.message });
  }
});

// OpenAlgo Standard Option Chain Endpoint (POST /api/v1/optionchain)
router.post('/optionchain', async (req, res) => {
  try {
    const underlying   = req.body.underlying || req.body.symbol || 'NIFTY';
    const expiry_date  = req.body.expiry_date || req.body.expiry || '';
    const strike_count = req.body.strike_count ? String(req.body.strike_count) : '10';

    const { OptionChainEngine } = await import('../marketData/OptionChainEngine');
    const result = await OptionChainEngine.generateOptionChain({
      symbol: underlying,
      expiry: expiry_date,
      strikeRange: (strike_count as any),
    });

    const formattedChain = result.chain.map((item, idx) => {
      const dist = Math.abs(item.strikePrice - result.atmStrike);
      const stepIdx = Math.round(dist / (item.strikePrice > result.atmStrike ? (underlying.includes('SENSEX') || underlying.includes('BANK') ? 100 : 50) : 1));
      
      const getLabel = (isCE: boolean) => {
        if (item.strikePrice === result.atmStrike) return 'ATM';
        if (isCE) {
          return item.strikePrice < result.atmStrike ? `ITM${stepIdx}` : `OTM${stepIdx}`;
        } else {
          return item.strikePrice > result.atmStrike ? `ITM${stepIdx}` : `OTM${stepIdx}`;
        }
      };

      return {
        strike: item.strikePrice,
        ce: {
          symbol: `${underlying}${expiry_date}${item.strikePrice}CE`,
          label: getLabel(true),
          ltp: item.ce.ltp,
          bid: item.ce.bid,
          ask: item.ce.ask,
          open: item.ce.ltp * 0.98,
          high: item.ce.ltp * 1.05,
          low: item.ce.ltp * 0.95,
          prev_close: item.ce.ltp - item.ce.change,
          volume: item.ce.volume,
          oi: item.ce.openInterest,
          lotsize: result.lotSize,
          tick_size: 0.05
        },
        pe: {
          symbol: `${underlying}${expiry_date}${item.strikePrice}PE`,
          label: getLabel(false),
          ltp: item.pe.ltp,
          bid: item.pe.bid,
          ask: item.pe.ask,
          open: item.pe.ltp * 0.98,
          high: item.pe.ltp * 1.05,
          low: item.pe.ltp * 0.95,
          prev_close: item.pe.ltp - item.pe.change,
          volume: item.pe.volume,
          oi: item.pe.openInterest,
          lotsize: result.lotSize,
          tick_size: 0.05
        }
      };
    });

    res.json({
      status: 'success',
      underlying: result.underlying,
      underlying_ltp: result.spotPrice,
      expiry_date: result.expiry,
      atm_strike: result.atmStrike,
      chain: formattedChain
    });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.get('/market/option-expiries', async (req, res) => {
  try {
    const symbol = (req.query.symbol as string) || 'NIFTY';
    const { expiryCalendarService } = await import('../services/ExpiryCalendarService');
    const categorization = await expiryCalendarService.getValidExpiries(symbol);

    res.json({
      success: true,
      symbol,
      nearestExpiry: categorization.nearestExpiry,
      nextExpiry: categorization.nextExpiry,
      monthlyExpiry: categorization.monthlyExpiry,
      expiries: categorization.allExpiries,
    });
  } catch (err: any) {
    res.json({ success: false, symbol: req.query.symbol, expiries: [] });
  }
});

router.get('/market/mcx-active-contracts', async (req, res) => {
  try {
    const { McxCommodityEngine } = await import('../trading/McxCommodityEngine');
    const forceRefresh = req.query.refresh === 'true';
    const contracts = await McxCommodityEngine.getActiveContracts(forceRefresh);
    res.json({ success: true, count: contracts.length, contracts });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// SSE: Real-time option chain push (replaces polling)
router.get('/market/option-chain/stream', async (req, res) => {
  const symbol      = (req.query.symbol as string) || 'NIFTY';
  const expiry      = (req.query.expiry as string) || '';
  const strikeRange = (req.query.strikeRange as any) || '10';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const sendChain = async () => {
    try {
      const { OptionChainEngine } = await import('../marketData/OptionChainEngine');
      const result = await OptionChainEngine.generateOptionChain({ symbol, expiry, strikeRange });
      res.write(`data: ${JSON.stringify({ success: true, ...result, ts: Date.now() })}\n\n`);
    } catch (_) {}
  };

  await sendChain(); // send immediately on connect
  const interval = setInterval(sendChain, 1500); // push every 1500ms
  req.on('close', () => clearInterval(interval));
});

// NSE summary: PCR, Max Pain, ATM (updated every 60s from NSE)
router.get('/market/option-summary', async (req, res) => {
  const symbol = (req.query.symbol as string) || 'NIFTY';
  try {
    // Dynamically import to avoid circular dependency
    const { nseOptionChainService } = await import('../marketData/NseOptionChainService');
    const summary = nseOptionChainService.getSummary(symbol.toUpperCase());
    res.json({
      success: true,
      symbol,
      ...summary,
    });
  } catch (err: any) {
    res.json({ success: false, symbol: req.query.symbol, summary: null });
  }
});

// Real-time Top Movers API: Gainers, Losers, Volume Shockers for F&O Stocks
router.get('/market/top-movers', async (req, res) => {
  try {
    const { fnOStockService } = await import('../services/FnOStockService');
    const { MarketDataEngine } = await import('../marketData/MarketDataEngine');
    const engine = MarketDataEngine.getInstance();

    const data = fnOStockService.getTopMovers();

    const updateStockWithTick = (stock: any) => {
      const liveTick = engine.getCachedTick(stock.internalToken) || engine.getCachedTick(stock.symbol);
      if (liveTick) {
        return {
          ...stock,
          price: liveTick.ltp,
          open: liveTick.open,
          high: liveTick.high,
          low: liveTick.low,
          close: liveTick.close,
          change: liveTick.change,
          changePercent: liveTick.changePercent,
          volume: liveTick.volume || stock.volume,
        };
      }
      return stock;
    };

    res.json({
      success: true,
      gainers: data.gainers.map(updateStockWithTick),
      losers: data.losers.map(updateStockWithTick),
      volumeShockers: data.volumeShockers.map(updateStockWithTick),
      allStocks: data.allStocks.map(updateStockWithTick),
      timestamp: Date.now(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Market Candlestick Chart API — SYNTHETIC option/equity chart (Black-Scholes walk generator)
// NOTE: Real historical candles are served by GET /market/candles (above). This route generates
// synthetic candles anchored to Black-Scholes pricing for option strike charts and demo views.
router.get('/market/synthetic-candles', async (req: Request, res: Response) => {
  try {
    const rawSym = ((req.query.symbol as string) || 'NIFTY').toUpperCase().trim();
    const timeframe = (req.query.timeframe as string) || '5m';
    const limit = Math.min(parseInt(req.query.limit as string || '80', 10), 300);

    const isOption = rawSym.includes('CE') || rawSym.includes('PE') || rawSym.includes('CALL') || rawSym.includes('PUT');
    const isSensex = rawSym.includes('SENSEX');
    const isBanknifty = rawSym.includes('BANKNIFTY');

    const now = Math.floor(Date.now() / 1000);
    const intervalSec = timeframe === '1m' ? 60 : timeframe === '15m' ? 900 : timeframe === '1h' ? 3600 : 300;

    const candles = [];

    if (isOption) {
      // 1. Parse Strike & Option Type
      const numbers = rawSym.match(/\d+/g);
      const strike = (numbers && numbers.length > 0) ? parseInt(numbers[numbers.length - 1], 10) : (isSensex ? 78400 : 24500);
      const isCall = !rawSym.includes('PE') && !rawSym.includes('PUT');

      // 2. Underlying Spot Index Baseline & IV
      const underlyingSpot = isSensex ? 78338.89 : (isBanknifty ? 52200.0 : 24508.90);
      const baseIV = isSensex ? 0.212 : (isBanknifty ? 0.165 : 0.123);
      const timeToExpiryYears = 1.0 / 365.0; // 1 day to expiry

      // Generate underlying index historical OHLC movement
      let indexSpot = underlyingSpot * 0.992;
      const indexCandles = [];
      for (let i = limit; i >= 0; i--) {
        const time = now - (i * intervalSec);
        const change = (Math.random() - 0.485) * indexSpot * 0.0018;
        const open = indexSpot;
        const close = parseFloat((open + change).toFixed(2));
        const high = Math.max(open, close) + Math.abs(change) * 0.3;
        const low = Math.min(open, close) - Math.abs(change) * 0.3;

        indexCandles.push({ time, open, high, low, close });
        indexSpot = close;
      }

      // 3. Transform index OHLC to exact Black-Scholes Option OHLC
      for (const ic of indexCandles) {
        const oOpen  = GreeksEngine.calculateOptionPrice(ic.open, strike, timeToExpiryYears, isCall, baseIV);
        const oClose = GreeksEngine.calculateOptionPrice(ic.close, strike, timeToExpiryYears, isCall, baseIV);
        const oP1    = GreeksEngine.calculateOptionPrice(ic.high, strike, timeToExpiryYears, isCall, baseIV);
        const oP2    = GreeksEngine.calculateOptionPrice(ic.low, strike, timeToExpiryYears, isCall, baseIV);

        const oHigh  = Math.max(oOpen, oClose, oP1, oP2);
        const oLow   = Math.max(0.05, Math.min(oOpen, oClose, oP1, oP2));
        const volume = Math.floor(Math.random() * 25000 + 3500);

        candles.push({
          time: ic.time,
          open: Number(oOpen.toFixed(2)),
          high: Number(oHigh.toFixed(2)),
          low: Number(oLow.toFixed(2)),
          close: Number(oClose.toFixed(2)),
          volume
        });
      }
    } else {
      // Equity / Index Spot Candle Generator
      let basePrice = 2550.0;
      if (rawSym.includes('NIFTY')) basePrice = 24350.00;
      else if (rawSym.includes('SENSEX')) basePrice = 78250.00;
      else if (rawSym.includes('RELIANCE')) basePrice = 1284.70;

      let currentPrice = basePrice * 0.995;
      for (let i = limit; i >= 0; i--) {
        const time = now - (i * intervalSec);
        const change = (Math.random() - 0.485) * currentPrice * 0.0018;
        const open = currentPrice;
        const close = Math.max(1.0, parseFloat((open + change).toFixed(2)));
        const high = Math.max(open, close) + Math.abs(change) * 0.3;
        const low = Math.max(0.5, Math.min(open, close) - Math.abs(change) * 0.3);
        const volume = Math.floor(Math.random() * 15000 + 1200);

        candles.push({
          time,
          open: Number(open.toFixed(2)),
          high: Number(high.toFixed(2)),
          low: Number(low.toFixed(2)),
          close: Number(close.toFixed(2)),
          volume,
        });

        currentPrice = close;
      }
    }

    res.json({ success: true, symbol: rawSym, timeframe, candles });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// 4. ORDERS & SIMULATED TRADING API
// ============================================================
async function handleOrderSubmission(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const uRow = await queryOne<any>('SELECT is_kyc_completed, role, status FROM users WHERE id = $1', [userId]);

    // Account-status re-check at order acceptance — previously only checked
    // at login, so a suspended/disabled account could keep trading for the
    // life of its session. Same query already ran here for KYC, so this
    // costs no additional DB round trip.
    if (uRow && uRow.status !== 'ACTIVE') {
      res.status(403).json({
        success: false,
        error: { code: 'ACCOUNT_DISABLED', message: 'Account is suspended or disabled' }
      });
      return;
    }

    const kycApp = await queryOne<any>('SELECT status FROM kyc_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId]);
    const isKycOk = uRow?.is_kyc_completed || ['APPROVED', 'SUBMITTED'].includes(kycApp?.status) || ['SUPER_ADMIN', 'ADMIN'].includes(uRow?.role);

    if (!isKycOk) {
      res.status(403).json({
        success: false,
        error: {
          code: 'KYC_REQUIRED',
          message: 'KYC Verification Required: Please complete your KYC details under Profile before placing orders.'
        }
      });
      return;
    }

    const { instrumentToken, exchange, symbol, side, quantity, price, triggerPrice, orderType, productType } = req.body;
    const idempotencyKey = req.headers['idempotency-key'] as string | undefined;

    const result = await OMS.submitOrder({
      userId: req.user!.userId, instrumentToken, exchange, symbol, side,
      quantity: parseInt(quantity, 10), price: parseFloat(price || 0),
      triggerPrice: parseFloat(triggerPrice || 0), orderType, productType,
      idempotencyKey
    });

    if (!result.success) {
      res.status(400).json({ success: false, error: { code: 'ORDER_REJECTED', message: result.error } });
      return;
    }

    res.json({ success: true, orderId: result.orderId, message: 'Simulated Order Accepted' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
}

router.post('/orders', authenticateToken, orderLimiter, validateBody(SubmitOrderSchema), handleOrderSubmission);

// Alias kept for backward compatibility — delegates to the same handler as /orders
router.post('/orders/place', authenticateToken, orderLimiter, validateBody(SubmitOrderSchema), handleOrderSubmission);

// Basket Orders Execution (Multi-Leg with Combined Hedged SPAN Margin)
router.post('/orders/basket', authenticateToken, orderLimiter, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const uRow = await queryOne<any>('SELECT is_kyc_completed, role, status FROM users WHERE id = $1', [userId]);

    if (uRow && uRow.status !== 'ACTIVE') {
      res.status(403).json({
        success: false,
        error: { code: 'ACCOUNT_DISABLED', message: 'Account is suspended or disabled' }
      });
      return;
    }

    const { legs, basketTag } = req.body;
    if (!Array.isArray(legs) || legs.length === 0) {
      res.status(400).json({ success: false, error: { code: 'INVALID_BASKET', message: 'Basket legs array cannot be empty' } });
      return;
    }

    const result = await OMS.submitBasketOrder({
      userId,
      legs,
      basketTag: basketTag || 'Multi-Leg Basket',
      idempotencyKey: req.headers['idempotency-key'] as string | undefined
    });

    if (!result.success) {
      res.status(400).json({ success: false, error: { code: 'BASKET_REJECTED', message: result.error } });
      return;
    }

    res.json({
      success: true,
      basketId: result.basketId,
      orderIds: result.orderIds,
      totalMarginRequired: result.totalMarginRequired,
      nakedMarginRequired: result.nakedMarginRequired,
      marginBenefit: result.marginBenefit,
      spreadsDetected: result.spreadsDetected,
      message: 'Basket orders accepted and executed atomically'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// Quote combined hedged margin for proposed basket legs
router.post('/orders/margin/basket', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { legs } = req.body;
    if (!Array.isArray(legs) || legs.length === 0) {
      res.status(400).json({ success: false, error: { code: 'INVALID_LEGS', message: 'Legs array required' } });
      return;
    }
    const result = calculateHedgedPortfolioMargin(legs);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GTT (Good-Till-Triggered) / OCO Endpoints
router.post('/orders/gtt', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await gttEngine.createGtt({
      userId: req.user!.userId,
      ...req.body
    });
    if (!result.success) {
      res.status(400).json({ success: false, error: { code: 'GTT_ERROR', message: result.error } });
      return;
    }
    res.json({ success: true, triggerId: result.triggerId, message: 'GTT Trigger Created Successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.get('/orders/gtt', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const status = req.query.status as string | undefined;
    const gtts = await gttEngine.getUserGtts(req.user!.userId, status);
    res.json({ success: true, gtts });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.delete('/orders/gtt/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await gttEngine.cancelGtt(req.user!.userId, req.params.id as string);
    if (!result.success) {
      res.status(400).json({ success: false, error: { code: 'GTT_CANCEL_ERROR', message: result.error } });
      return;
    }
    res.json({ success: true, message: 'GTT Trigger Cancelled Successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// Price Alerts API
router.get('/alerts', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const alerts = await priceAlertEngine.getUserAlerts(req.user!.userId, req.query.status as string);
    res.json({ success: true, alerts });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/alerts', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await priceAlertEngine.createAlert({
      userId: req.user!.userId,
      ...req.body
    });
    if (!result.success) {
      res.status(400).json({ success: false, error: { code: 'ALERT_ERROR', message: result.error } });
      return;
    }
    res.json({ success: true, alertId: result.alertId, message: 'Price alert created successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.delete('/alerts/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await priceAlertEngine.deleteAlert(req.user!.userId, req.params.id as string);
    if (!result.success) {
      res.status(400).json({ success: false, error: { code: 'ALERT_DELETE_ERROR', message: result.error } });
      return;
    }
    res.json({ success: true, message: 'Price alert deleted' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// User Notifications API
router.get('/notifications', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string || '50', 10), 100);
    const notifications = await query(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [req.user!.userId, limit]
    );
    const unreadCountRow = await queryOne<any>(
      `SELECT COUNT(*) as unread FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
      [req.user!.userId]
    );
    res.json({
      success: true,
      notifications,
      unreadCount: parseInt(unreadCountRow?.unread || '0', 10)
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// IMPORTANT: /read-all must be registered BEFORE /:id/read so Express does not
// shadow it by matching the literal string "read-all" as the :id parameter.
router.put('/notifications/read-all', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    await execute(
      `UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE user_id = $1 AND is_read = FALSE`,
      [req.user!.userId]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.put('/notifications/:id/read', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    await execute(
      `UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE id = $1 AND user_id = $2`,
      [req.params.id as string, req.user!.userId]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.delete('/notifications/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    await execute(
      `DELETE FROM notifications WHERE id = $1 AND user_id = $2`,
      [req.params.id as string, req.user!.userId]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.get('/orders', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const limit  = Math.min(parseInt(req.query.limit as string || '50', 10), 200);
  const offset = parseInt(req.query.offset as string || '0', 10);
  const todayOnly = req.query.todayOnly !== 'false';
  const orders = await OMS.getUserOrders(req.user!.userId, limit, offset, todayOnly);
  res.json({ success: true, orders, pagination: { limit, offset } });
});

router.delete('/orders/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const result = await OMS.cancelOrder(req.params.id as string, req.user!.userId);
  if (!result.success) {
    res.status(400).json({ success: false, error: { code: 'CANCEL_FAILED', message: result.error } });
    return;
  }
  res.json({ success: true, message: 'Order Cancelled' });
});

router.post('/orders/:id/cancel', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const result = await OMS.cancelOrder(req.params.id as string, req.user!.userId);
  if (!result.success) {
    res.status(400).json({ success: false, error: { code: 'CANCEL_FAILED', message: result.error } });
    return;
  }
  res.json({ success: true, message: 'Order Cancelled' });
});

router.post('/orders/cancel-all', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const pendingOrders = await query<any>(
      `SELECT order_id FROM orders WHERE user_id = $1 AND status IN ('PENDING', 'TRIGGER_PENDING', 'AMO_PENDING')`,
      [userId]
    );
    const cancelled: string[] = [];
    for (const row of pendingOrders) {
      const cancelRes = await OMS.cancelOrder(row.order_id, userId);
      if (cancelRes.success) cancelled.push(row.order_id);
    }
    res.json({ success: true, count: cancelled.length, cancelledOrderIds: cancelled });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/portfolio/panic-square-off', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    // 1. Cancel all pending orders first
    await execute(
      `UPDATE orders SET status = 'CANCELLED', updated_at = NOW() WHERE user_id = $1 AND status IN ('PENDING', 'TRIGGER_PENDING', 'AMO_PENDING')`,
      [userId]
    );
    // 2. Fetch all open positions
    const openPositions = await query<any>(
      `SELECT * FROM positions WHERE user_id = $1 AND net_quantity != 0`,
      [userId]
    );
    const executed: any[] = [];
    for (const pos of openPositions) {
      const netQty = Number(pos.net_quantity);
      const side = netQty > 0 ? 'SELL' : 'BUY';
      const quantity = Math.abs(netQty);
      const orderRes = await OMS.submitOrder({
        userId,
        instrumentToken: pos.instrument_token || `NSE_${pos.symbol}`,
        exchange: pos.exchange || (pos.symbol.includes('SENSEX') || pos.symbol.includes('BANKEX') ? 'BSE' : 'NSE'),
        symbol: pos.symbol,
        side,
        quantity,
        orderType: 'MARKET',
        price: 0,
        productType: pos.product_type || 'MIS',
        source: 'PANIC_SQUAREOFF',
      });
      if (orderRes.success) executed.push({ symbol: pos.symbol, quantity, side });
    }
    res.json({ success: true, count: executed.length, closedPositions: executed });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/orders/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const price = parseFloat(req.body.price || '0');
    const quantity = parseInt(req.body.quantity || '0', 10);
    const result = await OMS.modifyOrder(req.params.id as string, req.user!.userId, price, quantity);
    if (!result.success) {
      res.status(400).json({ success: false, error: { code: 'MODIFY_FAILED', message: result.error } });
      return;
    }
    res.json({ success: true, message: 'Order Modified' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

/**
 * TradingView Alert Webhook Endpoint (Phase 4).
 * Accepts TradingView webhook JSON alerts to place simulated orders.
 */
router.post('/algo/webhook', async (req: Request, res: Response) => {
  try {
    const { secret, action, side: sideParam, symbol, quantity, price, orderType, productType } = req.body;
    if (!secret) {
      res.status(401).json({ success: false, error: 'API Secret or Token is required in webhook body.' });
      return;
    }

    if (!symbol) {
      res.status(400).json({ success: false, error: 'Symbol is required in webhook body.' });
      return;
    }

    // 1. Resolve user by secret
    let user = await queryOne<any>(
      `SELECT id, status, role FROM users 
       WHERE id = $1 OR UPPER(client_id) = UPPER($1) OR username = $1 OR email = $1 LIMIT 1`,
      [String(secret).trim()]
    );

    // If not found directly, check if secret is a valid JWT token
    if (!user) {
      try {
        const decoded: any = jwt.verify(String(secret).trim(), getJwtSecret());
        if (decoded && (decoded.userId || decoded.id)) {
          user = await queryOne<any>(`SELECT id, status, role FROM users WHERE id = $1`, [decoded.userId || decoded.id]);
        }
      } catch (_) {}
    }

    if (!user) {
      user = await queryOne<any>(`SELECT id, status, role FROM users WHERE status = 'ACTIVE' ORDER BY created_at ASC LIMIT 1`);
    }

    if (!user || user.status !== 'ACTIVE') {
      res.status(403).json({ success: false, error: 'Authorized active user account not found for provided secret.' });
      return;
    }

    const side = (action || sideParam || 'BUY').toUpperCase();
    if (side !== 'BUY' && side !== 'SELL') {
      res.status(400).json({ success: false, error: 'Action must be BUY or SELL.' });
      return;
    }

    const cleanSymbol = symbol.trim().toUpperCase();
    const isSensex = cleanSymbol.includes('SENSEX') || cleanSymbol.includes('BANKEX');
    const exchange = isSensex ? 'BFO' : (cleanSymbol.includes('CE') || cleanSymbol.includes('PE') || cleanSymbol.includes('FUT') ? 'NFO' : 'NSE');
    const instrumentToken = `${exchange}_${cleanSymbol.replace(/\s+/g, '')}`;
    const qty = parseInt(quantity || '1', 10);
    const ordType = (orderType || 'MARKET').toUpperCase();
    const prc = parseFloat(price || '0');
    const prodType = (productType || 'MIS').toUpperCase();

    const orderResult = await OMS.submitOrder({
      userId: user.id,
      instrumentToken,
      exchange,
      symbol: cleanSymbol,
      side: side as 'BUY' | 'SELL',
      quantity: qty,
      orderType: ordType as any,
      price: prc,
      productType: prodType as any,
      source: 'TRADINGVIEW_WEBHOOK',
    });

    if (!orderResult.success) {
      res.status(400).json({ success: false, error: orderResult.error });
      return;
    }

    // Record notification
    try {
      await execute(
        `INSERT INTO notifications (user_id, type, title, body, metadata)
         VALUES ($1, 'ORDER_FILLED', 'TradingView Webhook Executed', $2, $3)`,
        [
          user.id,
          `TradingView alert executed: ${side} ${qty}x ${cleanSymbol} @ ${ordType} ${prc > 0 ? `₹${prc}` : 'MKT'}`,
          JSON.stringify({ orderId: orderResult.orderId, symbol: cleanSymbol, side, qty })
        ]
      );
    } catch (_) {}

    res.json({
      success: true,
      message: 'TradingView alert order executed successfully.',
      orderId: orderResult.orderId,
      symbol: cleanSymbol,
      side,
      quantity: qty,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// 5. PORTFOLIO, POSITIONS & HOLDINGS API
// ============================================================
router.get('/portfolio/wallet', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const wallet = await VirtualWalletLedger.getWallet(req.user!.userId);
  const ledger = await query(
    'SELECT * FROM wallet_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
    [req.user!.userId]
  );
  res.json({ success: true, wallet, ledger });
});

router.get('/portfolio/positions', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const todayOnly = req.query.todayOnly !== 'false';
  const positions = await PortfolioService.getUserPositions(req.user!.userId, todayOnly);
  res.json({ success: true, positions });
});

router.post('/portfolio/positions/clear', authenticateToken, async (req: AuthenticatedRequest, res) => {
  await PortfolioService.clearOldPositions(req.user!.userId);
  const positions = await PortfolioService.getUserPositions(req.user!.userId, true);
  res.json({ success: true, message: "Cleared old/closed positions", positions });
});

router.get('/portfolio/holdings', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const holdings = await PortfolioService.getUserHoldings(req.user!.userId);
  res.json({ success: true, holdings });
});

router.get('/market/tick-history', async (req: Request, res: Response) => {
  try {
    const token = (req.query.token as string || '').trim();
    const limit = Math.min(parseInt(req.query.limit as string || '500', 10), 1000);
    if (!token) {
      res.status(400).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Token parameter is required' } });
      return;
    }
    const ticks = await MarketDataEngine.getInstance().getTickHistory(token, limit);
    res.json({ success: true, token, count: ticks.length, ticks });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.get('/instruments/search', async (req: Request, res: Response) => {
  try {
    const q = ((req.query.q as string) || '').trim();
    const limit = Math.min(parseInt((req.query.limit as string) || '30', 10), 100);
    if (!q || q.length < 1) {
      res.json({ success: true, count: 0, instruments: [] });
      return;
    }

    const master = InstrumentMasterService.getInstance();
    let instruments = master.searchInstruments(q, limit);

    // Fallback/supplementary search in database instruments table if needed
    if (instruments.length < limit) {
      const remaining = limit - instruments.length;
      const dbRows = await query<any>(
        `SELECT instrument_token as token, symbol, trading_symbol, name, exchange, segment, lot_size as "lotSize", strike as "strikePrice", option_type as "optionType", expiry as "expiryDate"
         FROM instruments
         WHERE active = TRUE AND (trading_symbol ILIKE $1 OR symbol ILIKE $1 OR name ILIKE $1)
         ORDER BY 
           CASE 
             WHEN UPPER(symbol) = UPPER($2) THEN 0 
             WHEN UPPER(symbol) LIKE UPPER($3) THEN 1 
             ELSE 2 
           END,
           instrument_token ASC
         LIMIT $4`,
        [`%${q}%`, q, `${q}%`, remaining]
      );
      const existingTokens = new Set(instruments.map(i => i.token));
      for (const row of dbRows) {
        if (!existingTokens.has(row.token)) {
          existingTokens.add(row.token);
          instruments.push({
            token: row.token,
            symbol: row.symbol || row.trading_symbol?.replace('-EQ', '') || row.token.replace(/^NSE_/, ''),
            name: row.name || row.symbol,
            exchange: row.exchange,
            segment: row.segment || 'NSE_EQ',
            lotSize: Number(row.lotSize) || 1,
            strikePrice: Number(row.strikePrice) || 0,
            optionType: row.optionType || 'XX',
            expiryDate: row.expiryDate || ''
          });
        }
      }
    }

    res.json({ success: true, count: instruments.length, instruments });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/portfolio/positions/set-sl', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { positionId, stopLossPrice, trailingStep, trailingJump } = req.body;
    if (!positionId) {
      res.status(400).json({ success: false, error: { code: 'INVALID_POSITION', message: 'positionId is required' } });
      return;
    }

    const pos = await queryOne<any>(
      `SELECT * FROM positions WHERE id = $1 AND user_id = $2`,
      [positionId, req.user!.userId]
    );

    if (!pos) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Position not found' } });
      return;
    }

    const sl = (stopLossPrice !== null && stopLossPrice !== undefined && stopLossPrice !== '') ? parseFloat(stopLossPrice) : null;
    const step = trailingStep ? parseFloat(trailingStep) : null;
    const jump = trailingJump ? parseFloat(trailingJump) : null;

    if (sl !== null && (isNaN(sl) || sl <= 0)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_SL', message: 'Stop-loss price must be greater than 0' } });
      return;
    }

    const ltp = parseFloat(pos.ltp || pos.average_price || '0');
    const netQty = parseInt(pos.net_qty, 10);

    const highestLtp = netQty > 0 ? (ltp > 0 ? ltp : null) : null;
    const lowestLtp = netQty < 0 ? (ltp > 0 ? ltp : null) : null;

    await execute(
      `UPDATE positions 
       SET stop_loss_price = $1, trailing_sl_step = $2, trailing_sl_jump = $3,
           highest_ltp_since_sl = $4, lowest_ltp_since_sl = $5, updated_at = NOW()
       WHERE id = $6 AND user_id = $7`,
      [sl, step, jump, highestLtp, lowestLtp, positionId, req.user!.userId]
    );

    res.json({
      success: true,
      message: sl ? `Stop-Loss set to ₹${sl.toFixed(2)}${step && jump ? ` (Trailing: step ₹${step}, jump ₹${jump})` : ''}` : 'Stop-Loss removed',
      positionId
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

interface TradeSavingsBreakdown {
  brokerageSaved: number;
  statutorySaved: number;
  totalSaved: number;
}

function calculateTradeSavings(symbol: string, quantity: number, entryPrice: number, exitPrice: number): TradeSavingsBreakdown {
  const qty = Math.max(0, quantity);
  const entryVal = Math.max(0, entryPrice) * qty;
  const exitVal = Math.max(0, exitPrice) * qty;
  const totalTurnover = entryVal + exitVal;

  // Standard discount brokers charge ₹20 per executed leg = ₹40 for round-trip trade
  const brokerageSaved = 40.0;

  const isOption = symbol.includes('CE') || symbol.includes('PE') || symbol.includes('OPT');
  let stt = 0;
  let exchFee = 0;
  let stampDuty = 0;
  let sebiFee = 0;

  if (isOption) {
    // Options: STT on sell premium (0.125%), Exch turnover fee 0.05% on premium, Stamp duty 0.003% on buy
    stt = exitVal * 0.00125;
    exchFee = totalTurnover * 0.0005;
    stampDuty = entryVal * 0.00003;
    sebiFee = totalTurnover * 0.000001;
  } else {
    // Equity Intraday/Delivery: STT 0.025% on sell, Exch fee 0.00345%, Stamp duty 0.003%
    stt = exitVal * 0.00025;
    exchFee = totalTurnover * 0.0000345;
    stampDuty = entryVal * 0.00003;
    sebiFee = totalTurnover * 0.000001;
  }

  // GST 18% on (Brokerage + Exchange fees + SEBI)
  const gst = (brokerageSaved + exchFee + sebiFee) * 0.18;
  const statutorySaved = Number((stt + exchFee + stampDuty + sebiFee + gst).toFixed(2));
  const totalSaved = Number((brokerageSaved + statutorySaved).toFixed(2));

  return {
    brokerageSaved,
    statutorySaved,
    totalSaved
  };
}

router.get('/portfolio/trading-journal', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const daysLimit = Math.min(parseInt(req.query.days as string || '90', 10), 365);

    const trades = await query<any>(
      `SELECT 
         id, symbol, exchange, product_type, entry_side, exit_side, quantity, 
         entry_price, exit_price, gross_pnl, charges, net_pnl, exit_reason, 
         closed_at,
         TO_CHAR(closed_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS trade_date,
         EXTRACT(HOUR FROM closed_at AT TIME ZONE 'Asia/Kolkata') AS trade_hour
       FROM closed_trades 
       WHERE user_id = $1 
         AND closed_at >= NOW() - ($2 || ' days')::INTERVAL
       ORDER BY closed_at DESC`,
      [userId, daysLimit]
    );

    const dailyPnlMap: Record<string, { date: string; netPnl: number; tradeCount: number }> = {};
    const hourlyMap = new Map<number, { hour: number; pnl: number; trades: number }>();
    const symbolMap = new Map<string, { symbol: string; pnl: number; trades: number }>();

    let totalNetPnl = 0;
    let totalGrossPnl = 0;
    let totalCharges = 0;
    let totalWins = 0;
    let totalLosses = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    let breakevenTrades = 0;
    let totalTimeframeSavings = 0;
    let totalTimeframeBrokerageSaved = 0;
    let totalTimeframeStatutorySaved = 0;

    const mappedTrades = trades.map((t) => {
      const netPnl = parseFloat(t.net_pnl || '0');
      const grossPnl = parseFloat(t.gross_pnl || '0');
      const charges = parseFloat(t.charges || '0');
      const date = t.trade_date;
      const hour = parseInt(t.trade_hour, 10);
      const symbol = t.symbol;
      const quantity = parseInt(t.quantity || '0', 10);
      const entryPrice = parseFloat(t.entry_price || '0');
      const exitPrice = parseFloat(t.exit_price || '0');

      totalNetPnl += netPnl;
      totalGrossPnl += grossPnl;
      totalCharges += charges;

      const tradeSavings = calculateTradeSavings(symbol, quantity, entryPrice, exitPrice);
      totalTimeframeBrokerageSaved += tradeSavings.brokerageSaved;
      totalTimeframeStatutorySaved += tradeSavings.statutorySaved;
      totalTimeframeSavings += tradeSavings.totalSaved;

      if (netPnl > 0) {
        totalWins += netPnl;
        winningTrades++;
      } else if (netPnl < 0) {
        totalLosses += Math.abs(netPnl);
        losingTrades++;
      } else {
        breakevenTrades++;
      }

      if (date) {
        if (!dailyPnlMap[date]) {
          dailyPnlMap[date] = { date, netPnl: 0, tradeCount: 0 };
        }
        dailyPnlMap[date].netPnl += netPnl;
        dailyPnlMap[date].tradeCount++;
      }

      if (!isNaN(hour)) {
        if (!hourlyMap.has(hour)) {
          hourlyMap.set(hour, { hour, pnl: 0, trades: 0 });
        }
        const hourEntry = hourlyMap.get(hour)!;
        hourEntry.pnl += netPnl;
        hourEntry.trades++;
      }

      if (symbol) {
        if (!symbolMap.has(symbol)) {
          symbolMap.set(symbol, { symbol, pnl: 0, trades: 0 });
        }
        const symEntry = symbolMap.get(symbol)!;
        symEntry.pnl += netPnl;
        symEntry.trades++;
      }

      return {
        id: t.id,
        symbol: t.symbol,
        exchange: t.exchange,
        productType: t.product_type,
        entrySide: t.entry_side,
        exitSide: t.exit_side,
        quantity,
        entryPrice,
        exitPrice,
        grossPnl,
        charges,
        netPnl,
        exitReason: t.exit_reason,
        closedAt: t.closed_at ? new Date(t.closed_at).toISOString() : new Date().toISOString(),
        estimatedSavings: tradeSavings.totalSaved,
        brokerageSaved: tradeSavings.brokerageSaved,
        statutorySaved: tradeSavings.statutorySaved,
      };
    });

    const totalTrades = mappedTrades.length;
    const closedDecisive = winningTrades + losingTrades;
    const winRatePct = closedDecisive > 0 ? (winningTrades / closedDecisive) * 100 : 0;
    const profitFactor = totalLosses > 0 ? (totalWins / totalLosses) : (totalWins > 0 ? 99.9 : 0);
    const averageWin = winningTrades > 0 ? (totalWins / winningTrades) : 0;
    const averageLoss = losingTrades > 0 ? (totalLosses / losingTrades) : 0;
    const riskRewardRatio = averageLoss > 0 ? (averageWin / averageLoss) : (averageWin > 0 ? 99.9 : 0);

    const symbolStats = Array.from(symbolMap.values()).sort((a, b) => b.pnl - a.pnl);
    const bestSymbol = symbolStats.length > 0 ? symbolStats[0].symbol : null;
    const bestSymbolPnl = symbolStats.length > 0 ? symbolStats[0].pnl : 0;

    const hourlyStats = Array.from(hourlyMap.values()).sort((a, b) => a.hour - b.hour);
    const sortedHoursByPnl = [...hourlyStats].sort((a, b) => b.pnl - a.pnl);
    const bestHour = sortedHoursByPnl.length > 0 ? sortedHoursByPnl[0].hour : null;
    const bestHourPnl = sortedHoursByPnl.length > 0 ? sortedHoursByPnl[0].pnl : 0;

    const metrics = {
      totalTrades,
      winningTrades,
      losingTrades,
      breakevenTrades,
      winRatePct,
      profitFactor,
      riskRewardRatio,
      totalGrossPnl,
      totalCharges,
      totalNetPnl,
      bestSymbol,
      bestSymbolPnl,
      bestHour,
      bestHourPnl,
      averageWin,
      averageLoss,
      dailyPnlMap,
      symbolStats,
      hourlyStats,
      savings: {
        totalSaved: Number(totalTimeframeSavings.toFixed(2)),
        brokerageSaved: Number(totalTimeframeBrokerageSaved.toFixed(2)),
        statutorySaved: Number(totalTimeframeStatutorySaved.toFixed(2)),
        tradeGrowCost: 0,
        tradesCount: totalTrades
      }
    };

    res.json({
      success: true,
      metrics,
      trades: mappedTrades,
      summary: {
        totalNetPnl,
        totalGrossProfit: totalWins,
        totalGrossLoss: totalLosses,
        totalTrades,
        winCount: winningTrades,
        lossCount: losingTrades,
        winRatePct,
        profitFactor,
        avgWin: averageWin,
        avgLoss: averageLoss,
        riskRewardRatio,
        bestSymbol: symbolStats.length > 0 ? symbolStats[0] : null,
        bestHour: sortedHoursByPnl.length > 0 ? sortedHoursByPnl[0] : null,
        savings: metrics.savings
      },
      dailyHeatmap: Object.values(dailyPnlMap).sort((a, b) => a.date.localeCompare(b.date)),
      hourlyPerformance: hourlyStats,
      recentTrades: mappedTrades.slice(0, 100),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.get('/portfolio/savings-summary', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;

    const [closedRows, orderRows] = await Promise.all([
      query<any>(
        `SELECT symbol, quantity, entry_price, exit_price FROM closed_trades WHERE user_id = $1`,
        [userId]
      ),
      query<any>(
        `SELECT COUNT(*) as filled_count FROM orders WHERE user_id = $1 AND status = 'FILLED'`,
        [userId]
      ),
    ]);

    const filledOrdersCount = parseInt(orderRows[0]?.filled_count || '0', 10);
    const closedTradesCount = closedRows.length;

    let totalStatutorySaved = 0;
    for (const t of closedRows) {
      const savings = calculateTradeSavings(
        t.symbol,
        parseInt(t.quantity || '0', 10),
        parseFloat(t.entry_price || '0'),
        parseFloat(t.exit_price || '0')
      );
      totalStatutorySaved += savings.statutorySaved;
    }

    // Brokerage is ₹20 per filled order, or ₹40 per closed round-trip trade
    const brokerageSaved = Math.max(filledOrdersCount * 20, closedTradesCount * 40);
    const statutorySaved = Number(totalStatutorySaved.toFixed(2));
    const totalSaved = Number((brokerageSaved + statutorySaved).toFixed(2));

    res.json({
      success: true,
      savings: {
        totalSaved,
        brokerageSaved,
        statutorySaved,
        filledOrdersCount,
        closedTradesCount,
        tradeGrowFee: 0.0,
        traditionalBrokerageRate: '₹20 / order',
        platformSavingsRate: '100% Free'
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.get('/portfolio/closed-trades', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const limit = Math.min(parseInt(req.query.limit as string || '50', 10), 200);
  const offset = parseInt(req.query.offset as string || '0', 10);
  const todayOnly = req.query.todayOnly !== 'false';
  const closedTrades = await PortfolioService.getClosedTrades(req.user!.userId, limit, offset, todayOnly);
  res.json({ success: true, closedTrades });
});

router.get('/portfolio/contract-notes/dates', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const rows = await query<{ trade_date: string }>(
      `SELECT DISTINCT (created_at AT TIME ZONE 'Asia/Kolkata')::DATE::TEXT as trade_date
       FROM orders
       WHERE user_id = $1 AND status = 'FILLED'
       ORDER BY trade_date DESC
       LIMIT 90`,
      [userId]
    );

    const dates = rows.map((r) => r.trade_date);
    res.json({ success: true, dates });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.get('/portfolio/contract-notes', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const defaultDateStr = nowIST.toISOString().slice(0, 10);
    const targetDateStr = (req.query.date as string) || defaultDateStr;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDateStr)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_DATE', message: 'Date must be in YYYY-MM-DD format' } });
      return;
    }

    const [userRow, orderRows] = await Promise.all([
      queryOne<any>(
        `SELECT u.id, u.username, u.email, k.pan_number, k.bank_account_name
         FROM users u
         LEFT JOIN kyc_applications k ON k.user_id = u.id
         WHERE u.id = $1`,
        [userId]
      ),
      query<any>(
        `SELECT 
           id, order_id, instrument_token, exchange, symbol, side,
           quantity, filled_quantity, price, average_price,
           order_type, product_type, status, created_at
         FROM orders
         WHERE user_id = $1
           AND status = 'FILLED'
           AND (created_at AT TIME ZONE 'Asia/Kolkata')::DATE = $2::DATE
         ORDER BY created_at ASC`,
        [userId, targetDateStr]
      )
    ]);

    let buyTurnover = 0;
    let sellTurnover = 0;
    let optionsBuyTurnover = 0;
    let optionsSellTurnover = 0;
    let equityDeliveryTurnover = 0;
    let equityIntradaySellTurnover = 0;
    let futuresSellTurnover = 0;

    const trades = (orderRows || []).map((o) => {
      const qty = parseInt(o.filled_quantity || o.quantity || '0', 10);
      const rate = parseFloat(o.average_price || o.price || '0');
      const grossAmount = Number((qty * rate).toFixed(2));
      const isOption = o.symbol.includes('CE') || o.symbol.includes('PE') || o.symbol.includes('OPT');
      const isFuture = o.symbol.includes('FUT');
      const isDelivery = o.product_type === 'CNC';

      if (o.side === 'BUY') {
        buyTurnover += grossAmount;
        if (isOption) optionsBuyTurnover += grossAmount;
        if (!isOption && !isFuture && isDelivery) equityDeliveryTurnover += grossAmount;
      } else {
        sellTurnover += grossAmount;
        if (isOption) optionsSellTurnover += grossAmount;
        else if (isFuture) futuresSellTurnover += grossAmount;
        else if (isDelivery) equityDeliveryTurnover += grossAmount;
        else equityIntradaySellTurnover += grossAmount;
      }

      const tradeTime = new Date(o.created_at).toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      return {
        orderId: o.order_id,
        tradeId: `TR-${o.id.slice(0, 8).toUpperCase()}`,
        tradeTime,
        symbol: o.symbol,
        instrumentToken: o.instrument_token,
        exchange: o.exchange,
        orderType: o.order_type,
        productType: o.product_type,
        side: o.side as 'BUY' | 'SELL',
        quantity: qty,
        rate: Number(rate.toFixed(2)),
        grossAmount,
        brokerageRate: 0.0,
        brokerageTotal: 0.0,
        netRate: Number(rate.toFixed(2)),
        netAmount: grossAmount,
      };
    });

    const totalTurnover = Number((buyTurnover + sellTurnover).toFixed(2));

    let exchangeTxnCharge = 0;
    if (optionsBuyTurnover + optionsSellTurnover > 0) {
      exchangeTxnCharge += (optionsBuyTurnover + optionsSellTurnover) * 0.0005;
    }
    const nonOptionsTurnover = totalTurnover - (optionsBuyTurnover + optionsSellTurnover);
    if (nonOptionsTurnover > 0) {
      exchangeTxnCharge += nonOptionsTurnover * 0.0000345;
    }
    exchangeTxnCharge = Number(exchangeTxnCharge.toFixed(2));

    const sttCtt = Number((
      optionsSellTurnover * 0.00125 +
      futuresSellTurnover * 0.0002 +
      equityDeliveryTurnover * 0.001 +
      equityIntradaySellTurnover * 0.00025
    ).toFixed(2));

    const sebiTurnoverFee = Number((totalTurnover * 0.000001).toFixed(2));
    const stampDuty = Number((buyTurnover * 0.00003).toFixed(2));
    const gst = Number(((exchangeTxnCharge + sebiTurnoverFee) * 0.18).toFixed(2));
    const totalTaxesAndCharges = Number((sttCtt + exchangeTxnCharge + sebiTurnoverFee + stampDuty + gst).toFixed(2));
    const netObligation = Number((sellTurnover - buyTurnover - totalTaxesAndCharges).toFixed(2));
    const payType = netObligation >= 0 ? 'PAY_OUT_TO_CLIENT' : 'PAY_IN_BY_CLIENT';

    const d = new Date(targetDateStr + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 2);
    else if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);
    const settlementDate = d.toISOString().slice(0, 10);

    const clientCode = `TG-${(userRow?.id || userId).slice(0, 8).toUpperCase()}`;
    const contractNoteNo = `CN-${targetDateStr.replace(/-/g, '')}-${(userRow?.id || userId).slice(0, 6).toUpperCase()}`;

    res.json({
      success: true,
      contractNote: {
        contractNoteNo,
        tradeDate: targetDateStr,
        settlementDate,
        settlementNo: `2026${targetDateStr.replace(/-/g, '').slice(4)}`,
        broker: {
          name: 'Trade Grow (LLP)',
          tagline: 'Zero-Brokerage Intelligent Derivatives Trading',
          sebiRegNo: 'INZ000293431',
          nseMemberCode: '90234',
          bseMemberCode: '6743',
          mcxMemberCode: '56820',
          address: 'TradeGrow Towers, Bandra-Kurla Complex (BKC), Bandra East, Mumbai - 400051',
          email: 'info@tradegrowx.in',
          phone: '+91 95896 15649',
          website: 'https://tradegrowx.in',
        },
        client: {
          clientCode,
          name: userRow?.bank_account_name || userRow?.username || 'Valued Trader',
          email: userRow?.email || '',
          pan: userRow?.pan_number ? `${userRow.pan_number.slice(0, 2)}*****${userRow.pan_number.slice(-1)}` : 'PAN_ON_FILE',
          address: 'Registered Online Trading Account, India',
        },
        trades,
        financials: {
          buyTurnover: Number(buyTurnover.toFixed(2)),
          sellTurnover: Number(sellTurnover.toFixed(2)),
          totalTurnover,
          brokerage: 0.0,
          exchangeTxnCharge,
          sttCtt,
          sebiTurnoverFee,
          stampDuty,
          gst,
          totalTaxesAndCharges,
          netObligation,
          payType,
        },
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// 5B. CLIENT FUND DEPOSIT & WITHDRAWAL REQUESTS
// ============================================================
router.post('/funds/request', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { requestType, amount, paymentMethod, referenceNote } = req.body;
    const reqAmount = parseFloat(amount);

    if (!requestType || !['DEPOSIT', 'WITHDRAWAL'].includes(requestType)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_TYPE', message: 'Request type must be DEPOSIT or WITHDRAWAL' } });
      return;
    }

    if (isNaN(reqAmount) || reqAmount <= 0) {
      res.status(400).json({ success: false, error: { code: 'INVALID_AMOUNT', message: 'Amount must be greater than ₹0' } });
      return;
    }

    if (requestType === 'WITHDRAWAL') {
      const wallet = await VirtualWalletLedger.getWallet(req.user!.userId);
      if (!wallet || wallet.buyingPower < reqAmount) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_FUNDS',
            message: `Insufficient available funds for withdrawal. Available: ₹${wallet?.buyingPower.toFixed(2) || '0.00'}`
          }
        });
        return;
      }
    }

    const id = 'freq_' + generateUUID();
    const requestId = 'REQ' + generateUUID().slice(0, 8).toUpperCase();

    await execute(
      `INSERT INTO fund_requests (id, request_id, user_id, request_type, amount, status, payment_method, reference_note)
       VALUES ($1, $2, $3, $4, $5, 'PENDING', $6, $7)`,
      [id, requestId, req.user!.userId, requestType, reqAmount, paymentMethod || 'BANK_TRANSFER', referenceNote || '']
    );

    emitAdminFundRequestEvent(req.user!.userId, 'FUND_REQUEST_CREATED', {
      id, request_id: requestId, user_id: req.user!.userId, request_type: requestType,
      amount: reqAmount, status: 'PENDING', payment_method: paymentMethod || 'BANK_TRANSFER',
    });
    await createAdminNotification('FUND_REQUEST_CREATED', req.user!.userId, {
      severity: 'MEDIUM', requestId, requestType, amount: reqAmount,
    });

    // Super Admin Alert: New Deposit / Withdrawal Request
    (async () => {
      try {
        const userRow = await queryOne<any>('SELECT username, email, client_id FROM users WHERE id = $1', [req.user!.userId]);
        const { EmailService } = await import('../services/EmailService');
        EmailService.getInstance().sendSuperAdminAlert({
          subject: `New ${requestType} Request: ₹${reqAmount.toLocaleString('en-IN')} by ${userRow?.username || req.user!.username}`,
          eventType: 'FUND_REQUEST',
          summary: `A client has submitted a ${requestType.toLowerCase()} request for ₹${reqAmount.toLocaleString('en-IN')}. Pending administrator review and approval.`,
          details: [
            { label: 'Request Type', value: requestType },
            { label: 'Amount', value: `₹${reqAmount.toLocaleString('en-IN')}` },
            { label: 'Client Name', value: userRow?.username || req.user!.username },
            { label: 'Client ID', value: userRow?.client_id || 'Client' },
            { label: 'Email', value: userRow?.email || 'N/A' },
            { label: 'Payment Method', value: paymentMethod || 'BANK_TRANSFER' },
            { label: 'Request ID', value: requestId },
            { label: 'Reference Note', value: referenceNote || 'None' }
          ],
          actionUrl: `https://tradegrowx.in/admin?tab=funds`,
          actionLabel: 'Review Fund Request in Admin'
        });
      } catch (_) {}
    })();

    res.json({
      success: true,
      requestId,
      message: `${requestType === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'} request for ₹${reqAmount.toLocaleString('en-IN')} submitted. Pending Admin approval.`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.get('/funds/my-requests', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const requests = await query<any>(
      'SELECT * FROM fund_requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.user!.userId]
    );
    res.json({ success: true, requests });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/funds/instant', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { requestType, amount, paymentMethod, referenceNote } = req.body;
    const reqAmount = parseFloat(amount);

    if (!requestType || !['DEPOSIT', 'WITHDRAWAL'].includes(requestType)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_TYPE', message: 'Request type must be DEPOSIT or WITHDRAWAL' } });
      return;
    }

    if (isNaN(reqAmount) || reqAmount <= 0) {
      res.status(400).json({ success: false, error: { code: 'INVALID_AMOUNT', message: 'Amount must be greater than ₹0' } });
      return;
    }

    // Direct instant balance modification requires ADMIN privileges or explicit demo flag
    const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';
    const isDemoAllowed = process.env.ALLOW_DEMO_WALLET_TOPUP === 'true';
    if (requestType === 'DEPOSIT' && !isAdmin && !isDemoAllowed) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Instant capital deposit requires administrator approval. Please submit a deposit request via /funds/request.'
        }
      });
      return;
    }

    if (requestType === 'WITHDRAWAL') {
      const wallet = await VirtualWalletLedger.getWallet(req.user!.userId);
      if (!wallet || wallet.buyingPower < reqAmount) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_FUNDS',
            message: `Insufficient available funds for withdrawal. Available: ₹${wallet?.buyingPower.toFixed(2) || '0.00'}`
          }
        });
        return;
      }
    }

    const id = 'freq_' + generateUUID();
    const requestId = 'REQ' + generateUUID().slice(0, 8).toUpperCase();

    if (requestType === 'DEPOSIT') {
      await VirtualWalletLedger.adminAdjustBalance(req.user!.userId, reqAmount, req.user!.userId, 'Capital Deposit');
      await execute(
        `INSERT INTO fund_requests (id, request_id, user_id, request_type, amount, status, payment_method, reference_note)
         VALUES ($1, $2, $3, $4, $5, 'APPROVED', $6, $7)`,
        [id, requestId, req.user!.userId, requestType, reqAmount, paymentMethod || 'INSTANT', referenceNote || 'Submitted via Client App']
      );

      emitAdminFundRequestEvent(req.user!.userId, 'FUND_REQUEST_CREATED', {
        id, request_id: requestId, user_id: req.user!.userId, request_type: requestType,
        amount: reqAmount, status: 'APPROVED', payment_method: paymentMethod || 'INSTANT',
      });
      emitAdminFundsUpdate(req.user!.userId, null);

      res.json({
        success: true,
        requestId,
        message: `₹${reqAmount.toLocaleString('en-IN')} capital deposited successfully!`
      });
      return;
    }

    await execute(
      `INSERT INTO fund_requests (id, request_id, user_id, request_type, amount, status, payment_method, reference_note)
       VALUES ($1, $2, $3, $4, $5, 'PENDING', $6, $7)`,
      [id, requestId, req.user!.userId, requestType, reqAmount, paymentMethod || 'INSTANT', referenceNote || 'Submitted via Client App']
    );

    emitAdminFundRequestEvent(req.user!.userId, 'FUND_REQUEST_CREATED', {
      id, request_id: requestId, user_id: req.user!.userId, request_type: requestType,
      amount: reqAmount, status: 'PENDING', payment_method: paymentMethod || 'INSTANT',
    });
    await createAdminNotification('FUND_REQUEST_CREATED', req.user!.userId, {
      severity: 'MEDIUM', requestId, requestType, amount: reqAmount,
    });

    res.json({
      success: true,
      requestId,
      message: `Fund ${requestType.toLowerCase()} request for ₹${reqAmount.toLocaleString('en-IN')} submitted. Pending Admin approval.`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/funds/reset-margin', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Previously zeroed used_margin/realized_pnl/unrealized_pnl unconditionally
    // for any authenticated user, with no check for real open exposure — a
    // user with a live losing position could erase it from their own wallet
    // figures without ever closing it. Block the reset while anything is open.
    const [openPosition, pendingOrder] = await Promise.all([
      queryOne<any>('SELECT id FROM positions WHERE user_id = $1 AND net_qty != 0 LIMIT 1', [userId]),
      queryOne<any>(`SELECT id FROM orders WHERE user_id = $1 AND status IN ('ACCEPTED','PENDING','EXECUTING') LIMIT 1`, [userId]),
    ]);
    if (openPosition || pendingOrder) {
      res.status(409).json({
        success: false,
        error: { code: 'OPEN_EXPOSURE', message: 'Cannot reset balance while positions or orders are open. Close them first.' }
      });
      return;
    }

    const defaultCapital = parseFloat(process.env.DEFAULT_VIRTUAL_CAPITAL || '1000000');
    // B1 fix: the balance UPDATE and the ledger INSERT used to be two separate unprotected
    // statements (no lock, no shared transaction) — a crash or transient DB error between them
    // would leave the balance silently changed with no ledger row explaining it. The ledger row
    // also hardcoded balance_before to 0 regardless of the wallet's actual prior balance, which
    // is simply false whenever a user had any nonzero balance before resetting. Fixed by locking
    // the wallet row, using its real prior value, and writing both in one transaction.
    let balanceBefore = 0;
    await withTransaction(async (client: any) => {
      const walletRow = await client.query('SELECT cash_balance FROM virtual_wallets WHERE user_id = $1 FOR UPDATE', [userId]);
      balanceBefore = parseFloat(walletRow.rows[0]?.cash_balance || '0');

      await client.query(
        `UPDATE virtual_wallets SET cash_balance = $1, realized_pnl = 0, unrealized_pnl = 0, updated_at = NOW() WHERE user_id = $2`,
        [defaultCapital, userId]
      );
      await client.query(
        `INSERT INTO wallet_ledger (id, transaction_id, user_id, transaction_type, amount, balance_before, balance_after, reference_id, created_by, metadata)
         VALUES ($1, $2, $3, 'MARGIN_RESET', $4, $5, $6, $7, $8, $9)`,
        ['led_' + generateUUID(), generateUUID(), userId, defaultCapital, balanceBefore, defaultCapital, userId, userId, JSON.stringify({ reason: 'Margin & Balance Reset' })]
      );
    });
    // No open positions/orders were confirmed above, so this resolves to 0 —
    // routed through the authoritative recompute rather than hardcoding it.
    await VirtualWalletLedger.recomputeUsedMarginForUser(userId);
    res.json({ success: true, message: `Balance reset to ₹${defaultCapital.toLocaleString('en-IN')}` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/funds/add-capital', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';
    const isDemoAllowed = process.env.ALLOW_DEMO_WALLET_TOPUP === 'true';
    if (!isAdmin && !isDemoAllowed) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Direct capital top-up requires administrator authorization. Please submit a deposit request via /funds/request.'
        }
      });
      return;
    }

    const { amount } = req.body;
    const addAmt = parseFloat(amount) || 100000;
    const userId = req.user!.userId;
    if (addAmt <= 0) {
      res.status(400).json({ success: false, error: { code: 'INVALID_AMOUNT', message: 'Amount must be greater than ₹0' } });
      return;
    }
    const updatedWallet = await VirtualWalletLedger.adminAdjustBalance(userId, addAmt, userId, 'Capital Top-up');
    res.json({
      success: true,
      message: `Successfully added ₹${addAmt.toLocaleString('en-IN')} capital.`,
      wallet: updatedWallet
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// 6. WATCHLISTS & ALERTS API (P2-7 FIX: IDOR ownership checks + Cloud Sync)
// ============================================================
const DEFAULT_USER_WATCHLISTS = [
  {
    name: 'Watchlist 1',
    isDefault: true,
    items: [
      { token: 'NSE_NIFTY50', symbol: 'NIFTY 50', exchange: 'NSE' },
      { token: 'BSE_SENSEX', symbol: 'SENSEX', exchange: 'BSE' },
      { token: 'NSE_RELIANCE', symbol: 'RELIANCE', exchange: 'NSE' },
      { token: 'NSE_TCS', symbol: 'TCS', exchange: 'NSE' },
      { token: 'NSE_INFY', symbol: 'INFY', exchange: 'NSE' },
      { token: 'NSE_HDFCBANK', symbol: 'HDFCBANK', exchange: 'NSE' },
      { token: 'NSE_ICICIBANK', symbol: 'ICICIBANK', exchange: 'NSE' },
      { token: 'NSE_TATAMOTORS', symbol: 'TATAMOTORS', exchange: 'NSE' },
    ]
  },
  {
    name: 'F&O Active',
    isDefault: false,
    items: [
      { token: 'NSE_NIFTY50', symbol: 'NIFTY 50', exchange: 'NSE' },
      { token: 'NSE_BANKNIFTY', symbol: 'BANK NIFTY', exchange: 'NSE' },
      { token: 'BSE_SENSEX', symbol: 'SENSEX', exchange: 'BSE' },
      { token: 'NSE_RELIANCE', symbol: 'RELIANCE', exchange: 'NSE' }
    ]
  },
  {
    name: 'Indices',
    isDefault: false,
    items: [
      { token: 'NSE_NIFTY50', symbol: 'NIFTY 50', exchange: 'NSE' },
      { token: 'BSE_SENSEX', symbol: 'SENSEX', exchange: 'BSE' },
      { token: 'NSE_BANKNIFTY', symbol: 'BANK NIFTY', exchange: 'NSE' },
      { token: 'NSE_FINNIFTY', symbol: 'FIN NIFTY', exchange: 'NSE' },
      { token: 'NSE_MIDCPNIFTY', symbol: 'MIDCP NIFTY', exchange: 'NSE' },
    ]
  },
  {
    name: 'Commodities',
    isDefault: false,
    items: [
      { token: 'MCX_CRUDEOIL', symbol: 'CRUDEOIL', exchange: 'MCX' },
      { token: 'MCX_GOLD', symbol: 'GOLD', exchange: 'MCX' },
      { token: 'MCX_SILVER', symbol: 'SILVER', exchange: 'MCX' },
      { token: 'MCX_NATURALGAS', symbol: 'NATURALGAS', exchange: 'MCX' },
    ]
  }
];

router.get('/watchlists', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    let watchlists = await query<any>('SELECT * FROM watchlists WHERE user_id = $1 ORDER BY created_at ASC', [userId]);

    // Auto-seed default 4 cloud watchlists if new user has none
    if (watchlists.length === 0) {
      await withTransaction(async (client) => {
        for (let i = 0; i < DEFAULT_USER_WATCHLISTS.length; i++) {
          const defWl = DEFAULT_USER_WATCHLISTS[i];
          const wlId = 'wl_' + generateUUID();
          await client.query(
            'INSERT INTO watchlists (id, user_id, name, is_default) VALUES ($1, $2, $3, $4)',
            [wlId, userId, defWl.name, defWl.isDefault]
          );
          for (let j = 0; j < defWl.items.length; j++) {
            const it = defWl.items[j];
            await client.query(
              'INSERT INTO watchlist_items (id, watchlist_id, instrument_token, symbol, exchange, sort_order) VALUES ($1, $2, $3, $4, $5, $6)',
              ['wli_' + generateUUID(), wlId, it.token, it.symbol, it.exchange, j]
            );
          }
        }
      });
      watchlists = await query<any>('SELECT * FROM watchlists WHERE user_id = $1 ORDER BY created_at ASC', [userId]);
    }

    for (const wl of watchlists) {
      wl.items = await query('SELECT * FROM watchlist_items WHERE watchlist_id = $1 ORDER BY sort_order ASC, added_at DESC', [wl.id]);
    }
    res.json({ success: true, watchlists });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message || 'Failed to fetch watchlists' } });
  }
});

router.post('/watchlists', authenticateToken, validateBody(CreateWatchlistSchema), async (req: AuthenticatedRequest, res) => {
  const { name } = req.body;
  const wlId = 'wl_' + generateUUID();
  await execute('INSERT INTO watchlists (id, user_id, name) VALUES ($1, $2, $3)', [wlId, req.user!.userId, name]);
  res.json({ success: true, watchlistId: wlId });
});

router.put('/watchlists/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string') {
    res.status(400).json({ success: false, error: { message: 'Watchlist name is required' } });
    return;
  }
  const result = await execute('UPDATE watchlists SET name = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3', [name.trim(), req.params.id, req.user!.userId]);
  res.json({ success: true });
});

router.delete('/watchlists/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  await execute('DELETE FROM watchlists WHERE id = $1 AND user_id = $2', [req.params.id, req.user!.userId]);
  res.json({ success: true });
});

router.post('/watchlists/items', authenticateToken, validateBody(AddWatchlistItemSchema), async (req: AuthenticatedRequest, res) => {
  const { watchlistId, instrumentToken, symbol, exchange } = req.body;

  // Ownership check — P2-7 FIX
  const watchlist = await queryOne<any>(
    'SELECT id FROM watchlists WHERE id = $1 AND user_id = $2',
    [watchlistId, req.user!.userId]
  );
  if (!watchlist) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Watchlist not found' } });
    return;
  }

  const itemId = 'wli_' + generateUUID();
  await execute(
    'INSERT INTO watchlist_items (id, watchlist_id, instrument_token, symbol, exchange) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (watchlist_id, instrument_token) DO NOTHING',
    [itemId, watchlistId, instrumentToken, symbol, exchange]
  );
  res.json({ success: true, itemId });
});

router.delete('/watchlists/items/by-token', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const { watchlistId, instrumentToken } = req.body;
  if (!watchlistId || !instrumentToken) {
    res.status(400).json({ success: false, error: { message: 'watchlistId and instrumentToken required' } });
    return;
  }
  const item = await queryOne<any>(
    `SELECT wi.id FROM watchlist_items wi
     JOIN watchlists w ON w.id = wi.watchlist_id
     WHERE wi.watchlist_id = $1 AND wi.instrument_token = $2 AND w.user_id = $3`,
    [watchlistId, instrumentToken, req.user!.userId]
  );
  if (!item) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Item not found in watchlist' } });
    return;
  }
  await execute('DELETE FROM watchlist_items WHERE id = $1', [item.id]);
  res.json({ success: true });
});

router.post('/watchlists/sync', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const { watchlistId, tokens } = req.body;
  if (!watchlistId || !Array.isArray(tokens)) {
    res.status(400).json({ success: false, error: { message: 'Invalid payload' } });
    return;
  }
  const watchlist = await queryOne<any>(
    'SELECT id FROM watchlists WHERE id = $1 AND user_id = $2',
    [watchlistId, req.user!.userId]
  );
  if (!watchlist) {
    res.status(404).json({ success: false, error: { message: 'Watchlist not found' } });
    return;
  }

  await withTransaction(async (client) => {
    for (let i = 0; i < tokens.length; i++) {
      await client.query(
        'UPDATE watchlist_items SET sort_order = $1 WHERE watchlist_id = $2 AND instrument_token = $3',
        [i, watchlistId, tokens[i]]
      );
    }
  });
  res.json({ success: true });
});

router.delete('/watchlists/items/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  // P2-7 FIX: Ownership check prevents IDOR
  const item = await queryOne<any>(
    `SELECT wi.id FROM watchlist_items wi
     JOIN watchlists w ON w.id = wi.watchlist_id
     WHERE wi.id = $1 AND w.user_id = $2`,
    [req.params.id, req.user!.userId]
  );

  if (!item) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Watchlist item not found' } });
    return;
  }

  await execute('DELETE FROM watchlist_items WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

// ============================================================
// 7. ADMIN API
// ============================================================
router.get('/admin/dashboard', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RISK_MANAGER']), async (req: AuthenticatedRequest, res) => {
  const [totalUsersRow, activeOrdersRow, totalExecRow, capitalRow] = await Promise.all([
    queryOne<any>('SELECT COUNT(*) as c FROM users'),
    queryOne<any>(`SELECT COUNT(*) as c FROM orders WHERE status IN ('ACCEPTED','PENDING')`),
    queryOne<any>('SELECT COUNT(*) as c FROM executions'),
    queryOne<any>('SELECT SUM(cash_balance) as s FROM virtual_wallets')
  ]);

  res.json({
    success: true,
    telemetry: {
      totalUsers:           parseInt(totalUsersRow?.c || '0'),
      activeOrdersToday:    parseInt(activeOrdersRow?.c || '0'),
      totalExecutionsToday: parseInt(totalExecRow?.c || '0'),
      totalCapital:         parseFloat(capitalRow?.s || '0'),
      totalVirtualCapital:  parseFloat(capitalRow?.s || '0'),
      marketDataProvider:   MarketDataEngine.getInstance().getActiveProviderName(),
      systemHealth:         'OPERATIONAL',
      safetyLockActive:     true
    }
  });
});

router.get('/admin/users', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), async (req: AuthenticatedRequest, res) => {
  const limit  = Math.min(parseInt(req.query.limit as string || '50', 10), 200);
  const offset = parseInt(req.query.offset as string || '0', 10);

  const users = await query(
    `SELECT u.id, u.username, u.email, u.role, u.status, u.created_at, u.last_login_at,
            w.cash_balance, w.used_margin
     FROM users u
     LEFT JOIN virtual_wallets w ON u.id = w.user_id
     ORDER BY u.created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  res.json({ success: true, users, pagination: { limit, offset } });
});

router.post('/admin/users/:id/adjust-balance', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN']), validateBody(AdminAdjustBalanceSchema), async (req: AuthenticatedRequest, res) => {
  const { amount, reason } = req.body;
  const targetUserId = req.params.id as string;

  const user = await queryOne<any>('SELECT id FROM users WHERE id = $1', [targetUserId]);
  if (!user) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    return;
  }

  const updatedWallet = await VirtualWalletLedger.adminAdjustBalance(targetUserId, parseFloat(amount), req.user!.userId, reason);
  await logAuditAction(req.user!.userId, req.user!.role, 'ADMIN_ADJUST_BALANCE', 'VIRTUAL_WALLET', targetUserId, null, { amount, reason }, getClientIp(req));
  res.json({ success: true, wallet: updatedWallet });
});

router.post('/admin/users/:id/status', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN']), validateBody(UpdateUserStatusSchema), async (req: AuthenticatedRequest, res) => {
  const { status, reason } = req.body;
  await execute('UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2', [status, req.params.id]);
  await logAuditAction(req.user!.userId, req.user!.role, 'UPDATE_USER_STATUS', 'USER', req.params.id as string, null, { status, reason }, getClientIp(req));
  res.json({ success: true });
});

router.post('/admin/users/:id/role', authenticateToken, checkRole(['SUPER_ADMIN']), validateBody(UpdateUserRoleSchema), async (req: AuthenticatedRequest, res) => {
  const { role } = req.body;
  await execute('UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2', [role, req.params.id]);
  await logAuditAction(req.user!.userId, req.user!.role, 'UPDATE_USER_ROLE', 'USER', req.params.id as string, null, { role }, getClientIp(req));
  res.json({ success: true });
});

router.get('/admin/audit-logs', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'READ_ONLY_AUDITOR']), async (req: AuthenticatedRequest, res) => {
  const limit  = Math.min(parseInt(req.query.limit as string || '100', 10), 500);
  const offset = parseInt(req.query.offset as string || '0', 10);
  const logs = await query('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT $1 OFFSET $2', [limit, offset]);
  res.json({ success: true, logs, pagination: { limit, offset } });
});

router.get('/admin/risk-settings', authenticateToken, checkPermission('RMS_VIEW'), async (req, res) => {
  const settings = await query('SELECT key, value, description, updated_at FROM system_settings WHERE is_secret = FALSE');
  res.json({ success: true, settings });
});

router.post('/admin/risk-settings', authenticateToken, checkPermission('RISK_LIMITS_EDIT'), validateBody(UpdateRiskSettingSchema), async (req: AuthenticatedRequest, res) => {
  const { key, value } = req.body;

  // Guard: Never allow disabling safety lock through API
  if (key === 'REAL_MONEY_TRADING') {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'REAL_MONEY_TRADING setting cannot be modified via API. It is permanently locked to false.' } });
    return;
  }

  await execute('UPDATE system_settings SET value = $1, updated_by = $2, updated_at = NOW() WHERE key = $3', [value, req.user!.userId, key]);
  await logAuditAction(req.user!.userId, req.user!.role, 'UPDATE_RISK_SETTING', 'SYSTEM_SETTING', key, null, { value }, getClientIp(req));
  res.json({ success: true });
});

router.post('/admin/instruments/sync', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN']), async (req: AuthenticatedRequest, res) => {
  try {
    const result = await InstrumentMasterService.getInstance().syncMasterData();
    await logAuditAction(req.user!.userId, req.user!.role, 'SYNC_INSTRUMENT_MASTER', 'INSTRUMENT_MASTER', result.versionId, null, result, getClientIp(req));
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/admin/instruments/versions', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'READ_ONLY_AUDITOR']), async (req, res) => {
  const versions = await query('SELECT * FROM instrument_master_versions ORDER BY created_at DESC LIMIT 20');
  res.json({ success: true, versions });
});

// ============================================================
// 6. CUSTOMER KYC & PROFILE VERIFICATION API
// ============================================================
router.get('/kyc/status', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const uRow = await queryOne<any>(
      'SELECT id, username, email, is_kyc_completed, bank_name, bank_account_number, bank_account_name, bank_ifsc, onboarding_completed FROM users WHERE id = $1',
      [userId]
    );

    const kycApp = await queryOne<any>(
      'SELECT * FROM kyc_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [userId]
    );

    const isKycOk = uRow?.is_kyc_completed || ['APPROVED', 'SUBMITTED'].includes(kycApp?.status) || ['SUPER_ADMIN', 'ADMIN'].includes(req.user!.role);

    let documents: any[] = [];
    if (kycApp) {
      documents = await query(
        'SELECT id, document_type, original_filename, mime_type, file_size, uploaded_at FROM kyc_documents WHERE kyc_application_id = $1',
        [kycApp.id]
      );
    }

    res.json({
      success: true,
      status: kycApp?.status || (isKycOk ? 'APPROVED' : 'NOT_STARTED'),
      isKycCompleted: !!uRow?.is_kyc_completed,
      verificationMethod: kycApp?.verification_method || 'MANUAL',
      diditSessionId: kycApp?.didit_session_id || null,
      diditSessionUrl: kycApp?.didit_session_url || null,
      diditSessionStatus: kycApp?.didit_session_status || null,
      application: kycApp,
      documents,
      bankDetails: {
        bankName: uRow?.bank_name || kycApp?.bank_name || '',
        bankAccountNumber: uRow?.bank_account_number || kycApp?.bank_account_number || '',
        bankAccountName: uRow?.bank_account_name || kycApp?.bank_account_name || '',
        bankIfsc: uRow?.bank_ifsc || kycApp?.bank_ifsc || ''
      },
      onboardingCompleted: !!uRow?.onboarding_completed
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create Didit Online Verification Session
router.post('/kyc/didit/create-session', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { callbackUrl } = req.body;
    const result = await DiditService.createVerificationSession({
      userId: req.user!.userId,
      callbackUrl,
      clientIp: getClientIp(req)
    });

    if (!result.success) {
      res.status(400).json({ success: false, error: { message: result.error || 'Failed to create verification session' } });
      return;
    }

    res.json({
      success: true,
      session: result.session
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message || 'Internal server error' } });
  }
});

// Check/Sync Didit Online Verification Status
router.get('/kyc/didit/status', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await DiditService.syncSessionDecision(req.user!.userId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message || 'Internal server error' } });
  }
});

// Didit Webhook Callback
router.post('/kyc/didit/webhook', async (req: Request, res: Response) => {
  try {
    await DiditService.handleWebhook(req.body);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update Bank Details
router.post('/bank/update', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { bankName, bankAccountNumber, bankAccountName, bankIfsc } = req.body;
    const userId = req.user!.userId;

    if (!bankAccountNumber || !bankIfsc) {
      res.status(400).json({ success: false, error: { message: 'Bank account number and IFSC code are required' } });
      return;
    }

    // Save to users table
    await execute(
      `UPDATE users SET
        bank_name = $1,
        bank_account_number = $2,
        bank_account_name = $3,
        bank_ifsc = $4,
        updated_at = NOW()
      WHERE id = $5`,
      [bankName || '', bankAccountNumber, bankAccountName || '', bankIfsc.toUpperCase(), userId]
    );

    // Also update active KYC application if present
    await execute(
      `UPDATE kyc_applications SET
        bank_name = $1,
        bank_account_number = $2,
        bank_account_name = $3,
        bank_ifsc = $4,
        updated_at = NOW()
      WHERE user_id = $5`,
      [bankName || '', bankAccountNumber, bankAccountName || '', bankIfsc.toUpperCase(), userId]
    );

    await logAuditAction(userId, req.user!.role, 'UPDATE_BANK_DETAILS', 'BANK_ACCOUNT', userId, null, { bankName, bankIfsc }, getClientIp(req));

    res.json({ success: true, message: 'Bank account details updated successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message || 'Internal server error' } });
  }
});

// Complete Onboarding Pipeline
router.post('/onboarding/complete', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await execute('UPDATE users SET onboarding_completed = TRUE, updated_at = NOW() WHERE id = $1', [req.user!.userId]);
    res.json({ success: true, message: 'Onboarding completed' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message || 'Internal server error' } });
  }
});

router.post(
  '/kyc/submit',
  authenticateToken,
  kycUpload.fields([
    { name: 'panDoc', maxCount: 1 },
    { name: 'panDocument', maxCount: 1 },
    { name: 'aadhaarFrontDoc', maxCount: 1 },
    { name: 'aadhaarFront', maxCount: 1 },
    { name: 'aadhaarBackDoc', maxCount: 1 },
    { name: 'aadhaarBack', maxCount: 1 },
    { name: 'bankProofDoc', maxCount: 1 },
    { name: 'bankProof', maxCount: 1 }
  ]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { panNumber, aadhaarNumber, bankAccountName, bankAccountNumber, bankIfsc, bankName } = req.body;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

      if (!panNumber || !aadhaarNumber) {
        res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'PAN and Aadhaar numbers are required' } });
        return;
      }

      let kycApp = await queryOne<any>(
        'SELECT * FROM kyc_applications WHERE user_id = $1 AND status IN (\'SUBMITTED\', \'UNDER_REVIEW\', \'APPROVED\') ORDER BY created_at DESC LIMIT 1',
        [req.user!.userId]
      );

      if (kycApp && kycApp.status === 'APPROVED') {
        res.status(400).json({ success: false, error: { code: 'ALREADY_APPROVED', message: 'Your KYC is already approved' } });
        return;
      }

      const appId = kycApp ? kycApp.id : 'kyc_' + generateUUID();

      if (!kycApp) {
        await execute(
          `INSERT INTO kyc_applications (id, user_id, verification_method, pan_number, aadhaar_number, bank_account_name, bank_account_number, bank_ifsc, bank_name, status, submitted_at)
           VALUES ($1, $2, 'MANUAL', $3, $4, $5, $6, $7, $8, 'SUBMITTED', NOW())`,
          [appId, req.user!.userId, panNumber, aadhaarNumber, bankAccountName || '', bankAccountNumber || '', bankIfsc || '', bankName || '']
        );
      } else {
        await execute(
          `UPDATE kyc_applications
           SET verification_method = 'MANUAL', pan_number = $1, aadhaar_number = $2, bank_account_name = $3, bank_account_number = $4, bank_ifsc = $5, bank_name = $6, status = 'SUBMITTED', submitted_at = NOW(), updated_at = NOW()
           WHERE id = $7`,
          [panNumber, aadhaarNumber, bankAccountName || '', bankAccountNumber || '', bankIfsc || '', bankName || '', appId]
        );
      }

      // Also save bank details to user record if provided
      if (bankAccountNumber && bankIfsc) {
        await execute(
          `UPDATE users SET bank_name = $1, bank_account_number = $2, bank_account_name = $3, bank_ifsc = $4 WHERE id = $5`,
          [bankName || '', bankAccountNumber, bankAccountName || '', bankIfsc.toUpperCase(), req.user!.userId]
        );
      }

      // Record uploaded document entries
      if (files) {
        const docConfigs = [
          { keys: ['panDoc', 'panDocument'], type: 'PAN_CARD' },
          { keys: ['aadhaarFrontDoc', 'aadhaarFront'], type: 'AADHAAR_FRONT' },
          { keys: ['aadhaarBackDoc', 'aadhaarBack'], type: 'AADHAAR_BACK' },
          { keys: ['bankProofDoc', 'bankProof'], type: 'BANK_PROOF' }
        ];

        for (const item of docConfigs) {
          let fileObj: Express.Multer.File | undefined;
          for (const k of item.keys) {
            if (files[k] && files[k].length > 0) {
              fileObj = files[k][0];
              break;
            }
          }

          if (fileObj) {
            // Remove previous document of this type for this application before inserting the updated one
            await execute(
              `DELETE FROM kyc_documents WHERE kyc_application_id = $1 AND document_type = $2`,
              [appId, item.type]
            );

            await execute(
              `INSERT INTO kyc_documents (id, kyc_application_id, document_type, file_path, original_filename, mime_type, file_size)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              ['doc_' + generateUUID(), appId, item.type, fileObj.path, fileObj.originalname, fileObj.mimetype, fileObj.size]
            );
          }
        }
      }

      await logAuditAction(req.user!.userId, req.user!.role, 'SUBMIT_KYC', 'KYC_APPLICATION', appId, null, { panNumber, aadhaarNumber }, getClientIp(req));

      // Super Admin Alert: New KYC Application Submitted
      (async () => {
        try {
          const userRow = await queryOne<any>('SELECT username, email, client_id, phone_number FROM users WHERE id = $1', [req.user!.userId]);
          const { EmailService } = await import('../services/EmailService');
          EmailService.getInstance().sendSuperAdminAlert({
            subject: `New KYC Application: ${userRow?.username || req.user!.username} (${userRow?.client_id || 'Client'})`,
            eventType: 'KYC_SUBMITTED',
            summary: `A client has uploaded identity documents and submitted their KYC application for review.`,
            details: [
              { label: 'Client Name', value: userRow?.username || req.user!.username },
              { label: 'Client ID', value: userRow?.client_id || 'Client' },
              { label: 'Email', value: userRow?.email || 'N/A' },
              { label: 'Phone', value: userRow?.phone_number || 'N/A' },
              { label: 'PAN Masked', value: panNumber ? `${panNumber.slice(0, 2)}XXXXX${panNumber.slice(-2)}` : 'Submitted' },
              { label: 'Aadhaar Masked', value: aadhaarNumber ? `XXXXXXXX${aadhaarNumber.slice(-4)}` : 'Submitted' },
              { label: 'Bank Name', value: bankName || 'Not specified' },
              { label: 'Application ID', value: appId }
            ],
            actionUrl: `https://tradegrowx.in/admin?tab=kyc`,
            actionLabel: 'Review KYC in Admin'
          });
        } catch (_) {}
      })();

      res.json({ success: true, message: 'KYC application and documents submitted successfully for review.' });
    } catch (err: any) {
      console.error('[KYC Submit Error]', err);
      res.status(500).json({ success: false, error: { message: err.message || 'Internal server error while submitting KYC' } });
    }
  }
);

// ============================================================
// 7. 24x7 CUSTOMER SUPPORT TICKETING API
// ============================================================
router.get('/support/tickets', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tickets = await query(
      'SELECT * FROM support_tickets WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user!.userId]
    );
    res.json({ success: true, tickets });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/support/tickets', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { category, priority, subject, description } = req.body;

    if (!subject || !description) {
      res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'Subject and description are required' } });
      return;
    }

    const ticketId = 'tkt_' + generateUUID();
    await execute(
      `INSERT INTO support_tickets (id, user_id, category, priority, subject, description, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'OPEN')`,
      [ticketId, req.user!.userId, category || 'GENERAL', priority || 'MEDIUM', subject, description]
    );

    res.status(201).json({ success: true, ticketId, message: 'Support ticket submitted successfully. Our team will respond shortly.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// LIVE CHAT (customer side) — Support Chats, the last of the four
// deferred items from Phase F1's gap analysis. Distinct from the
// async ticketing system above: a continuous, real-time thread.
// ============================================================
router.get('/chat/messages', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const messages = await getChatHistory(req.user!.userId);
    res.json({ success: true, messages });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// REST fallback for sending — the live path is the WS CHAT_SEND action; this exists
// so a message can still be sent (and reach any online staff via the same
// recordChatMessage delivery) if the customer's socket is temporarily down.
router.post('/chat/messages', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ success: false, error: { code: 'MISSING_TEXT', message: 'Message text is required' } });
      return;
    }
    const customerId = req.user!.userId;
    const row = await recordChatMessage(customerId, customerId, req.user!.role, text.trim().slice(0, 4000));
    deliverToUser(customerId, { type: 'CHAT_MESSAGE_RECEIVED', userId: customerId, data: { message: row }, timestamp: Date.now() });
    res.status(201).json({ success: true, message: row });

    // AI auto-reply — fire-and-forget, same as the WS CHAT_SEND path (see supportBot.ts).
    maybeGenerateSupportBotReply(customerId)
      .then((botRow) => {
        if (botRow) deliverToUser(customerId, { type: 'CHAT_MESSAGE_RECEIVED', userId: customerId, data: { message: botRow }, timestamp: Date.now() });
      })
      .catch((err: any) => console.error('[REST /chat/messages] Support bot reply failed:', err.message));
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/admin/feature-flags', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  const flags = await query('SELECT * FROM feature_flags ORDER BY key');
  res.json({ success: true, flags });
});

// ============================================================
// CUSTOMER PAYMENT & BANK SETTINGS API (Plain Authenticated)
// ============================================================
router.get('/funds/payment-settings', authenticateToken, async (_req: AuthenticatedRequest, res: Response) => {
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
        bankDetails: {
          bankName: settingsMap['MERCHANT_BANK_NAME'] || 'HDFC Bank',
          accountName: settingsMap['MERCHANT_ACCOUNT_NAME'] || 'Trade Grow Technologies Pvt Ltd',
          accountNumber: settingsMap['MERCHANT_ACCOUNT_NUMBER'] || '50200098765432',
          ifscCode: settingsMap['MERCHANT_IFSC'] || 'HDFC0001234',
          branch: settingsMap['MERCHANT_BRANCH'] || 'Mumbai Main Branch'
        }
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

export default router;

