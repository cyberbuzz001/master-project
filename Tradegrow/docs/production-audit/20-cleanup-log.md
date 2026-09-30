# 20 — Cleanup Log

## Audit Date: 2026-08-10
## Auditor: Senior Principal Architect — Production Audit

---

## PHASE 1: Inspection Complete

Full codebase inspection completed. No files deleted or modified during inspection.

### Files Inspected:
- server/src/index.ts — Entry point ✅
- server/src/routes/api.ts (1236 lines) — All routes mapped ✅
- server/src/routes/adminApi.ts (761 lines) — All admin routes mapped ✅
- server/src/websocket/server.ts — WebSocket gateway ✅
- server/src/db/init.ts, schema.ts, pool.ts, redis.ts — DB layer ✅
- server/src/db/migrations/ (8 files) — All migration SQL ✅
- server/src/marketData/ (17 files) — All adapters + engines ✅
- server/src/trading/ (5 files) — OMS/RMS/Execution/Portfolio/Wallet ✅
- server/src/services/ (7 files) — Support services ✅
- server/src/middleware/ (5 files) — Auth/Audit/Validation/Upload ✅
- server/src/utils/ (2 files) — Crypto/TOTP ✅
- client/src/ (49 component/hook/type files) — All frontend code ✅
- python_engine/ (5 files) — FastAPI greeks engine ✅
- docker-compose.yml, Dockerfile — Container config ✅
- .env — Environment configuration ✅
- package.json — Dependencies ✅

---

## PHASE 2: Findings Summary

### Classification Results

| Category | Count | Files |
|----------|-------|-------|
| KEEP — Active Production | 89 | All server/ and client/ source files |
| KEEP-VERIFY | 8 | See doc 12 |
| ARCHIVE — Not Production Code | 15 | Frontend/, Truedata/, Python in wrong dir |
| REMOVE — Confirmed Dead | 2 | dump.rdb, @types/ioredis (wrong version) |

### Critical Findings

| Finding | Severity | Doc |
|---------|----------|-----|
| Live credentials in .env | CRITICAL | 15, 18 |
| Weak JWT secret in docker-compose | CRITICAL | 15 |
| Dead route: /market/candles (second handler) | HIGH | 06, 12 |
| bcryptjs dependency unused | MEDIUM | 14 |
| better-sqlite3 dependency unused | MEDIUM | 14 |
| Python files in TS source tree | MEDIUM | 12 |
| dump.rdb in repository | MEDIUM | 12 |
| kyc_records vs kyc_applications naming | HIGH | 07 |
| Duplicate order endpoints | LOW | 06 |
| TOTP secret exposed | CRITICAL | 15 |

---

## PHASE 3: Recommended Cleanup Actions (Prioritized)

### IMMEDIATE (Do Now — No Risk)

1. **Delete dump.rdb**
   ```bash
   del dump.rdb
   ```
   Risk: NONE. Redis dump with stale data.

2. **Add dump.rdb to .gitignore**
   ```bash
   echo "dump.rdb" >> .gitignore
   echo "*.rdb" >> .gitignore
   ```

3. **Remove unused npm packages**
   ```bash
   npm uninstall bcryptjs @types/bcryptjs better-sqlite3 @types/better-sqlite3 @types/ioredis
   ```
   Risk: LOW. Verify build still passes after removal.

### SAFE CODE FIXES

4. **Fix duplicate /market/candles route**
   File: server/src/routes/api.ts
   Change line 603: `router.get('/market/candles', ...)`
   To: `router.get('/market/synthetic-candles', ...)`
   Risk: LOW. Second handler was unreachable anyway.

5. **Consolidate duplicate order endpoints**
   File: server/src/routes/api.ts
   Remove lines 726-747 (POST /orders/place)
   Or redirect to /orders
   Risk: LOW. Verify no frontend calls /orders/place exclusively.

6. **Move Python files to correct directory**
   ```bash
   move server\src\marketData\angel_option_chain.py python_engine\
   move server\src\marketData\angel_option_ws.py python_engine\
   move server\src\marketData\angel_ticker.py python_engine\
   ```
   Risk: NONE. Not executed by Node.js server.

### CREDENTIAL ROTATION (Must do before production)

7. Rotate ANGELONE_TOTP_SECRET
8. Rotate DHAN_ACCESS_TOKEN  
9. Generate new JWT_SECRET (min 64 chars)
10. Generate new JWT_REFRESH_SECRET
11. Set strong PostgreSQL password

### VERIFY BEFORE ARCHIVING

12. Inspect `data/` directory contents
13. Verify `tests/` — check if any tests are critical
14. Verify IndianStockMarketApiAdapter works without visible API key

---

## PHASE 4: What NOT to Remove

| Item | Reason to Keep |
|------|---------------|
| MockMarketDataProvider | REQUIRED — off-market hours fallback |
| SafetyLock | REQUIRED — prevents real money trading |
| All 8 migration files | REQUIRED — database schema |
| All 5 market data adapters | REQUIRED — provider flexibility |
| Python engine | REQUIRED — greeks microservice (and Angel One feed) |
| All frontend components | REQUIRED — all imported by App.tsx |
| Frontend/ directory | ARCHIVE only — contains design reference files |

---

## Cleanup Status

| Action | Status | Date |
|--------|--------|------|
| Codebase inspection | COMPLETE | 2026-08-10 |
| Audit docs created (01-20) | COMPLETE | 2026-08-10 |
| Dead code identified | COMPLETE | 2026-08-10 |
| Credentials reviewed | COMPLETE | 2026-08-10 |
| Cleanup execution | PENDING | To be approved |
| Production build test | PENDING | After cleanup |
| Deployment | PENDING | After security hardening |

---

## Files Created by This Audit

```
docs/production-audit/
├── 01-repository-inventory.md
├── 02-architecture-map.md
├── 03-runtime-flow.md
├── 04-frontend-dependency-map.md
├── 05-backend-dependency-map.md
├── 06-api-inventory.md
├── 07-database-inventory.md
├── 08-redis-inventory.md
├── 09-websocket-inventory.md
├── 10-market-data-inventory.md
├── 11-trading-engine-inventory.md
├── 12-unused-code-report.md
├── 13-duplicate-code-report.md
├── 14-dead-code-report.md
├── 15-security-audit.md
├── 16-production-readiness.md
├── 17-deployment-architecture.md
├── 18-environment-variables.md
├── 19-production-checklist.md
└── 20-cleanup-log.md (this file)
```

No source files were modified during this audit.
All findings are documented. Cleanup requires explicit approval.
