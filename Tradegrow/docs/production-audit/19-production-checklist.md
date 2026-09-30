# 19 — Production Checklist

## PRE-DEPLOYMENT CHECKLIST

### P0 — BLOCKERS (Must complete before deploying to internet)

- [ ] **P0-1** Rotate ANGELONE_TOTP_SECRET (TOTP seed exposed in plaintext)
- [ ] **P0-2** Rotate DHAN_ACCESS_TOKEN and DHAN_API_SECRET
- [ ] **P0-3** Rotate TRUEDATA_PASSWORD
- [ ] **P0-4** Generate strong JWT_SECRET: `openssl rand -hex 64`
- [ ] **P0-5** Generate strong JWT_REFRESH_SECRET: `openssl rand -hex 64`
- [ ] **P0-6** Set strong PG_PASSWORD (not 'postgres')
- [ ] **P0-7** Verify REAL_MONEY_TRADING=false in all deployment configs
- [ ] **P0-8** Configure NGINX reverse proxy with HTTPS (Let's Encrypt)
- [ ] **P0-9** Set ALLOWED_ORIGINS to production domain only
- [ ] **P0-10** Verify .env is in .gitignore (never commit credentials)

### P1 — HIGH PRIORITY (Before accepting real users)

- [ ] **P1-1** Verify TimescaleDB extension on production PostgreSQL
  ```sql
  CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
  ```
- [ ] **P1-2** Run all migrations on production DB
  ```bash
  npm run start  # migrations auto-run on startup
  ```
- [ ] **P1-3** Move KYC document storage to S3/GCS (not local disk)
- [ ] **P1-4** Configure Redis persistence (AOF or RDB snapshots)
- [ ] **P1-5** Set up automated PostgreSQL backups (pg_dump cron)
- [ ] **P1-6** Remove dump.rdb from repository
  ```bash
  del dump.rdb
  echo "dump.rdb" >> .gitignore
  ```
- [ ] **P1-7** Fix kyc_records vs kyc_applications naming in adminApi.ts
- [ ] **P1-8** Test DHAN WebSocket connection in production environment
- [ ] **P1-9** Verify Dhan access token is not expired
- [ ] **P1-10** Remove unused packages
  ```bash
  npm uninstall bcryptjs @types/bcryptjs better-sqlite3 @types/better-sqlite3 @types/ioredis
  ```

### P2 — MEDIUM PRIORITY (First week)

- [ ] **P2-1** Fix duplicate `/market/candles` route (rename second handler)
- [ ] **P2-2** Consolidate duplicate order endpoints (/orders and /orders/place)
- [ ] **P2-3** Move Python files from server/src/marketData/ to python_engine/
- [ ] **P2-4** Configure log rotation for application logs
- [ ] **P2-5** Set up application monitoring (Prometheus, Grafana, or Datadog)
- [ ] **P2-6** Run npm audit and fix HIGH/CRITICAL vulnerabilities
- [ ] **P2-7** Configure Redis rate limiting store (express-rate-limit + ioredis)
- [ ] **P2-8** Review and tighten CSP headers (remove unsafe-eval in production)
- [ ] **P2-9** Extract getClientIp() to shared utility (api.ts + adminApi.ts duplicate)
- [ ] **P2-10** Test mobile layout on real devices

### P3 — LOW PRIORITY (First month)

- [ ] **P3-1** Add WebSocket rate limiting (max messages per connection per minute)
- [ ] **P3-2** Implement JWT token blacklisting via Redis for logout invalidation
- [ ] **P3-3** Add proper error tracking (Sentry)
- [ ] **P3-4** Set up CI/CD pipeline (GitHub Actions)
- [ ] **P3-5** Add integration tests for critical API paths
- [ ] **P3-6** Consider RS256 JWT algorithm for enhanced security
- [ ] **P3-7** Integrate Python greeks API from Node.js for IV calculations
- [ ] **P3-8** Add push notifications (Firebase/OneSignal)
- [ ] **P3-9** Document API with OpenAPI/Swagger
- [ ] **P3-10** Consider horizontal scaling + load balancer

---

## VERIFICATION TESTS

### Backend Health Verification
```bash
# After deployment, run these in order:
curl https://yourdomain.com/api/v1/health/live
# Expected: 200 OK

curl https://yourdomain.com/api/v1/health/ready
# Expected: {"ready": true}

curl https://yourdomain.com/api/v1/health
# Expected: {"status": "UP", "database": {"healthy": true}}

curl https://yourdomain.com/api/v1/health/instruments
# Expected: {"isReady": true, "totalInstruments": ...}
```

### Market Data Verification
```bash
# Check market data provider
curl https://yourdomain.com/api/v1/health
# Look for: "marketDataProvider": "DHAN" (or configured provider)

# Check live tick (requires browser WebSocket test or wscat)
wscat -c wss://yourdomain.com/ws
# Send: {"action": "SUBSCRIBE", "tokens": ["NSE_NIFTY50"]}
# Expect: Market tick within 500ms
```

### Authentication Verification
```bash
# Test login
curl -X POST https://yourdomain.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@broker.sim", "password": "Admin123!"}'
# Expected: {"success": true, "token": "..."}
```

### Option Chain Verification
```bash
# Test option expiries
curl https://yourdomain.com/api/v1/market/option-expiries?symbol=NIFTY
# Expected: {success: true, nearestExpiry: "...", expiries: [...]}

# Test option chain
curl "https://yourdomain.com/api/v1/market/option-chain?symbol=NIFTY&strikeRange=5"
# Expected: {success: true, chain: [...], atmStrike: ...}
```

---

## ROLLBACK PLAN

If deployment fails:
1. Stop new containers: `docker compose down`
2. Restore database from backup: `pg_restore -d stocksharp backup.dump`
3. Re-start previous containers from last known good image
4. Verify /health endpoints return 200

---

## MONITORING ALERTS TO CONFIGURE

| Alert | Threshold | Action |
|-------|-----------|--------|
| DB connection pool exhausted | pool_wait > 5s | Scale PG pool, investigate queries |
| Market data feed dead | No tick for 60s (market hours) | Check provider credentials, failover |
| High memory usage | RSS > 1.5GB | Investigate leak, restart |
| High CPU | CPU > 80% for 5min | Investigate heavy queries |
| Redis connection lost | isConnected=false | In-memory fallback active, check Redis |
| Error rate spike | 5xx > 5% of requests | Check logs immediately |
| WS connection count high | > 1000 concurrent | Scale or investigate |
