import argon2 from 'argon2';
import { query, queryOne, withTransaction } from '../db/schema';
import { generateUUID } from '../utils/crypto';
import { logAuditAction } from '../middleware/audit';

export interface CreateClientInput {
  username?: string;
  email: string;
  password?: string;
  role?: string;
  clientId?: string;
  fullName?: string;
  phoneNumber?: string;
  city?: string;
  address?: string;
  dateOfBirth?: string;
  initialCapital?: number;
  creatorId?: string;
  creatorRole?: string;
  creatorIp?: string;
}

export interface ClientCreationResult {
  success: boolean;
  user?: {
    id: string;
    clientId: string;
    username: string;
    email: string;
    role: string;
    status: string;
    fullName?: string;
    phoneNumber?: string;
  };
  error?: {
    code: string;
    field?: string;
    message: string;
    existingCustomer?: any;
  };
}

export class ClientCreationService {
  /**
   * Centralized email normalization rule:
   * 1. Trim leading/trailing whitespace
   * 2. Convert to lowercase
   * 3. Validate RFC-compliant email structure
   */
  public static normalizeEmail(email: string): string {
    if (!email) return '';
    return email.trim().toLowerCase();
  }

  /**
   * Centralized username normalization:
   * 1. Trim whitespace
   * 2. Remove redundant internal spacing
   */
  public static normalizeUsername(username: string): string {
    if (!username) return '';
    return username.trim().replace(/\s+/g, ' ');
  }

  /**
   * Validates standard email address format
   */
  public static isValidEmail(email: string): boolean {
    const norm = this.normalizeEmail(email);
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(norm);
  }

  /**
   * Generates a collision-free, standardized Client ID (e.g. TG-USR-A7F7 or TG-USR-36A4)
   */
  public static async generateUniqueClientId(): Promise<string> {
    for (let attempts = 0; attempts < 10; attempts++) {
      const randomHex = Math.random().toString(16).substring(2, 6).toUpperCase();
      const candidateId = `TG-USR-${randomHex}`;

      const existing = await queryOne<any>(
        'SELECT id FROM users WHERE client_id = $1',
        [candidateId]
      );

      if (!existing) {
        return candidateId;
      }
    }

    // Fallback if random hex has high collisions
    const fallbackHex = generateUUID().replace(/-/g, '').substring(0, 6).toUpperCase();
    return `TG-USR-${fallbackHex}`;
  }

  /**
   * Generates a clean, unique, collision-free username.
   * e.g. from email "rahul.sharma@gmail.com" -> "rahul" or "rahul_482" or "trader_a7f7"
   */
  public static async generateUniqueUsername(email?: string): Promise<string> {
    let base = 'trader';
    if (email) {
      const prefix = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      if (prefix.length >= 3) {
        base = prefix.substring(0, 15);
      }
    }

    // Check if clean base is available
    const existingBase = await queryOne<any>(
      'SELECT id FROM users WHERE LOWER(TRIM(username)) = $1',
      [base.toLowerCase()]
    );
    if (!existingBase) {
      return base;
    }

    // Otherwise generate with unique random digits / hex
    for (let i = 0; i < 15; i++) {
      const randomSuffix = Math.floor(100 + Math.random() * 9000);
      const candidate = `${base}_${randomSuffix}`;
      const existing = await queryOne<any>(
        'SELECT id FROM users WHERE LOWER(TRIM(username)) = $1',
        [candidate.toLowerCase()]
      );
      if (!existing) {
        return candidate;
      }
    }

    const fallbackHex = Math.random().toString(36).substring(2, 6).toLowerCase();
    return `${base}_${fallbackHex}`;
  }

  /**
   * Real-time duplicate checker for frontend pre-validation
   */
  public static async checkDuplicate(params: {
    email?: string;
    username?: string;
    clientId?: string;
    excludeUserId?: string;
  }): Promise<{ isDuplicate: boolean; field?: string; message?: string; existingCustomer?: any }> {
    const { email, username, clientId, excludeUserId } = params;

    if (email) {
      const normEmail = this.normalizeEmail(email);
      let sql = 'SELECT id, client_id, username, email, status, role, created_at FROM users WHERE LOWER(TRIM(email)) = $1';
      const qParams: any[] = [normEmail];
      if (excludeUserId) {
        sql += ' AND id != $2';
        qParams.push(excludeUserId);
      }
      const existing = await queryOne<any>(sql, qParams);
      if (existing) {
        return {
          isDuplicate: true,
          field: 'email',
          message: `An account already exists with email '${normEmail}'.`,
          existingCustomer: {
            id: existing.id,
            clientId: existing.client_id || `TG-${existing.id.slice(0, 8).toUpperCase()}`,
            username: existing.username,
            email: existing.email,
            status: existing.status,
            createdAt: existing.created_at
          }
        };
      }
    }

    if (username) {
      const normUsername = this.normalizeUsername(username);
      let sql = 'SELECT id, client_id, username, email, status, role, created_at FROM users WHERE LOWER(TRIM(username)) = $1';
      const qParams: any[] = [normUsername.toLowerCase()];
      if (excludeUserId) {
        sql += ' AND id != $2';
        qParams.push(excludeUserId);
      }
      const existing = await queryOne<any>(sql, qParams);
      if (existing) {
        return {
          isDuplicate: true,
          field: 'username',
          message: `Username '${normUsername}' is already taken.`,
          existingCustomer: {
            id: existing.id,
            clientId: existing.client_id || `TG-${existing.id.slice(0, 8).toUpperCase()}`,
            username: existing.username,
            email: existing.email,
            status: existing.status,
            createdAt: existing.created_at
          }
        };
      }
    }

    if (clientId) {
      const normClientId = clientId.trim().toUpperCase();
      let sql = 'SELECT id, client_id, username, email, status, role, created_at FROM users WHERE UPPER(TRIM(client_id)) = $1';
      const qParams: any[] = [normClientId];
      if (excludeUserId) {
        sql += ' AND id != $2';
        qParams.push(excludeUserId);
      }
      const existing = await queryOne<any>(sql, qParams);
      if (existing) {
        return {
          isDuplicate: true,
          field: 'clientId',
          message: `Client ID '${normClientId}' is already assigned to customer ${existing.username}.`,
          existingCustomer: {
            id: existing.id,
            clientId: existing.client_id,
            username: existing.username,
            email: existing.email,
            status: existing.status,
            createdAt: existing.created_at
          }
        };
      }
    }

    return { isDuplicate: false };
  }

  /**
   * Atomic, Idempotent, and Race-Condition Safe Client Creation
   */
  public static async createClient(input: CreateClientInput): Promise<ClientCreationResult> {
    const normEmail = this.normalizeEmail(input.email);
    let normUsername = this.normalizeUsername(input.username || '');

    if (!normEmail || !this.isValidEmail(normEmail)) {
      return {
        success: false,
        error: { code: 'INVALID_EMAIL', field: 'email', message: 'Please provide a valid email address.' }
      };
    }

    // Auto-assign unique username if omitted or empty
    if (!normUsername) {
      normUsername = await this.generateUniqueUsername(normEmail);
    } else if (normUsername.length < 2) {
      return {
        success: false,
        error: { code: 'INVALID_USERNAME', field: 'username', message: 'Username must be at least 2 characters long.' }
      };
    }

    // Pre-transaction duplicate check
    const dupCheck = await this.checkDuplicate({ email: normEmail, username: normUsername, clientId: input.clientId });
    if (dupCheck.isDuplicate) {
      return {
        success: false,
        error: {
          code: dupCheck.field === 'email' ? 'DUPLICATE_EMAIL' : (dupCheck.field === 'clientId' ? 'DUPLICATE_CLIENT_ID' : 'DUPLICATE_USERNAME'),
          field: dupCheck.field,
          message: dupCheck.message || 'Duplicate client detected',
          existingCustomer: dupCheck.existingCustomer
        }
      };
    }

    const userId = 'usr_' + generateUUID();
    const clientId = input.clientId ? input.clientId.trim().toUpperCase() : await this.generateUniqueClientId();
    const rawPassword = input.password || 'Trade@2026#' + Math.floor(1000 + Math.random() * 9000);
    const passwordHash = await argon2.hash(rawPassword, { type: argon2.argon2id });
    const role = input.role || 'USER';
    const initialCapital = typeof input.initialCapital === 'number' && input.initialCapital >= 0 ? input.initialCapital : 0.0;

    try {
      const createdUser = await withTransaction(async (client) => {
        // 1. Insert User Record with Database-Level Uniqueness
        const userRes = await client.query(
          `INSERT INTO users (
            id, client_id, username, email, password_hash, role, status,
            full_name, phone_number, city, address, date_of_birth, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, 'ACTIVE',
            $7, $8, $9, $10, $11, NOW(), NOW()
          ) RETURNING id, client_id, username, email, role, status, full_name, phone_number`,
          [
            userId,
            clientId,
            normUsername,
            normEmail,
            passwordHash,
            role,
            input.fullName || normUsername,
            input.phoneNumber || null,
            input.city || null,
            input.address || null,
            input.dateOfBirth || null
          ]
        );

        // 2. Initialize Virtual Wallet
        const walletId = 'wal_' + generateUUID();
        await client.query(
          `INSERT INTO virtual_wallets (id, user_id, cash_balance, used_margin, realized_pnl, unrealized_pnl, status)
           VALUES ($1, $2, $3, 0.0, 0.0, 0.0, 'ACTIVE')`,
          [walletId, userId, initialCapital]
        );

        // 3. Initialize Wallet Ledger
        const ledgerId = 'led_' + generateUUID();
        await client.query(
          `INSERT INTO wallet_ledger (id, transaction_id, user_id, transaction_type, amount, balance_before, balance_after, created_by, metadata)
           VALUES ($1, $2, $3, 'CREDIT', $4, 0.0, $5, $6, $7)`,
          [
            ledgerId,
            generateUUID(),
            userId,
            initialCapital,
            initialCapital,
            input.creatorId || 'REGISTRATION',
            JSON.stringify({ reason: 'Account Initialization Capital' })
          ]
        );

        // 4. Initialize Default Watchlist
        const wlId = 'wl_' + generateUUID();
        await client.query(
          `INSERT INTO watchlists (id, user_id, name, is_default)
           VALUES ($1, $2, 'Default Watchlist', TRUE)`,
          [wlId, userId]
        );

        await client.query(
          `INSERT INTO watchlist_items (id, watchlist_id, instrument_token, symbol, exchange, sort_order)
           VALUES ($1, $2, 'NSE_NIFTY50', 'NIFTY 50', 'NSE', 0)`,
          ['wli_' + generateUUID(), wlId]
        );

        return userRes.rows[0];
      });

      // Log Audit Action
      if (input.creatorId) {
        await logAuditAction(
          input.creatorId,
          input.creatorRole || 'SYSTEM',
          'CREATE_CUSTOMER',
          'USER',
          userId,
          null,
          { clientId, username: normUsername, email: normEmail, role, initialCapital },
          input.creatorIp || '127.0.0.1'
        ).catch(() => {});
      }

      return {
        success: true,
        user: {
          id: createdUser.id,
          clientId: createdUser.client_id,
          username: createdUser.username,
          email: createdUser.email,
          role: createdUser.role,
          status: createdUser.status,
          fullName: createdUser.full_name,
          phoneNumber: createdUser.phone_number
        }
      };
    } catch (err: any) {
      // PostgreSQL Unique Violation Code 23505
      if (err.code === '23505' || (err.message && err.message.includes('unique constraint'))) {
        const isEmailDup = err.message.includes('email') || err.message.includes('uq_users_normalized_email');
        const isClientDup = err.message.includes('client_id') || err.message.includes('uq_users_client_id');
        const isUsernameDup = err.message.includes('username') || err.message.includes('uq_users_normalized_username');

        return {
          success: false,
          error: {
            code: isEmailDup ? 'DUPLICATE_EMAIL' : (isClientDup ? 'DUPLICATE_CLIENT_ID' : 'DUPLICATE_USERNAME'),
            field: isEmailDup ? 'email' : (isClientDup ? 'clientId' : 'username'),
            message: isEmailDup
              ? `An account already exists with email '${normEmail}'.`
              : (isClientDup ? `Client ID '${clientId}' is already in use.` : `Username '${normUsername}' is already taken.`)
          }
        };
      }

      console.error('[ClientCreationService] Failed to create client:', err);
      return {
        success: false,
        error: { code: 'DATABASE_ERROR', message: err.message || 'Failed to create customer account.' }
      };
    }
  }
}
