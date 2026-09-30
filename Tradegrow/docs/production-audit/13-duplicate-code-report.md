# 13 — Duplicate Code Report

## Confirmed Duplicates

### 1. Duplicate REST API Route: /api/v1/market/candles

**File:** `server/src/routes/api.ts`

**Route 1 (Line 267–277):**
```typescript
router.get('/market/candles', async (req, res) => {
  // Uses MarketDataEngine.getHistoricalCandles() — REAL provider data
  // Parameters: token, timeframe, count
  // Returns: {success, candles, currentLtp}
});
```

**Route 2 (Line 603–698):**
```typescript
router.get('/market/candles', async (req, res) => {
  // Uses synthetic Black-Scholes + random walk generation
  // Parameters: symbol, timeframe, limit
  // Returns: {success, symbol, timeframe, candles}
  // STATUS: UNREACHABLE — Express matches first route
});
```

**Impact:** Route 2 generates synthetic candles via random walk + Black-Scholes. Although it's unreachable currently, it contains useful synthetic option chart logic.

**Resolution:**
- Rename Route 2 to `GET /api/v1/market/synthetic-candles` for option chart previews
- Or remove Route 2 entirely if the candle chart feature works without it

---

### 2. Duplicate Order Placement Endpoints

**Route 1 (Line 703):** `POST /api/v1/orders`
**Route 2 (Line 726):** `POST /api/v1/orders/place`

Both routes:
- Require authentication + order rate limiter
- Validate with SubmitOrderSchema
- Call `OMS.submitOrder()` with identical parameters
- Return identical responses

**Impact:** Clients calling either endpoint get the same behavior. Unnecessary code duplication.

**Resolution:** Remove `/orders/place`, keep `/orders` as canonical. Frontend already uses `/orders`.

---

### 3. Admin Dashboard Duplication

**Route 1:** `GET /api/v1/admin/dashboard` (in api.ts, line 972)
- Returns basic telemetry: totalUsers, activeOrdersToday, totalExecutionsToday, totalVirtualCapital

**Route 2:** `GET /api/v1/admin/dashboard/executive` (in adminApi.ts, line 25)
- Returns comprehensive KPIs: 20+ metrics, customer/trading/financial/risk stats

**Status:** Both are reachable and used (different frontend components). Not a true duplicate — different depth/scope.

**Action:** Document clearly. Route 1 is a lightweight health check, Route 2 is the full admin dashboard.

---

### 4. Duplicate Admin Routes Prefix

`api.ts` registers admin routes at `/api/v1/admin/*`
`adminApi.ts` (mounted at `/api/v1/admin/`) also registers admin routes.

Some paths may collide:
- api.ts: `GET /admin/dashboard` → basic dashboard
- adminApi.ts: `GET /dashboard/executive` → full dashboard

Full collision check needed but no confirmed conflict found.

---

### 5. Greeks Calculation Duplication

**TypeScript:** `server/src/marketData/GreeksEngine.ts`
- Black-Scholes analytical implementation
- Used by: OptionChainEngine, MarginEngineService, api.ts (MCX contracts)

**Python:** `python_engine/services/greeks_service.py`
- Same Black-Scholes formula (with py_vollib acceleration if available)
- Used by: FastAPI `/api/v1/greeks/calculate` (port 8000)

**Status:** Both are ACTIVE but independent. Node.js never calls the Python engine for greeks.

**Assessment:** Not harmful — provides redundancy. Python engine is faster for batch calculations with py_vollib.

**Recommendation:** Document clearly. Consider calling Python engine from Node.js for production-grade Greeks (especially IV calculation which is iterative).

---

### 6. Market Data Initialization in Multiple Places

**MarketDataEngine.ts:**
- `new AngelOneAdapter()`
- `new DhanAdapter()`
- etc.

**adminApi.ts:**
- `MarketDataEngine.getInstance().switchPrimaryProvider(providerName)`

Both paths correctly use the singleton, no actual duplication.

---

## Minor Code Duplication

| Pattern | Location | Assessment |
|---------|----------|------------|
| `getClientIp(req)` | api.ts AND adminApi.ts | Copy-paste. Extract to middleware/utils.ts |
| Date formatting | Multiple admin routes | Minor duplication, not harmful |
| Error response format | All routes | Consistent `{success: false, error: {code, message}}` — intentional, not harmful |
| `authLimiter` config | api.ts | Only defined once, no duplication |
