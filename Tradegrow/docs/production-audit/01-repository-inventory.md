# 01 — Repository Inventory
**Project:** StockSharp Multi-User Brokerage Simulation & Paper Trading Platform  
**Audit Date:** 2026-08-10

---

## Root Structure Classification

| Path | Type | Status | Purpose | Production Used? |
|------|------|--------|---------|-----------------|
| `server/` | Dir | **KEEP** | TS/Node.js backend (Express) | YES — Primary backend |
| `client/` | Dir | **KEEP** | React 19 + Vite frontend | YES — Primary frontend |
| `python_engine/` | Dir | **KEEP-VERIFY** | FastAPI greeks + Angel feed | PARTIAL |
| `Frontend/` | Dir | **ARCHIVE** | Static HTML mockups + Stitch designs | NO |
| `Truedata/` | Dir | **ARCHIVE** | TrueData Postman collections | NO — Reference only |
| `brokerage-database-v1.0-.../` | Dir | **ARCHIVE** | Duplicate migration bundle | NO |
| `data/` | Dir | **KEEP-VERIFY** | Runtime data directory | UNKNOWN |
| `scratch/` | Dir | **ARCHIVE** | Scratch/temp files | NO |
| `scripts/` | Dir | **KEEP** | production_health_check.ts | Dev/ops |
| `logs/` | Dir | **KEEP** | Runtime log files | YES — Auto-generated |
| `tests/` | Dir | **KEEP-VERIFY** | Jest test files | Not in production |
| `docs/` | Dir | **KEEP** | Architecture + audit docs | Reference |
| `.env` | File | **KEEP-SECURITY** | Dev env vars (live API keys!) | YES |
| `docker-compose.yml` | File | **KEEP** | Docker orchestration | YES |
| `Dockerfile` | File | **KEEP** | Multi-stage Node build | YES |
| `package.json` | File | **KEEP** | Root workspace | YES |
| `dump.rdb` | File | **REMOVE** | Stale Redis dump | NO |
| `jest.config.js` | File | **KEEP** | Test config | Dev only |

---

## Backend (server/) Classification

| File | Status |
|------|--------|
| src/index.ts | KEEP — Production entry point |
| src/routes/api.ts | KEEP — 1236 lines, all live routes |
| src/routes/adminApi.ts | KEEP — 761 lines, admin routes |
| src/websocket/server.ts | KEEP — WebSocket gateway |
| src/db/init.ts | KEEP — DB seed + migrations |
| src/db/schema.ts | KEEP — Migration runner + helpers |
| src/db/pool.ts | KEEP — PG connection pool |
| src/db/redis.ts | KEEP — Redis + in-memory fallback |
| src/db/migrations/001-008 | KEEP — All 8 migration files active |
| src/marketData/MarketDataEngine.ts | KEEP — Provider orchestrator |
| src/marketData/DhanAdapter.ts | KEEP — Primary live data (active) |
| src/marketData/AngelOneAdapter.ts | KEEP — Secondary live data |
| src/marketData/TrueDataAdapter.ts | KEEP — TrueData WS |
| src/marketData/AlphaVantageAdapter.ts | KEEP — Historical/global data |
| src/marketData/MockMarketDataProvider.ts | KEEP — Required off-market fallback |
| src/marketData/IndianStockMarketApiAdapter.ts | KEEP-VERIFY — RapidAPI adapter |
| src/marketData/NseOptionChainService.ts | KEEP — NSE index + PCR |
| src/marketData/OptionChainEngine.ts | KEEP — Option chain generator |
| src/marketData/InstrumentMasterService.ts | KEEP — Scrip master |
| src/marketData/GreeksEngine.ts | KEEP — Black-Scholes TS |
| src/marketData/SymbologyNormalizer.ts | KEEP — Token alias normalization |
| src/marketData/angel_option_chain.py | ARCHIVE — Python in wrong directory |
| src/marketData/angel_option_ws.py | ARCHIVE — Python in wrong directory |
| src/marketData/angel_ticker.py | ARCHIVE — Python in wrong directory |
| src/trading/OMS.ts | KEEP — Order management |
| src/trading/RMS.ts | KEEP — Risk management |
| src/trading/ExecutionEngine.ts | KEEP — Simulated execution |
| src/trading/PortfolioService.ts | KEEP — Positions + holdings |
| src/trading/VirtualWalletLedger.ts | KEEP — Wallet + ledger |
| src/services/MarginEngineService.ts | KEEP — Margin calc |
| src/services/ExpiryCalendarService.ts | KEEP — Expiry calendar |
| src/services/FnOStockService.ts | KEEP — F&O stock data |
| src/services/MarketDataStorageService.ts | KEEP — Local candles |
| src/services/ReconciliationMonitorService.ts | KEEP — Price reconciliation |
| src/services/AccuracyCheckService.ts | KEEP — Pricing accuracy |
| src/services/SafetyLock.ts | KEEP — Real-money guard |
| src/middleware/auth.ts | KEEP — JWT auth |
| src/middleware/audit.ts | KEEP — Audit logger |
| src/middleware/schemas.ts | KEEP — Zod schemas |
| src/middleware/upload.ts | KEEP — KYC file upload |
| src/middleware/validate.ts | KEEP — Validation middleware |
| src/utils/crypto.ts | KEEP — UUID generator |
| src/utils/totp.ts | KEEP — TOTP for broker auth |

---

## Frontend (client/) Classification

All 49 component/hook/type files: KEEP (all imported by App.tsx)

## Disconnected / Archive Items

| Path | Classification | Reason |
|------|---------------|--------|
| Frontend/Client_app.html | ARCHIVE | Static HTML mockup, no backend connection |
| Frontend/Client_mobile_panel/ | ARCHIVE | Superseded by client/src/components/mobile/ |
| Frontend/admin_panel/ | ARCHIVE | Stitch design file |
| Frontend/stitch_designs/ | ARCHIVE | UI design exports |
| Truedata/*.json | ARCHIVE | API reference docs only |
| dump.rdb | REMOVE | Stale Redis dump, do not deploy |
| scratch/ | ARCHIVE | Dev scratch files |
