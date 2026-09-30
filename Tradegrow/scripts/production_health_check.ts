/**
 * Production Readiness & Health Verification Script
 * Validates database connections, safety locks, environment variables,
 * REST API health, and static asset distribution before deployment.
 */

import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import fs from 'fs';
import path from 'path';
import { pool } from '../server/src/db/pool';
import { SafetyLock } from '../server/src/services/SafetyLock';
import { redis } from '../server/src/db/redis';

async function runHealthCheck() {
  console.log('=======================================================');
  console.log('🔍 STOCKSHARP PRODUCTION READINESS & HEALTH VERIFIER');
  console.log('=======================================================\n');

  let passes = 0;
  let fails = 0;

  function report(step: string, success: boolean, detail: string) {
    if (success) {
      console.log(`✅ [PASS] ${step}: ${detail}`);
      passes++;
    } else {
      console.error(`❌ [FAIL] ${step}: ${detail}`);
      fails++;
    }
  }

  // 1. Safety Lock Check
  try {
    SafetyLock.assertSimulationOnly('ProductionHealthCheck');
    const isSafe = !SafetyLock.REAL_MONEY_TRADING_ALLOWED && process.env.REAL_MONEY_TRADING !== 'true';
    report('Safety Lock', isSafe, `REAL_MONEY_TRADING=${process.env.REAL_MONEY_TRADING ?? 'false'} (Virtual Trading Mode Active)`);
  } catch (err: any) {
    report('Safety Lock', false, err.message);
  }

  // 2. Secret Strength Check
  const jwtSecret = process.env.JWT_SECRET || '';
  const isJwtSecretValid = jwtSecret.length >= 32 && !jwtSecret.includes('change_me');
  report('JWT Secret Strength', isJwtSecretValid, isJwtSecretValid ? `Key length ${jwtSecret.length} chars` : 'JWT_SECRET is weak or default');

  // 3. PostgreSQL Connectivity
  try {
    const dbRes = await pool.query('SELECT current_database(), version(), count(*) FROM users');
    const dbName = dbRes.rows[0]?.current_database;
    const userCount = dbRes.rows[0]?.count;
    report('Database Connection', true, `Connected to database "${dbName}" (${userCount} registered users)`);
  } catch (err: any) {
    report('Database Connection', false, err.message);
  }

  // 4. Redis Caching / Fallback Check
  try {
    const redisAvailable = redis.isAvailable();
    report('Redis Status', true, redisAvailable ? 'Redis 7 server connected & active' : 'Degraded in-memory fallback active (Graceful)');
  } catch (err: any) {
    report('Redis Status', false, err.message);
  }

  // 5. REST API Health Endpoint
  const port = process.env.PORT || 5000;
  await new Promise<void>((resolve) => {
    http.get(`http://localhost:${port}/api/v1/health/live`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        report('REST API Live Endpoint', res.statusCode === 200, `HTTP ${res.statusCode} — Response: "${data.trim()}"`);
        resolve();
      });
    }).on('error', (err) => {
      report('REST API Live Endpoint', false, err.message);
      resolve();
    });
  });

  // 6. Client Static Build Assets Check
  const distPath = path.resolve(__dirname, '../client/dist/index.html');
  const distExists = fs.existsSync(distPath);
  report('Client Production Assets', distExists, distExists ? `Found static index.html at ${distPath}` : 'Client build dist directory missing');

  console.log('\n=======================================================');
  console.log(`📊 VERIFICATION SUMMARY: ${passes} PASSED, ${fails} FAILED`);
  console.log('=======================================================');

  process.exit(fails === 0 ? 0 : 1);
}

runHealthCheck().catch(err => {
  console.error('[FATAL] Health check runner failed:', err);
  process.exit(1);
});
