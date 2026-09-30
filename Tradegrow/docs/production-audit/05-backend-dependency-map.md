# 05 — Backend Dependency Map

## Module Import Graph

```
server/src/index.ts
    ├── express, http, cors, helmet, dotenv, path
    ├── middleware/auth → validateStartupEnvironment
    ├── db/init → seedDatabase
    ├── marketData/MarketDataEngine
    ├── trading/ExecutionEngine
    ├── websocket/server
    ├── routes/api
    ├── routes/adminApi
    └── services/SafetyLock

routes/api.ts
    ├── express (Router)
    ├── jwt, argon2, express-rate-limit
    ├── db/schema (query, queryOne, execute)
    ├── middleware/auth (authenticateToken, checkRole)
    ├── middleware/validate, schemas, audit, upload
    ├── trading/VirtualWalletLedger
    ├── trading/OMS
    ├── trading/PortfolioService
    ├── marketData/MarketDataEngine
    ├── marketData/GreeksEngine
    ├── services/MarketDataStorageService
    ├── marketData/InstrumentMasterService
    ├── utils/crypto
    ├── services/SafetyLock
    ├── db/pool (checkDatabaseHealth)
    └── middleware/upload (kycUpload)

routes/adminApi.ts
    ├── middleware/auth, db/schema, db/pool, db/redis
    ├── middleware/audit
    ├── trading/VirtualWalletLedger
    ├── marketData/MarketDataEngine
    ├── services/MarketDataStorageService
    ├── utils/crypto
    └── services/SafetyLock

marketData/MarketDataEngine.ts
    ├── AngelOneAdapter, IndianStockMarketApiAdapter
    ├── AlphaVantageAdapter, TrueDataAdapter, DhanAdapter
    ├── MockMarketDataProvider
    ├── marketData/types
    ├── db/redis
    └── marketData/SymbologyNormalizer (require, lazy)

trading/OMS.ts
    ├── db/schema
    ├── trading/RMS
    ├── trading/VirtualWalletLedger
    ├── trading/ExecutionEngine
    ├── utils/crypto
    └── services/SafetyLock

trading/RMS.ts
    ├── db/schema
    └── marketData/MarketDataEngine

trading/ExecutionEngine.ts
    ├── db/schema
    ├── marketData/MarketDataEngine
    └── trading/VirtualWalletLedger

trading/PortfolioService.ts
    ├── db/schema
    └── marketData/MarketDataEngine

trading/VirtualWalletLedger.ts
    ├── db/schema
    └── utils/crypto

services/MarginEngineService.ts
    ├── db/schema
    ├── marketData/MarketDataEngine
    ├── marketData/GreeksEngine
    └── services/ExpiryCalendarService

services/ExpiryCalendarService.ts
    └── db/schema

services/FnOStockService.ts
    └── db/schema (instruments table)

db/schema.ts
    ├── fs, path
    ├── pg (Client)
    └── db/pool

db/pool.ts
    └── pg (Pool)

db/redis.ts
    └── ioredis

db/init.ts
    ├── db/schema
    ├── utils/crypto
    └── argon2

middleware/auth.ts
    ├── express
    ├── jsonwebtoken
    └── db/schema

middleware/audit.ts
    └── db/schema

utils/crypto.ts
    └── uuid

utils/totp.ts
    └── (crypto, OTP logic for broker auth)
```

## Circular Dependency Analysis

| Import | Status |
|--------|--------|
| MarketDataEngine ↔ OMS | SAFE — OMS uses getCachedTick (read-only) |
| ExecutionEngine ↔ VirtualWalletLedger | SAFE — unidirectional |
| RMS ↔ MarketDataEngine | SAFE — RMS reads tick data only |
| routes/api ↔ services/* | SAFE — lazy dynamic import() for non-critical services |

Note: `SymbologyNormalizer` is required via `require()` (not import) to avoid circular load issues.

## Service Singleton Pattern

These services use Singleton pattern (.getInstance()):
- MarketDataEngine.getInstance()
- InstrumentMasterService.getInstance()
- RedisService.getInstance()

These use module-level exports (singleton via Node module cache):
- reconciliationMonitor
- nseOptionChainService  
- accuracyCheckService
- marginEngineService

## Dynamic Import Usage

Used in routes/api.ts and server/index.ts for non-critical services:
```typescript
import('./services/ReconciliationMonitorService')
import('./services/AccuracyCheckService')
import('./marketData/NseOptionChainService')
import('./services/MarginEngineService')
import('./services/ExpiryCalendarService')
import('./marketData/OptionChainEngine')
```
This prevents circular startup failures and allows lazy loading.
