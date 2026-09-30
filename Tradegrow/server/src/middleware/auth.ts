import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { queryOne } from '../db/schema';
import { getPermissionCatalogEntry } from '../config/permissionCatalog';

export interface AuthenticatedUser {
  userId: string;
  username: string;
  email: string;
  role: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  requestId?: string;
}

/**
 * P0-3 FIX: JWT_SECRET is required. No hardcoded fallback.
 * Server will refuse to start if JWT_SECRET is not set (enforced in index.ts startup check).
 */
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('[STARTUP FATAL] JWT_SECRET environment variable is not set or is too short (minimum 32 characters). Server cannot start.');
  }
  return secret;
}

const authUserCache = new Map<string, { user: AuthenticatedUser; expiresAt: number }>();

export async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null) || (req.query?.token as string) || null;

  if (!token) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication token missing' } });
    return;
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as AuthenticatedUser;
    req.user = decoded;

    // Check in-memory cache for user verification to prevent per-request DB queries
    const cached = authUserCache.get(decoded.userId);
    if (cached && Date.now() < cached.expiresAt) {
      req.user.role = cached.user.role;
      return next();
    }

    // Verify user existence in database
    const dbUser = await queryOne<any>('SELECT id, username, email, role FROM users WHERE id = $1', [decoded.userId]);
    if (dbUser) {
      req.user.role = dbUser.role;
      authUserCache.set(decoded.userId, { user: { ...decoded, role: dbUser.role }, expiresAt: Date.now() + 60000 });
    } else {
      // Look up by email or username in case database was re-seeded with new UUIDs
      const matchedUser = await queryOne<any>(
        'SELECT id, username, email, role FROM users WHERE email = $1 OR username = $2',
        [decoded.email || '', decoded.username || '']
      );
      if (matchedUser) {
        req.user.userId = matchedUser.id;
        req.user.role = matchedUser.role;
        authUserCache.set(matchedUser.id, { user: { ...decoded, userId: matchedUser.id, role: matchedUser.role }, expiresAt: Date.now() + 60000 });
      } else {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User account not found in database. Please log out and log in again.' }
        });
        return;
      }
    }
    next();
  } catch (err) {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Invalid or expired token' } });
  }
}

export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (token) {
    try {
      const decoded = jwt.verify(token, getJwtSecret()) as AuthenticatedUser;
      req.user = decoded;
    } catch (err) {
      // Token invalid — continue unauthenticated (for public endpoints)
    }
  }
  next();
}

export function checkRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: `Access denied. Role '${req.user.role}' is not authorized to access this resource.`
        }
      });
      return;
    }

    next();
  };
}

export function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  checkRole(['SUPER_ADMIN'])(req, res, next);
}

/**
 * Granular-permission gate (Phase 3). Looks up `key` in the permission
 * catalog, checks `manager_permissions` for a per-user override, and falls
 * back to the catalog's `defaultRoles` when no override exists. Fails closed
 * (403) both when the key itself is unknown (a coding mistake, not a
 * legitimate access decision) and on a DB error during the override lookup —
 * this gates real liquidation/financial controls, not a hot path, so
 * conservative-on-error is the right default.
 */
export function checkPermission(key: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
      return;
    }

    const entry = getPermissionCatalogEntry(key);
    if (!entry) {
      res.status(403).json({
        success: false,
        error: { code: 'PERMISSION_DENIED', message: `Unknown permission key '${key}'.` }
      });
      return;
    }

    try {
      const override = await queryOne<{ granted: boolean }>(
        `SELECT granted FROM manager_permissions WHERE manager_id = $1 AND permission_key = $2`,
        [req.user.userId, key]
      );

      const allowed = override ? !!override.granted : entry.defaultRoles.includes(req.user.role);

      if (!allowed) {
        res.status(403).json({
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: `Access denied. You do not have the '${key}' permission required for this action.`
          }
        });
        return;
      }

      next();
    } catch (err: any) {
      console.error(`[checkPermission] Lookup failed for key='${key}', user='${req.user.userId}':`, err.message || err);
      res.status(403).json({
        success: false,
        error: { code: 'PERMISSION_DENIED', message: 'Unable to verify permission. Access denied.' }
      });
    }
  };
}

/**
 * Used at server startup to validate all required environment variables are present.
 * Throws with a clear message and exits the process if any critical variable is missing.
 */
export function validateStartupEnvironment(): void {
  const required: Array<{ key: string; minLength?: number; description: string }> = [
    { key: 'JWT_SECRET', minLength: 32, description: 'JWT signing secret (min 32 chars)' },
    { key: 'JWT_REFRESH_SECRET', minLength: 32, description: 'JWT refresh token secret (min 32 chars)' }
  ];

  const errors: string[] = [];

  for (const req of required) {
    const val = process.env[req.key];
    if (!val) {
      errors.push(`  ❌ ${req.key}: missing — ${req.description}`);
    } else if (req.minLength && val.length < req.minLength) {
      errors.push(`  ❌ ${req.key}: too short (${val.length} chars, need ≥ ${req.minLength}) — ${req.description}`);
    }
  }

  if (errors.length > 0) {
    console.error('\n[FATAL] Required environment variables are not set or invalid:');
    errors.forEach(e => console.error(e));
    console.error('\nSet these in your .env file and restart the server.\n');
    process.exit(1);
  }

  console.log('[Auth] Environment validation passed. JWT_SECRET is set and valid.');
}

export function getRefreshSecret(): string {
  return process.env.JWT_REFRESH_SECRET || (getJwtSecret() + '_refresh');
}

export { getJwtSecret };

