# PRODUCTION ARCHITECTURE GAP ANALYSIS
## StockSharp — Multi-User Indian Stock Market Virtual Trading Platform
**Audit Date:** 2026-08-03  
**Auditor:** Principal Software Architect  
**Status:** ⚠️ ALPHA — Not Production Ready

---

## 1. CURRENT ARCHITECTURE SUMMARY

### Technology Stack
| Layer | Technology | Version | Status |
|-------|-----------|---------|--------|
| Backend Runtime | Node.js | 22 | ✅ Current |
| Backend Framework | Express.js | 4.21 | ✅ Stable |
| Backend Language | TypeScript | 5.7 | ✅ Current |
| Database | SQLite (better-sqlite3) | 11.8 | ❌ Must Replace |
| Cache/PubSub | **None** | — | ❌ Missing |
| Authentication | JWT (jsonwebtoken 9) | 9.0 | ⚠️ Incomplete |
| Password Hashing | bcryptjs | 2.4 | ⚠️ Should Use Argon2 |
| WebSocket | ws | 8.18 | ⚠️ Needs Scaling |
| Frontend Framework | React + Vite + TypeScript | — | ✅ Good |
| Frontend Styling | Tailwind CSS | — | ✅ Good |
| Charts | TradingView Lightweight Charts v5 | — | ✅ Good |
| Containerization | Docker (single container) | — | ⚠️ Single Container |
| Reverse Proxy | **None** | — | ❌ Missing |
| Process Manager | **None** | — | ❌ Missing |
| Monitoring | **None** | — | ❌ Missing |
| CI/CD | **None** | — | ❌ Missing |
| Test Coverage | Jest (4 suites, 18 tests) | 29 | ⚠️ Insufficient |

### Existing Components (What Works)
- ✅ User registration & login (JWT-based)
- ✅ Virtual wallet with ledger
- ✅ Order Management System (OMS) — MARKET, LIMIT, SL, SL_M
- ✅ Risk Management System (RMS)
- ✅ Simulated Execution Engine (500ms matching loop)
- ✅ Portfolio tracking (Positions, Holdings)
- ✅ TradingView Lightweight Charts (v5)
- ✅ Option Chain with Black-Scholes Greeks
- ✅ Market Scanner
- ✅ Admin Panel (basic)
- ✅ Audit Logs (basic)
- ✅ Multi-provider market data (IMarketDataProvider)
- ✅ Angel One SmartAPI integration (Python subprocess)
- ✅ Alpha Vantage adapter (primary)
- ✅ Safety Lock (REAL_MONEY_TRADING=false) — hardcoded
- ✅ WebSocket gateway with subscriptions
- ✅ Role-based access control (basic)

---

## 2. CRITICAL FINDINGS BY PRIORITY

---

### P0 — CRITICAL (Must Fix Before Production)

#### P0-1: SQLite Cannot Support Multi-User Concurrent Load
**Location:** server/src/db/schema.ts  
**Issue:** SQLite has a single-writer model. With 100 concurrent users submitting orders, executing queries, and streaming market data simultaneously, SQLite will produce SQLITE_BUSY errors and cause data loss or corruption.  
**Risk:** Data integrity failure, application crash, race conditions on virtual wallet balances.  
**Fix:** Migrate to PostgreSQL with a connection pool (pg + pgPool).

#### P0-2: No Redis — No Scalable Pub/Sub or Market Data Cache
**Issue:** Market tick cache is an in-memory Map inside MarketDataEngine. If the process restarts, all cached prices are lost. WebSocket broadcasts iterate ALL connections per tick. No shared state between potential worker processes.  
**Risk:** Under 100 concurrent users, every tick event iterates all WebSocket connections. For 300 WS connections x ticks at 1-5/sec, CPU spikes will occur.  
**Fix:** Add Redis for: market tick cache (pub/sub), WebSocket subscription state, rate limiting, session caching.

#### P0-3: JWT Secret is Weak & Hardcoded as Fallback
**Location:** server/src/routes/api.ts:16, server/src/middleware/auth.ts:15, server/src/websocket/server.ts:6  
**Issue:** The fallback JWT secret 'super_secret_jwt_key_paper_trading_platform_2026' is committed in code across 3 separate files. If JWT_SECRET env var is unset, this insecure key is used silently.  
**Risk:** Token forgery — any user can forge a JWT and impersonate any role including SUPER_ADMIN.  
**Fix:** Fail hard (crash server) if JWT_SECRET env var is not set. Remove all hardcoded fallback secrets.

#### P0-4: No Input Validation or Sanitization
**Location:** All route handlers in server/src/routes/api.ts  
**Issue:** User input (username, email, password, quantity, price, symbol) passes directly to SQL queries and business logic with no schema validation library.  
**Risk:** Malformed data causing crashes (e.g., parseInt(undefined) = NaN passed to wallet debit).  
**Fix:** Add Zod validation middleware on all endpoints.

#### P0-5: No Rate Limiting on Authentication Endpoints
**Location:** POST /api/v1/auth/login, POST /api/v1/auth/register  
**Issue:** Zero brute-force protection. Unlimited password guesses allowed.  
**Risk:** Account takeover via credential stuffing/brute force.  
**Fix:** Add express-rate-limit with Redis backend. Lock accounts after N failed attempts.

#### P0-6: No HTTPS / TLS
**Issue:** Server runs HTTP only on port 5000. No Nginx/Caddy reverse proxy.  
**Risk:** All JWT tokens, credentials, and market data transmitted in plaintext.  
**Fix:** Add Nginx container with SSL termination + Cloudflare.

#### P0-7: Docker Compose is Single-Container Without PostgreSQL/Redis
**Location:** docker-compose.yml  
**Issue:** 1 service only. No Nginx, no PostgreSQL, no Redis, no monitoring. JWT secret hardcoded in compose file.  
**Fix:** Full multi-service compose with separate volumes, secrets, network isolation.

#### P0-8: Race Condition on Virtual Wallet Balance
**Location:** VirtualWalletLedger.ts — blockMargin() function  
**Issue:** Two simultaneous order submissions READ wallet then UPDATE wallet without row-level locking. With PostgreSQL migration this becomes a real race condition.  
**Fix:** Use SELECT ... FOR UPDATE row-level locking in PostgreSQL transactions.

#### P0-9: Execution IDs Use Date.now() — Collision Risk
**Location:** ExecutionEngine.ts:72  
**Issue:** 'exc_' + Date.now() + '_' + Math.floor(Math.random() * 1000) — collision possible at same millisecond.  
**Fix:** Use crypto.randomUUID() for all ID generation.

#### P0-10: Angel One Credentials in Plain .env
**Location:** .env  
**Issue:** Real API keys (SMARTAPI_API_KEY, TOTP secrets) are in .env. If accidentally committed to Git, credentials are exposed.  
**Fix:** Verify .env is in .gitignore. Use secrets manager for production.

---

### P1 — HIGH (Fix Before Beta Launch)

#### P1-1: No Refresh Token Rotation
**Issue:** JWTs expire after 24h with no refresh token endpoint. Users get logged out every 24h with no graceful renewal.  
**Fix:** Implement POST /auth/refresh with short-lived access tokens (15min) + long-lived refresh tokens (7d) in httpOnly cookies.

#### P1-2: No 2FA / TOTP
**Issue:** totp_secret column exists in users table and is_totp_enabled column exists, but no TOTP setup or verification endpoint is implemented.  
**Fix:** Implement full TOTP setup flow (QR code generation + verification).

#### P1-3: WebSocket Has No Authentication Enforcement
**Location:** server/src/websocket/server.ts:26-33  
**Issue:** If JWT token is not provided or invalid, WebSocket connection is allowed with full market data access.  
**Fix:** Require valid authentication for user-specific streams. Gated by token.

#### P1-4: Single Route File — No Modularity
**Location:** server/src/routes/api.ts — 317 lines, all domains mixed  
**Fix:** Split into auth.routes.ts, market.routes.ts, orders.routes.ts, portfolio.routes.ts, admin.routes.ts, watchlist.routes.ts.

#### P1-5: Python Subprocess for Angel One — Unstable
**Location:** AngelOneAdapter.ts + angel_ticker.py  
**Issue:** Angel One market data via Python subprocess with no auto-restart mechanism visible. Silent outage risk.  
**Fix:** Implement robust subprocess management with auto-restart, health checks, Redis tick distribution.

#### P1-6: No Server-Side Pagination
**Location:** GET /admin/users, GET /admin/audit-logs, GET /orders  
**Issue:** All rows returned with only a LIMIT 100 on audit logs. Memory spikes with thousands of records.  
**Fix:** Add cursor/offset pagination to all list endpoints.

#### P1-7: Invalid SQL in VirtualWalletLedger
**Location:** VirtualWalletLedger.ts:82  
**Issue:** Math.max(0, used_margin - ?) is JavaScript, not SQL. This will error in any SQL engine.  
**Fix:** Use MAX(0, used_margin - ?) SQL syntax or handle in application layer.

#### P1-8: Missing order_events Table
**Issue:** No order state history tracking. Only final status stored.  
**Fix:** Add order_events table with (order_id, from_status, to_status, reason, timestamp).

#### P1-9: No CORS Configuration
**Location:** server/src/index.ts:24 — app.use(cors()) allows ALL origins  
**Fix:** Configure explicit allowed origins from ALLOWED_ORIGINS env var.

#### P1-10: No Helmet.js Security Headers
**Fix:** Add helmet middleware for CSP, X-Frame-Options, HSTS, etc.

---

### P2 — MEDIUM (Fix Before Full Production)

#### P2-1: No Structured Logging
**Fix:** Add Winston or Pino with JSON logging, log rotation, unique request_id per request.

#### P2-2: No Health Check Depth
**Issue:** /health returns static UP without checking DB, Redis, or market data.  
**Fix:** Dynamic health check verifying all dependencies.

#### P2-3: No Monitoring / Alerting
**Fix:** Add Prometheus + Grafana + Uptime Kuma.

#### P2-4: No Database Migrations
**Issue:** Fragile try/catch ALTER TABLE blocks. No version-controlled migrations.  
**Fix:** node-pg-migrate or Flyway.

#### P2-5: No Load Testing
**Fix:** k6 or Artillery scripts for 100-user scenarios.

#### P2-6: Frontend Stores JWT in localStorage — XSS Vulnerable
**Location:** client/src/App.tsx:11  
**Fix:** Use httpOnly + Secure cookies for session management.

#### P2-7: IDOR on Watchlist Delete
**Location:** DELETE /watchlists/items/:id — no ownership check  
**Fix:** Add WHERE watchlist_id IN (SELECT id FROM watchlists WHERE user_id = ?) to all watchlist mutations.

#### P2-8: No Backup Strategy
**Fix:** Daily pg_dump + offsite encrypted storage.

#### P2-9: Holdings API Incomplete
**Issue:** Holdings table only tracks CNC delivery. MIS intraday positions not surfaced.  
**Fix:** Unified portfolio API combining CNC holdings and active MIS positions.

---

### P3 — LOW (Nice to Have)

- P3-1: No email verification on registration
- P3-2: No notification delivery for price alerts
- P3-3: No portfolio snapshot history for P&L charts
- P3-4: No feature flags table
- P3-5: No backtesting engine
- P3-6: No dark/light theme toggle

---

## 3. SECURITY VULNERABILITY MATRIX

| Vulnerability | Severity | Location | Status |
|---|---|---|---|
| Hardcoded JWT fallback secret | CRITICAL | auth.ts, api.ts, ws/server.ts | Open |
| No brute force protection | CRITICAL | POST /auth/login | Open |
| CORS allows all origins | HIGH | index.ts:24 | Open |
| JWT in localStorage (XSS) | HIGH | App.tsx:11 | Open |
| IDOR on watchlist delete | HIGH | DELETE /watchlists/items/:id | Open |
| No input validation | HIGH | All routes | Open |
| Missing security headers | MEDIUM | All responses | Open |
| API keys in .env | MEDIUM | .env | Open |
| No SQL injection hardening | LOW | All DB calls (prepared stmts) | Mitigated |
| Real money trading | NONE | All systems | Blocked (SafetyLock) |

---

## 4. PERFORMANCE ASSESSMENT

| Metric | Current Estimate | Target | Gap |
|---|---|---|---|
| Max concurrent users | ~5-10 (SQLite limit) | 100 | Critical |
| Max WebSocket connections | ~50 (in-memory loop) | 300 | High |
| DB write throughput | ~1 write/ms (SQLite WAL) | 1000 writes/sec | Critical |
| Market data fan-out | O(n) per tick | O(1) via Redis pub/sub | High |
| API p95 latency | Unknown (never tested) | <500ms | Unknown |
| Order execution latency | Unknown (never tested) | <300ms | Unknown |

---

## 5. REUSABLE COMPONENTS

| Component | File | Decision |
|---|---|---|
| IMarketDataProvider interface | marketData/IMarketDataProvider.ts | Keep & Extend |
| SafetyLock | services/SafetyLock.ts | Keep |
| OMS business logic | trading/OMS.ts | Keep + Add Idempotency |
| RMS validation | trading/RMS.ts | Keep + Extend |
| ExecutionEngine | trading/ExecutionEngine.ts | Keep + Fix Race |
| GreeksEngine (Black-Scholes) | marketData/GreeksEngine.ts | Keep |
| OptionChainEngine | marketData/OptionChainEngine.ts | Keep |
| AlphaVantageAdapter | marketData/AlphaVantageAdapter.ts | Keep |
| AngelOneAdapter | marketData/AngelOneAdapter.ts | Keep + Improve |
| InstrumentMasterService | marketData/InstrumentMasterService.ts | Keep + PostgreSQL |
| TradingChart (LW Charts v5) | components/charts/TradingChart/ | Keep |
| React frontend components | client/src/components/ | Keep + Improve |
| Auth middleware | middleware/auth.ts | Keep + Harden |
| Audit logging | middleware/audit.ts | Keep + Extend |

---

## 6. COMPONENTS TO REPLACE

| Component | Reason | Replacement |
|---|---|---|
| SQLite (better-sqlite3) | Cannot scale, single writer | PostgreSQL + pg + pgPool |
| In-memory tick cache | Lost on restart, no pub/sub | Redis |
| Single api.ts route file | Monolithic | Modular route files |
| Docker single-container | Not production-ready | Multi-service Docker Compose |
| No Nginx | Direct port exposure | Nginx with SSL |
| Date.now() IDs | Collision risk | crypto.randomUUID() |
| bcryptjs | Older | Argon2id (argon2 package) |
| No migrations | Fragile hacks | node-pg-migrate |

---

## 7. MISSING COMPONENTS (Build From Scratch)

| Component | Priority |
|---|---|
| PostgreSQL schema + migrations | P0 |
| Redis service | P0 |
| Nginx configuration | P0 |
| Input validation middleware (Zod) | P0 |
| Rate limiting middleware | P0 |
| Refresh token system | P1 |
| TOTP/2FA flow | P1 |
| Structured logging (Pino/Winston) | P1 |
| docker-compose.production.yml | P1 |
| docker-compose.staging.yml | P1 |
| Monitoring stack (Prometheus+Grafana) | P2 |
| GitHub Actions CI/CD | P2 |
| Load tests (k6) | P2 |
| Reconciliation engine | P2 |
| Notification system | P3 |
| Portfolio snapshot cron job | P3 |
| Feature flags table | P3 |

---

## 8. DEPLOYMENT GAP

| Requirement | Current State | Status |
|---|---|---|
| HTTPS/TLS | HTTP only | Missing |
| Cloudflare | Not configured | Missing |
| Nginx | Not present | Missing |
| PostgreSQL | SQLite | Wrong DB |
| Redis | None | Missing |
| Monitoring | None | Missing |
| Backup | None | Missing |
| CI/CD | None | Missing |
| Staging environment | None | Missing |
| Secrets management | .env file | Inadequate |

---

## 9. SUMMARY SCORECARD

| Domain | Score | Notes |
|---|---|---|
| Business Logic | 7/10 | OMS/RMS/Portfolio solid |
| Security | 2/10 | Multiple critical vulnerabilities |
| Scalability | 1/10 | SQLite, no Redis, in-memory state |
| Infrastructure | 1/10 | No Nginx, no Redis, single Docker |
| Observability | 0/10 | No monitoring, no structured logs |
| Testing | 3/10 | 18 unit tests, no integration/load |
| Database | 2/10 | SQLite with no migrations |
| Safety | 9/10 | SafetyLock robustly enforced |
| Frontend | 7/10 | Good UI, XSS risk via localStorage |
| **Overall** | **3/10** | **Not Production Ready** |

