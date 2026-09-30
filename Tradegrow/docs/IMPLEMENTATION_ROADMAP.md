# IMPLEMENTATION ROADMAP
## StockSharp — Production-Grade Multi-User Virtual Trading Platform
**Version:** 1.0  
**Created:** 2026-08-03  
**Target:** 100 Concurrent Users, 300 WebSocket Connections, PostgreSQL, Redis, Docker, Nginx

---

## OVERVIEW

This roadmap transforms the current alpha codebase into a production-ready multi-user virtual brokerage platform.
It is organized into 8 phases with clearly defined deliverables and verification criteria.

Implementation principle: Incremental, verified, non-destructive. Existing working business logic is preserved.
Each phase must pass tests before the next phase begins.

---

## PHASE 1 — P0 SECURITY HARDENING
**Duration:** 1-2 days  
**Objective:** Eliminate all critical security vulnerabilities before any other work.

### Tasks

#### 1.1 Remove All Hardcoded Secrets
- Remove fallback JWT secrets from auth.ts, api.ts, websocket/server.ts
- Add startup assertion: if JWT_SECRET is not set, throw error and exit
- Add startup assertion: if NODE_ENV=production and no ARGON2_PEPPER set, exit

#### 1.2 Add Input Validation (Zod)
- Install zod package
- Create server/src/middleware/validate.ts
- Add Zod schemas for: auth/register, auth/login, orders/submit, watchlist/add, admin/adjust-balance
- Apply validateBody middleware to all POST endpoints

#### 1.3 Add Rate Limiting
- Install express-rate-limit
- Add authLimiter (10 req/15min) to login and register
- Add apiLimiter (300 req/15min) to all authenticated routes
- Add orderLimiter (30 req/min) to order submission

#### 1.4 Fix CORS Configuration
- Replace app.use(cors()) with explicit origin list from ALLOWED_ORIGINS env var

#### 1.5 Add Helmet.js Security Headers
- Install helmet
- Apply app.use(helmet()) with CSP configuration

#### 1.6 Fix IDOR on Watchlist
- Add ownership check on DELETE /watchlists/items/:id

#### 1.7 Fix Math.max() Bug in VirtualWalletLedger
- Replace JavaScript Math.max() with application-level clamping before SQL query

#### 1.8 Fix ID Generation
- Replace all Date.now() ID patterns with crypto.randomUUID()

### Files Modified
- server/src/index.ts
- server/src/middleware/auth.ts
- server/src/middleware/validate.ts (NEW)
- server/src/routes/api.ts
- server/src/trading/VirtualWalletLedger.ts
- server/src/trading/ExecutionEngine.ts
- server/src/trading/OMS.ts
- server/src/db/init.ts
- package.json (add zod, express-rate-limit, helmet)

### Verification
- Run: npx jest — all 18 tests must pass
- Manual: Verify login rate limiting activates after 10 attempts
- Manual: Verify invalid order body returns 400 with validation error

---

## PHASE 2 — POSTGRESQL MIGRATION
**Duration:** 2-3 days  
**Objective:** Replace SQLite with PostgreSQL. Maintain full feature parity.

### Tasks

#### 2.1 Install PostgreSQL Dependencies
- Install: pg, pg-pool, @types/pg
- Install: node-pg-migrate (migration system)

#### 2.2 Create Migration Files
- migrations/001_initial_schema.sql — Users, Wallets, Ledger, Orders, Executions, Positions, Holdings
- migrations/002_instruments.sql — Instruments, InstrumentMasterVersions, InstrumentChangeLog
- migrations/003_watchlists.sql — Watchlists, WatchlistItems, Alerts
- migrations/004_audit.sql — AuditLogs, SystemSettings
- migrations/005_order_events.sql — OrderEvents table (NEW)
- migrations/006_sessions.sql — Sessions, RefreshTokens tables
- migrations/007_notifications.sql — Notifications table
- migrations/008_portfolio_snapshots.sql — PortfolioSnapshots table

#### 2.3 Create PostgreSQL Connection Pool
- server/src/db/pool.ts — pg.Pool with configurable max connections
- Environment-driven: DATABASE_URL or individual PG_HOST, PG_PORT, PG_DB, PG_USER, PG_PASS

#### 2.4 Update All DB Access
- Replace all SQLite db.prepare().get/run/all() calls with pg pool.query() async calls
- Update schema.ts to remove SQLite imports
- Update all trading/, routes/, marketData/ files to use async/await PostgreSQL

#### 2.5 Add Row-Level Locking
- VirtualWalletLedger.blockMargin(): add SELECT ... FOR UPDATE SKIP LOCKED
- OMS.submitOrder(): wrap in explicit transaction with wallet row lock

#### 2.6 Add Database Index Review
- Ensure indexes on: orders.user_id, orders.status, executions.order_id, positions.user_id, holdings.user_id, wallet_ledger.user_id, audit_logs.actor_id

#### 2.7 Seed Data Migration
- Convert seedDatabase() to use pg pool async queries

### Files Modified/Created
- server/src/db/pool.ts (NEW)
- server/src/db/migrations/ (NEW directory with 8 files)
- server/src/db/schema.ts (rewritten for PostgreSQL)
- server/src/db/init.ts (rewritten for PostgreSQL)
- server/src/trading/OMS.ts (async)
- server/src/trading/RMS.ts (async)
- server/src/trading/ExecutionEngine.ts (async)
- server/src/trading/VirtualWalletLedger.ts (async + row lock)
- server/src/trading/PortfolioService.ts (async)
- server/src/routes/api.ts (async)

### Verification
- Run migrations: npm run migrate
- Run: npx jest — all tests must pass against PostgreSQL
- Test concurrent order submission: 2 simultaneous orders from same user
- Verify wallet balance is never negative after race

---

## PHASE 3 — REDIS INTEGRATION
**Duration:** 1-2 days  
**Objective:** Add Redis for market data cache, pub/sub, rate limiting, session state.

### Tasks

#### 3.1 Install Redis Client
- Install: ioredis, @types/ioredis

#### 3.2 Create Redis Client
- server/src/db/redis.ts — ioredis client with reconnection, error handling

#### 3.3 Market Data Tick Cache (Redis)
- Replace Map<string, MarketTick> in MarketDataEngine with Redis GET/SET
- Market tick key format: market:tick:{instrumentToken}
- TTL: 60 seconds (stale detection)
- When tick arrives from broker: SET in Redis + PUBLISH to channel market:ticks

#### 3.4 Redis Pub/Sub for WebSocket Fan-out
- WebSocket server subscribes to Redis channel market:ticks
- On received message: broadcast to all subscribed WebSocket clients for that token
- This replaces the in-process onTick() callback model
- Enables future process separation (WebSocket in separate container)

#### 3.5 Rate Limiting via Redis
- Replace express-rate-limit memory store with Redis store (rate-limit-redis)
- Enables distributed rate limiting across multiple backend instances

#### 3.6 Market Data Stale Detection
- Add staleness check: if tick.timestamp < now - 30s, mark as stale
- Add isStale field to MarketTick type
- API and WebSocket to include isStale in responses

#### 3.7 Subscription Deduplication Registry
- Redis SET: subscriptions:{instrumentToken} → count of active subscribers
- MarketDataEngine subscribes to broker only once per unique token
- Unsubscribes when subscriber count drops to 0

### Files Created/Modified
- server/src/db/redis.ts (NEW)
- server/src/marketData/MarketDataEngine.ts (Redis cache + pub/sub)
- server/src/marketData/types.ts (add isStale field)
- server/src/websocket/server.ts (Redis subscriber)
- docker-compose.yml (add Redis service)

### Verification
- Restart server — cached ticks survive restart (Redis persists)
- Verify WebSocket receives ticks via Redis pub/sub
- Verify stale detection activates after 30s with no new tick

---

## PHASE 4 — AUTHENTICATION UPGRADE
**Duration:** 2 days  
**Objective:** Refresh tokens, TOTP/2FA, secure session management.

### Tasks

#### 4.1 Refresh Token System
- Add refresh_tokens table in migration 006_sessions.sql
- POST /auth/login now returns:
  - Short-lived access token (15min, in JSON response body)
  - Long-lived refresh token (7 days, in httpOnly Secure cookie)
- POST /auth/refresh: validates refresh token cookie, issues new access token
- POST /auth/logout: invalidates refresh token in DB + clears cookie

#### 4.2 TOTP / 2FA
- Install: otpauth or speakeasy, qrcode
- POST /auth/totp/setup: generates TOTP secret, returns QR code
- POST /auth/totp/verify: verifies TOTP code, enables 2FA on account
- POST /auth/totp/disable: disables 2FA (requires current TOTP code)
- POST /auth/login: if is_totp_enabled=true, require totp_code field in second step

#### 4.3 Password Upgrade: Argon2id
- Install: argon2
- Replace bcryptjs.hash with argon2.hash (Argon2id variant)
- Replace bcryptjs.compare with argon2.verify
- Add migration to re-hash passwords on first login (backward compatible)

#### 4.4 Account Lockout
- Add failed_login_attempts and locked_until columns to users table
- After 5 failed logins: lock account for 15 minutes
- Reset counter on successful login

#### 4.5 Frontend Session Handling
- Update client/src/App.tsx to use httpOnly cookie refresh token flow
- Add token refresh interceptor (auto-refresh access token before expiry)

### Files Modified/Created
- server/src/routes/auth.routes.ts (NEW — split from api.ts)
- server/src/db/migrations/006_sessions.sql
- server/src/middleware/auth.ts (updated for short-lived tokens)
- client/src/App.tsx (refresh token interceptor)
- package.json (add argon2, otpauth, qrcode)

### Verification
- Login, wait 15 min, verify access token expired, auto-refresh succeeds
- Setup TOTP, verify login requires code
- 5 bad logins → account locked → try again after 15min

---

## PHASE 5 — INFRASTRUCTURE & DOCKER
**Duration:** 2 days  
**Objective:** Production-grade Docker Compose with all services isolated.

### Tasks

#### 5.1 Nginx Configuration
- nginx/nginx.conf with:
  - Upstream: backend on port 5000
  - HTTPS listener (port 443) with SSL cert path
  - HTTP to HTTPS redirect (port 80)
  - Gzip compression
  - Security headers (HSTS, X-Frame-Options, etc.)
  - Static file serving for /client/dist
  - API proxy to backend
  - WebSocket upgrade proxy to backend /ws

#### 5.2 Production Docker Compose
- docker-compose.production.yml services:
  - nginx (port 80, 443 exposed)
  - api (internal only, port 5000)
  - postgres (internal only, port 5432)
  - redis (internal only, port 6379)
  - monitoring (Prometheus + Grafana, internal or restricted)
- Internal Docker network: trading-net (bridge)
- Named volumes: pg_data, redis_data, nginx_certs

#### 5.3 Staging Docker Compose
- docker-compose.staging.yml:
  - Same structure as production
  - Different env vars (separate DB, Redis)
  - Exposes port 5001 for HTTP (no SSL in staging)

#### 5.4 Environment Configuration
- .env.example updated with all required variables
- .env.production.example (no actual secrets)
- Scripts: scripts/generate-secrets.sh (generates JWT_SECRET, etc.)

#### 5.5 Healthcheck Integration in Docker
- Add HEALTHCHECK to each Dockerfile service
- docker-compose service healthcheck using /api/v1/health/ready

#### 5.6 Dockerfile Improvements
- Multi-stage build optimization (cache node_modules layer)
- Non-root user for runner stage
- Copy only built artifacts (no dev dependencies in production image)

### Files Created/Modified
- nginx/nginx.conf (NEW)
- nginx/Dockerfile (NEW)
- docker-compose.yml (updated)
- docker-compose.production.yml (NEW)
- docker-compose.staging.yml (NEW)
- .env.example (updated)
- Dockerfile (improved)
- scripts/generate-secrets.sh (NEW)

### Verification
- docker-compose -f docker-compose.production.yml up → all services healthy
- curl http://localhost → redirects to HTTPS
- curl https://localhost/api/v1/health → {"status":"UP","db":"UP","redis":"UP"}
- WebSocket connects successfully through Nginx proxy

---

## PHASE 6 — API MODULARIZATION & STRUCTURED LOGGING
**Duration:** 1-2 days  
**Objective:** Split monolithic api.ts, add structured logging, deep health checks.

### Tasks

#### 6.1 Route Splitting
- server/src/routes/auth.routes.ts
- server/src/routes/market.routes.ts
- server/src/routes/orders.routes.ts
- server/src/routes/portfolio.routes.ts
- server/src/routes/watchlist.routes.ts
- server/src/routes/admin.routes.ts
- server/src/routes/health.routes.ts
- server/src/routes/index.ts (assembles all routers)

#### 6.2 Structured Logging
- Install: pino, pino-http
- server/src/utils/logger.ts — Pino logger instance
- Replace all console.log with logger.info/warn/error
- Add pino-http middleware for request logging with request_id

#### 6.3 Deep Health Checks
- GET /api/v1/health: checks DB, Redis, market data provider
- GET /api/v1/health/live: simple 200 OK (liveness)
- GET /api/v1/health/ready: comprehensive readiness check

#### 6.4 Server-Side Pagination
- Add ?page=&limit= support to all list endpoints
- Orders: paginate by created_at DESC
- Audit logs: paginate by timestamp DESC
- Admin users: paginate by created_at DESC

#### 6.5 Request ID Tracking
- Generate UUID per request
- Add X-Request-ID header to all responses
- Log request_id in all log statements for tracing

### Files Created/Modified
- server/src/routes/ (6 new route files + index.ts)
- server/src/utils/logger.ts (NEW)
- server/src/index.ts (add pino-http, request-id middleware)

---

## PHASE 7 — MONITORING & OBSERVABILITY
**Duration:** 2 days  
**Objective:** Prometheus metrics, Grafana dashboards, structured alerts.

### Tasks

#### 7.1 Prometheus Metrics
- Install: prom-client
- Expose GET /metrics endpoint (internal only — Nginx deny external access)
- Track:
  - http_request_duration_seconds (histogram by route, method, status)
  - active_websocket_connections (gauge)
  - orders_submitted_total (counter by status)
  - market_data_ticks_received_total (counter by provider)
  - database_query_duration_seconds (histogram)
  - redis_operations_total (counter)

#### 7.2 Grafana Dashboards
- docker-compose service: grafana
- Pre-provisioned datasource: Prometheus
- Dashboard: Platform Overview (active users, orders/sec, WebSocket connections)
- Dashboard: Database Performance (query latency, pool usage)
- Dashboard: Market Data (tick rate, stale data count, provider health)
- Dashboard: Business Metrics (total orders, fills, P&L, virtual capital)

#### 7.3 Uptime Kuma
- docker-compose service: uptime-kuma
- Monitors: / (frontend), /api/v1/health (backend), PostgreSQL, Redis

#### 7.4 Alert Rules
- Prometheus alert rules for:
  - CPU > 80% for 5 minutes
  - RAM > 85% for 5 minutes
  - DB connection pool > 90% used
  - Redis unavailable
  - Market data stale > 30 seconds
  - Error rate > 5% for 2 minutes
  - WebSocket connections > 280 (approaching limit)

### Files Created
- monitoring/prometheus.yml (NEW)
- monitoring/alerts.yml (NEW)
- monitoring/grafana/provisioning/ (dashboards)
- docker-compose.production.yml (add monitoring services)

---

## PHASE 8 — TESTING, LOAD TESTING & CI/CD
**Duration:** 2-3 days  
**Objective:** Comprehensive test coverage, load testing, automated CI/CD pipeline.

### Tasks

#### 8.1 Expand Unit Tests
- Target: 80%+ code coverage
- New test suites:
  - tests/auth.test.ts (registration, login, refresh, TOTP)
  - tests/wallet_ledger.test.ts (concurrent balance ops, race condition)
  - tests/rms.test.ts (all rejection scenarios)
  - tests/portfolio.test.ts (positions, holdings, P&L)
  - tests/websocket.test.ts (connection, subscription, auth)

#### 8.2 Integration Tests
- tests/integration/order_flow.test.ts — full order lifecycle
- tests/integration/admin.test.ts — admin operations
- tests/integration/market_data.test.ts — tick flow through Redis to WebSocket

#### 8.3 Load Testing (k6)
- load-tests/01_login_storm.js — 100 simultaneous logins
- load-tests/02_trading_terminal.js — 100 concurrent WebSocket + order submissions
- load-tests/03_market_data_stream.js — 300 WebSocket connections receiving ticks
- load-tests/04_order_race.js — concurrent orders same user (race condition test)
- Targets: REST p95 < 500ms, order submission p95 < 300ms, WS latency < 500ms

#### 8.4 Security Tests
- Verify JWT forgery rejected
- Verify IDOR prevented on all user data
- Verify rate limiting activates
- Verify admin endpoints reject non-admin tokens
- Verify no real-money order endpoints exist (grep security audit)

#### 8.5 GitHub Actions CI/CD
- .github/workflows/ci.yml:
  - Trigger: push to main, pull request to main
  - Steps: checkout, install, lint, type-check, unit tests, integration tests, security scan
  - On: push to main only → Docker build, push to registry
- .github/workflows/deploy-staging.yml:
  - Trigger: successful CI on main
  - Steps: deploy to staging VPS, run smoke tests
- .github/workflows/deploy-production.yml:
  - Trigger: manual approval only
  - Steps: deploy to production VPS with zero-downtime strategy

### Files Created
- tests/ (5 new test files)
- load-tests/ (4 k6 scripts)
- .github/workflows/ci.yml
- .github/workflows/deploy-staging.yml
- .github/workflows/deploy-production.yml

---

## PHASE 9 — DOCUMENTATION & PRODUCTION RUNBOOK
**Duration:** 1 day

### Documents to Create
- docs/ARCHITECTURE.md
- docs/DATABASE_SCHEMA.md
- docs/REDIS_ARCHITECTURE.md
- docs/MARKET_DATA_ARCHITECTURE.md
- docs/ANGELONE_INTEGRATION.md
- docs/WEBSOCKET_ARCHITECTURE.md
- docs/VIRTUAL_TRADING_ENGINE.md
- docs/OMS.md
- docs/RMS.md
- docs/RBAC.md
- docs/SECURITY.md
- docs/BACKUP_AND_DISASTER_RECOVERY.md
- docs/MONITORING.md
- docs/CI_CD.md
- docs/PRODUCTION_DEPLOYMENT.md
- docs/PRODUCTION_RUNBOOK.md
- docs/DISASTER_RECOVERY.md
- docs/LOAD_TESTING.md
- docs/TROUBLESHOOTING.md

---

## PHASE SUMMARY TABLE

| Phase | Focus | Duration | P-Level | Status |
|---|---|---|---|---|
| 1 | Security Hardening | 1-2 days | P0 | Pending |
| 2 | PostgreSQL Migration | 2-3 days | P0 | Pending |
| 3 | Redis Integration | 1-2 days | P0 | Pending |
| 4 | Auth Upgrade (Refresh + 2FA) | 2 days | P1 | Pending |
| 5 | Infrastructure & Docker | 2 days | P1 | Pending |
| 6 | API Modularization + Logging | 1-2 days | P1 | Pending |
| 7 | Monitoring & Observability | 2 days | P2 | Pending |
| 8 | Testing + CI/CD | 2-3 days | P2 | Pending |
| 9 | Documentation | 1 day | P2 | Pending |
| **Total** | | **14-20 days** | | |

---

## NON-NEGOTIABLE CONSTRAINTS

1. REAL_MONEY_TRADING_ENABLED = false — SafetyLock must remain. Never remove.
2. Angel One integration is MARKET DATA ONLY. No order placement SDK calls.
3. Every wallet change must have a corresponding immutable ledger entry.
4. No user can access another user's data — verified at server level, not frontend.
5. No secrets committed to Git.
6. No SQLite in production.
7. All P0 issues fixed before any deployment to internet-facing server.

---

## PRODUCTION READINESS CHECKLIST

### Infrastructure
- [ ] Docker Compose with PostgreSQL, Redis, Nginx, Monitoring
- [ ] HTTPS with SSL certificate
- [ ] Cloudflare DNS + WAF
- [ ] Firewall: only 80 and 443 exposed
- [ ] Backups: daily pg_dump + offsite storage

### Database
- [ ] PostgreSQL running with connection pool
- [ ] Migrations versioned and applied
- [ ] Row-level locking on wallet operations
- [ ] Indexes verified with EXPLAIN ANALYZE

### Security
- [ ] No hardcoded secrets in code
- [ ] JWT_SECRET >= 64 random bytes
- [ ] Rate limiting active on auth endpoints
- [ ] TOTP/2FA available
- [ ] Helmet.js security headers
- [ ] CORS restricted to app domain
- [ ] Input validation on all endpoints
- [ ] IDOR tests passed

### Market Data
- [ ] Angel One or Alpha Vantage streaming ticks
- [ ] Redis pub/sub fan-out to WebSocket clients
- [ ] Stale data detection active
- [ ] Fallback provider configured

### Real-Time
- [ ] WebSocket through Nginx proxy
- [ ] Heartbeat and reconnection active
- [ ] Subscription deduplication via Redis
- [ ] 300 connection load test passed

### Trading
- [ ] Virtual orders execute with correct accounting
- [ ] Race condition test passed (concurrent orders)
- [ ] Wallet vs Ledger reconciliation passes
- [ ] RMS rejects oversized orders

### Monitoring
- [ ] Prometheus scraping metrics
- [ ] Grafana dashboards showing KPIs
- [ ] Alert rules configured
- [ ] Uptime Kuma monitoring endpoints

### Testing
- [ ] All unit tests pass
- [ ] Integration tests pass
- [ ] k6 load test: 100 users, p95 < 500ms
- [ ] Security scan: no critical findings

### Safety Verification (Final Gate)
- [ ] grep -r "placeOrder\|realMoney" server/src → 0 results
- [ ] SafetyLock.REAL_MONEY_TRADING_ALLOWED === false
- [ ] No real broker order endpoint exists in routes
- [ ] Admin panel cannot enable real trading

