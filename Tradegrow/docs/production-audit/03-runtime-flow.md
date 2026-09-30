# 03 — Runtime Flow

## Application Startup Sequence

```
1. Node.js starts: node server/dist/index.js
2. dotenv.config() — loads .env
3. validateStartupEnvironment() — checks JWT_SECRET (min 32 chars), exits if missing
4. SafetyLock.assertSimulationOnly() — throws if REAL_MONEY_TRADING=true
5. Express + HTTP server created
6. Helmet.js, CORS, JSON parsers applied
7. REST routes registered (/api/v1, /api/v1/admin)
8. startServer() async:
   a. seedDatabase() — runMigrations() → seed admin/trader1 if empty
   b. InstrumentMasterService.initializeOnStartup() — loads scrip master
   c. MarketDataEngine.initialize() — selects provider by env var
      - If market hours OR ALLOW_OFF_MARKET_LIVE_DATA=true → real provider
      - Else → MOCK_ENGINE (24/7 fallback)
   d. reconciliationMonitor.start(60000) — price accuracy every 60s
   e. nseOptionChainService.start() — NSE PCR/MaxPain every 30s
   f. accuracyCheckService.start() — option pricing check every 60s
   g. ExecutionEngine.start() — simulated fill loop
   h. setupWebSocketServer(server) — /ws gateway
   i. express.static(client/dist) — serve frontend SPA
   j. server.listen(5000)
```

## Real-Time Market Data Flow

```
MARKET HOURS (9:15 AM – 3:30 PM IST, Mon–Fri):
─────────────────────────────────────────────────
DhanAdapter WebSocket
    │ (Dhan feed token auth, heartbeat, reconnect)
    ↓
MarketDataEngine.tickCallback()
    ├── tickCache.set(token, tick) — in-memory cache
    ├── redis.set("tick:{token}", json, 3600s) — Redis TTL cache
    └── redis.publish("market:ticks", json) — pub/sub

Redis pub/sub subscriber (in MarketDataEngine constructor)
    ↓
globalCallbacks.forEach(cb) — registered by WebSocket server
    ↓
WebSocket server.ts onTick()
    ↓
wss.clients.forEach() — filter by subscribed tokens
    ↓
client.send(MARKET_TICK JSON) — browser WebSocket

OFF-MARKET / FALLBACK:
─────────────────────────────────────────────────
MockMarketDataProvider
    │ (setInterval every 500ms, random walk simulation)
    ↓
Same tick pipeline above
```

## Request Flow (User Places Order)

```
Browser → POST /api/v1/orders
    │
    ├── apiLimiter (2000/15min) + orderLimiter (30/min per user)
    ├── authenticateToken() — JWT verify → DB user lookup
    ├── validateBody(SubmitOrderSchema) — Zod validation
    │
    └── OMS.submitOrder(dto)
        ├── SafetyLock.assertSimulationOnly()
        ├── User existence check (DB)
        ├── Idempotency key check
        ├── RMS.validateOrder() — margin, risk limits, circuit breakers
        │   ├── PASS → INSERT INTO orders (status=ACCEPTED)
        │   └── FAIL → INSERT INTO orders (status=REJECTED), return error
        ├── VirtualWalletLedger.reserveMargin() — lock buying power
        └── ExecutionEngine queue → fill on next tick

ExecutionEngine (every 500ms):
    ↓
MarketDataEngine.getCachedTick(token)
    ↓ (tick found)
PortfolioService.recordFill() → INSERT INTO executions
    ↓
VirtualWalletLedger.recordFill() — debit/credit wallet
    ↓
UPDATE positions
    ↓
WebSocket broadcast → {type: "ORDER_UPDATE", data: order}
```

## Option Chain Flow

```
Browser → GET /api/v1/market/option-chain?symbol=NIFTY&expiry=...
    │
    └── OptionChainEngine.generateOptionChain()
        ├── ExpiryCalendarService.getValidExpiries() — next Thu/Mon dates
        ├── MarketDataEngine.getCachedTick("NSE_NIFTY50") — spot LTP
        ├── Generate strikes (ATM ±10 by 50-pt steps)
        └── For each strike:
            ├── getCachedTick("NFO_NIFTY_{strike}_CE") — live CE LTP
            ├── getCachedTick("NFO_NIFTY_{strike}_PE") — live PE LTP
            └── GreeksEngine.calculate() — delta/gamma/theta/vega/IV

Browser → GET /api/v1/market/option-chain/stream (SSE)
    └── Push every 500ms
```

## Authentication Flow

```
Login: POST /api/v1/auth/login
    ├── Query user by email/username
    ├── Check account lockout (5 failures → 15min lock)
    ├── argon2.verify(hash, password)
    ├── Reset failed_attempts on success
    ├── jwt.sign({userId, username, email, role}, JWT_SECRET, 24h)
    ├── jwt.sign(..., JWT_REFRESH_SECRET, 30d)
    └── Response: {token, refreshToken, user}

Authenticated Requests:
    └── Authorization: Bearer <JWT>
        ├── authenticateToken() middleware
        ├── jwt.verify(token, JWT_SECRET)
        └── DB lookup: SELECT id FROM users WHERE id=$1
```

## Admin Data Flow

```
Admin User → GET /api/v1/admin/* (or /api/v1/admin/dashboard/executive)
    ├── authenticateToken() + checkRole(['SUPER_ADMIN','ADMIN',...])
    └── Parallel DB queries → KPIs (users, orders, P&L, risk events)

Admin Actions:
    ├── Adjust balance → VirtualWalletLedger.adminAdjustBalance()
    ├── KYC approve/reject → UPDATE kyc_records
    ├── Switch market data provider → MarketDataEngine.switchPrimaryProvider()
    ├── Fund requests → UPDATE fund_requests (PENDING→APPROVED/REJECTED)
    └── All actions → logAuditAction() → INSERT INTO audit_logs
```
