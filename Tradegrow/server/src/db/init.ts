import { pool, query, queryOne, execute, withTransaction, runMigrations } from './schema';
import { generateUUID } from '../utils/crypto';
import argon2 from 'argon2';

export async function seedDatabase(): Promise<void> {
  // 1. Run all SQL migrations
  await runMigrations();

  // 2. Check if already seeded
  const result = await queryOne<{ count: string }>('SELECT COUNT(*) as count FROM users');
  const userCount = parseInt(result?.count ?? '0', 10);

  if (userCount > 0) {
    console.log('[DB] Database already initialized & seeded.');
    return;
  }

  console.log('[DB] Seeding default admin, demo users, instruments, and risk settings...');

  const adminId = 'usr_admin_' + generateUUID();
  const userId  = 'usr_client_' + generateUUID();

  // Hash passwords with Argon2id (P1-3 fix — replaces bcryptjs)
  const adminPasswordHash = await argon2.hash('Admin123!', { type: argon2.argon2id });
  const userPasswordHash  = await argon2.hash('Password123!', { type: argon2.argon2id });

  const defaultCapital = 0.0;

  await withTransaction(async (client) => {
    // 1. Seed users
    await client.query(
      `INSERT INTO users (id, username, email, password_hash, role, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [adminId, 'admin', 'admin@broker.sim', adminPasswordHash, 'SUPER_ADMIN', 'ACTIVE']
    );
    await client.query(
      `INSERT INTO users (id, username, email, password_hash, role, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, 'trader1', 'user@broker.sim', userPasswordHash, 'USER', 'ACTIVE']
    );

    // 2. Seed virtual wallets
    await client.query(
      `INSERT INTO virtual_wallets (id, user_id, cash_balance, used_margin, realized_pnl, unrealized_pnl)
       VALUES ($1, $2, $3, 0.0, 0.0, 0.0)`,
      ['wal_admin_' + generateUUID(), adminId, 10000000.0]
    );
    await client.query(
      `INSERT INTO virtual_wallets (id, user_id, cash_balance, used_margin, realized_pnl, unrealized_pnl)
       VALUES ($1, $2, $3, 0.0, 0.0, 0.0)`,
      ['wal_user_' + generateUUID(), userId, defaultCapital]
    );

    // 3. Seed initial ledger entries
    const txId = generateUUID();
    await client.query(
      `INSERT INTO wallet_ledger (id, transaction_id, user_id, transaction_type, amount, balance_before, balance_after, created_by, metadata)
       VALUES ($1, $2, $3, 'CREDIT', $4, 0.0, $5, 'SYSTEM_INIT', $6)`,
      [
        'led_' + generateUUID(), txId, userId,
        defaultCapital, defaultCapital,
        JSON.stringify({ reason: 'Initial Virtual Trading Capital Allocation' })
      ]
    );

    // 4. Seed instrument master (Top Indian Bluechips & Indices)
    const instruments = [
      { token: 'NSE_NIFTY50',     exchange: 'NSE', segment: 'EQ', symbol: 'NIFTY 50',     ts: 'NIFTY50',       name: 'Nifty 50 Index',            lot: 25, tick: 0.05, strike: 0, opt: 'XX', expiry: null, type: 'INDEX' },
      { token: 'NSE_BANKNIFTY',   exchange: 'NSE', segment: 'EQ', symbol: 'BANKNIFTY',     ts: 'BANKNIFTY',     name: 'Nifty Bank Index',           lot: 15, tick: 0.05, strike: 0, opt: 'XX', expiry: null, type: 'INDEX' },
      { token: 'BSE_SENSEX',      exchange: 'BSE', segment: 'EQ', symbol: 'SENSEX',         ts: 'SENSEX',        name: 'BSE Sensex Index',            lot: 10, tick: 0.05, strike: 0, opt: 'XX', expiry: null, type: 'INDEX' },
      { token: 'NSE_RELIANCE',    exchange: 'NSE', segment: 'EQ', symbol: 'RELIANCE',       ts: 'RELIANCE-EQ',   name: 'Reliance Industries Ltd',     lot: 1,  tick: 0.05, strike: 0, opt: 'XX', expiry: null, type: 'EQ' },
      { token: 'NSE_TCS',         exchange: 'NSE', segment: 'EQ', symbol: 'TCS',            ts: 'TCS-EQ',        name: 'Tata Consultancy Services',   lot: 1,  tick: 0.05, strike: 0, opt: 'XX', expiry: null, type: 'EQ' },
      { token: 'NSE_INFY',        exchange: 'NSE', segment: 'EQ', symbol: 'INFY',           ts: 'INFY-EQ',       name: 'Infosys Limited',             lot: 1,  tick: 0.05, strike: 0, opt: 'XX', expiry: null, type: 'EQ' },
      { token: 'NSE_HDFCBANK',    exchange: 'NSE', segment: 'EQ', symbol: 'HDFCBANK',       ts: 'HDFCBANK-EQ',   name: 'HDFC Bank Limited',           lot: 1,  tick: 0.05, strike: 0, opt: 'XX', expiry: null, type: 'EQ' },
      { token: 'NSE_ICICIBANK',   exchange: 'NSE', segment: 'EQ', symbol: 'ICICIBANK',      ts: 'ICICIBANK-EQ',  name: 'ICICI Bank Limited',          lot: 1,  tick: 0.05, strike: 0, opt: 'XX', expiry: null, type: 'EQ' },
      { token: 'NSE_TATAMOTORS',  exchange: 'NSE', segment: 'EQ', symbol: 'TATAMOTORS',     ts: 'TATAMOTORS-EQ', name: 'Tata Motors Limited',         lot: 1,  tick: 0.05, strike: 0, opt: 'XX', expiry: null, type: 'EQ' },
      { token: 'NFO_NIFTY_24500_CE', exchange: 'NFO', segment: 'FO', symbol: 'NIFTY24500CE', ts: 'NIFTY 24500 CALL', name: 'NIFTY 24500 CALL OPTION', lot: 25, tick: 0.05, strike: 24500, opt: 'CE', expiry: '2026-08-28', type: 'OPTIDX' },
      { token: 'NFO_NIFTY_24500_PE', exchange: 'NFO', segment: 'FO', symbol: 'NIFTY24500PE', ts: 'NIFTY 24500 PUT',  name: 'NIFTY 24500 PUT OPTION',  lot: 25, tick: 0.05, strike: 24500, opt: 'PE', expiry: '2026-08-28', type: 'OPTIDX' }
    ];

    for (const inst of instruments) {
      await client.query(
        `INSERT INTO instruments (id, instrument_token, exchange, segment, symbol, trading_symbol, name, lot_size, tick_size, strike, option_type, expiry, instrument_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (instrument_token) DO NOTHING`,
        [
          'inst_' + generateUUID(), inst.token, inst.exchange, inst.segment,
          inst.symbol, inst.ts, inst.name, inst.lot, inst.tick,
          inst.strike, inst.opt, inst.expiry, inst.type
        ]
      );
    }

    // 5. Seed default watchlist for demo user
    const wlId = 'wl_' + generateUUID();
    await client.query(
      `INSERT INTO watchlists (id, user_id, name, is_default) VALUES ($1, $2, $3, TRUE)`,
      [wlId, userId, 'Nifty Favorites']
    );

    const wlItems = [
      ['NSE_NIFTY50', 'NIFTY 50', 'NSE'],
      ['NSE_BANKNIFTY', 'BANKNIFTY', 'NSE'],
      ['NSE_RELIANCE', 'RELIANCE', 'NSE'],
      ['NSE_TCS', 'TCS', 'NSE'],
      ['NSE_HDFCBANK', 'HDFCBANK', 'NSE']
    ];

    for (let i = 0; i < wlItems.length; i++) {
      const [token, symbol, exch] = wlItems[i];
      await client.query(
        `INSERT INTO watchlist_items (id, watchlist_id, instrument_token, symbol, exchange, sort_order) VALUES ($1, $2, $3, $4, $5, $6)`,
        ['wli_' + generateUUID(), wlId, token, symbol, exch, i]
      );
    }
  });

  console.log('[DB] Seeding completed successfully.');
}

// Allow running directly: npx ts-node server/src/db/init.ts
if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[DB] Seed failed:', err);
      process.exit(1);
    });
}
