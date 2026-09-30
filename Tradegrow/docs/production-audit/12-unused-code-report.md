# 12 — Unused Code Report

## Summary

Classification after full dependency trace.

| Classification | Count | Action |
|---------------|-------|--------|
| KEEP (active production code) | ~95 files | No action |
| KEEP-VERIFY (likely needed, verify) | ~8 files | Manual review |
| ARCHIVE (keep but not production) | ~15 items | Move to /archive/ |
| REMOVE (confirmed dead) | 2 items | Safe to delete |
| UNKNOWN | 0 | None |

---

## ARCHIVE Items (Not Part of Running Application)

### 1. Frontend/ Directory (Entire)
**Status:** ARCHIVE  
**Reason:** Not imported by any production code. Contains:
- `Frontend/Client_app.html` — Static HTML mockup (97KB, standalone)
- `Frontend/Client_mobile_panel/` — Mobile UI mockup (not connected)
- `Frontend/admin_panel/stitch_apex_trade_terminal/` — Stitch design assets
- `Frontend/mobileapp/` — Mobile design files
- `Frontend/stitch_designs/` — UI design exports

These are design reference files, not executable code.

**Risk if removed:** None to running application.
**Action:** Move to `/archive/Frontend/` or document as design assets.

### 2. Python Files in Wrong Directory
**Status:** ARCHIVE  
**Path:**
- `server/src/marketData/angel_option_chain.py`
- `server/src/marketData/angel_option_ws.py`
- `server/src/marketData/angel_ticker.py`

**Reason:** Python files placed inside the TypeScript server source tree. They are NOT imported by any TypeScript file. They appear to be development experiments for an Angel One WebSocket feed.

**Risk if removed:** None to running application.
**Action:** Move to `python_engine/experiments/` or archive.

### 3. Truedata/ Directory
**Status:** ARCHIVE  
**Reason:** Contains only Postman API collection JSON files for TrueData API documentation. Not code — reference material.

**Risk if removed:** None to running application.
**Action:** Move to `docs/api-references/truedata/`

### 4. brokerage-database-v1.0-production-migration-bundle/
**Status:** ARCHIVE  
**Reason:** Standalone migration bundle, already superseded by `server/src/db/migrations/` (which has more migrations). Duplicate/older version.

**Risk if removed:** None — actual migrations are in server/src/db/migrations/.
**Action:** Archive or delete.

### 5. scratch/ Directory
**Status:** ARCHIVE  
**Reason:** Development scratch files.

### 6. dump.rdb
**Status:** REMOVE  
**Reason:** Redis dump file committed to repository. Contains stale development data. Should NEVER be deployed to production as it could seed incorrect cached prices.

**Risk if removed:** None.
**Action:** DELETE immediately. Add `dump.rdb` to .gitignore.

---

## KEEP-VERIFY Items (Need Manual Confirmation)

### 1. IndianStockMarketApiAdapter.ts
**File:** `server/src/marketData/IndianStockMarketApiAdapter.ts`  
**Status:** KEEP-VERIFY  
**Concern:** No RapidAPI key visible in .env. Adapter may fail silently.
**Action:** Verify if API key is needed, add to .env or disable adapter.

### 2. python_engine/ (Partial)
**Files:** `python_engine/main.py`, `services/angel_service.py`, `services/greeks_service.py`  
**Status:** KEEP-VERIFY  
**Concern:** The `/ws` WebSocket in main.py is just an echo stub. The `AngelSmartApiFeed` in angel_service.py initializes but may not be used by Node.js.
**Action:** Confirm if Greeks API (`POST /api/v1/greeks/calculate`) is called from any frontend component. If not, document as standalone service.

### 3. data/ Directory
**Status:** KEEP-VERIFY  
**Reason:** Directory exists but contents unknown. Could contain instrument master CSV files.
**Action:** Inspect contents manually.

### 4. tests/ Directory
**Status:** KEEP-VERIFY (Dev Only)  
**Reason:** Jest tests exist but are not run in production. No CI/CD pipeline detected.
**Action:** Review test coverage, set up CI pipeline for pre-deployment validation.

### 5. scripts/production_health_check.ts
**Status:** KEEP-VERIFY  
**Reason:** Useful operational script but not referenced by package.json scripts.
**Action:** Add as `npm run health-check` or document separately.

---

## Duplicate Route Issues (Not "Unused" But Problematic)

### Duplicate: /api/v1/market/candles
**File:** routes/api.ts  
**Lines:** 267–277 (real candles) AND 603–698 (synthetic/BS candles)  
**Issue:** Two GET handlers for same path. Second handler (line 603) is UNREACHABLE.  
**Action:** Rename line 603 handler to `/api/v1/market/synthetic-candles`.

### Duplicate: POST /api/v1/orders AND /api/v1/orders/place
**File:** routes/api.ts  
**Lines:** 703–724 and 726–747  
**Issue:** Identical implementations.  
**Action:** Consolidate, redirect one to the other.

---

## Code That Looks Dead But Is Actually Used

| Code | Appears Dead | Actually Used By |
|------|-------------|-----------------|
| MockMarketDataProvider | Looks like test code | Off-market hours failover — REQUIRED |
| SafetyLock | Looks redundant | Called in OMS, ExecutionEngine, server startup — REQUIRED |
| SymbologyNormalizer | Small/obscure | MarketDataEngine token alias resolution — REQUIRED |
| totp.ts | Rarely called | AngelOne/broker TOTP auth — REQUIRED |
| dump.rdb | Data file | NOT used by any code — REMOVE |
