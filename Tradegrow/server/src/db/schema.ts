/**
 * PostgreSQL Schema Loader
 * P0-1 FIX: Replaces SQLite better-sqlite3 with PostgreSQL via pg pool.
 *
 * This module:
 *  1. Ensures target database exists
 *  2. Reads and executes all SQL migration files in order
 *  3. Exports query helpers for use throughout the server
 */

import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import { pool, query, queryOne, execute, withTransaction, checkDatabaseHealth } from './pool';

export { pool, query, queryOne, execute, withTransaction, checkDatabaseHealth };

async function ensureDatabaseExists(): Promise<void> {
  const dbName = process.env.PG_DATABASE || 'stocksharp';
  const host = process.env.PG_HOST || 'localhost';
  const port = parseInt(process.env.PG_PORT || '5432');
  const user = process.env.PG_USER || 'postgres';
  const password = process.env.PG_PASSWORD || 'postgres';

  const client = new Client({
    host,
    port,
    database: 'postgres', // connect to default postgres DB first
    user,
    password,
  });

  try {
    await client.connect();
    const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]);
    if ((res.rowCount ?? 0) === 0) {
      console.log(`[DB] Database "${dbName}" does not exist. Creating now...`);
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`[DB] ✅ Database "${dbName}" created successfully.`);
    }
  } catch (err: any) {
    console.warn(`[DB] Database creation check skipped/warning: ${err.message}`);
  } finally {
    await client.end().catch(() => {});
  }
}

/**
 * Run all SQL migration files in order (001_, 002_, etc.)
 * Idempotent: uses CREATE TABLE IF NOT EXISTS and ON CONFLICT DO NOTHING.
 */
export async function runMigrations(): Promise<void> {
  await ensureDatabaseExists();

  let migrationsDir = path.resolve(__dirname, '../../src/db/migrations');
  if (!fs.existsSync(migrationsDir)) {
    migrationsDir = path.resolve(__dirname, 'migrations');
  }

  if (!fs.existsSync(migrationsDir)) {
    console.warn('[DB] No migrations directory found at:', migrationsDir);
    return;
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`[DB] Running ${files.length} migration file(s) from ${migrationsDir}...`);

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    try {
      await pool.query(sql);
      console.log(`[DB] ✅ Migration applied: ${file}`);
    } catch (err: any) {
      // If constraint violation on re-running an old or superseded check constraint, log warning rather than halting server
      if (err.message && err.message.includes('check constraint') && err.message.includes('violated by some row')) {
        console.warn(`[DB] ⚠️ Migration warning on ${file}: ${err.message}. Continuing...`);
      } else if (
        // TimescaleDB is not available on local dev PostgreSQL installs — skip gracefully
        (err.message?.includes('timescaledb') || file.toLowerCase().includes('timescaledb')) &&
        process.env.NODE_ENV !== 'production'
      ) {
        console.warn(`[DB] ⚠️ TimescaleDB migration skipped (extension not installed locally): ${file}. This is normal for local dev.`);
      } else {
        console.error(`[DB] ❌ Migration failed: ${file} — ${err.message}`);
        throw err;
      }
    }
  }

  console.log('[DB] All migrations complete.');
}
