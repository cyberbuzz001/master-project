# 14 — Dead Code Report

## Confirmed Dead Code

### 1. Unreachable Express Route

**File:** `server/src/routes/api.ts`, Lines 603–698  
**Path:** `GET /api/v1/market/candles` (second handler)  
**Status:** DEAD — unreachable due to duplicate route registration  
**Evidence:** Express router matches the first registered handler (line 267) and never reaches line 603.  
**Action:** Rename to `/synthetic-candles` or remove.

---

### 2. Python WebSocket Echo (Stub)

**File:** `python_engine/main.py`, Lines 96–106  
```python
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    while True:
        data = await websocket.receive_text()
        await websocket.send_text(json.dumps({"type": "PONG", "received": data}))
```

**Status:** STUB — only echoes received messages. No actual market data is broadcast.  
**Evidence:** No frontend or backend code connects to `ws://localhost:8000/ws`  
**Action:** Document as placeholder. Implement proper feed broadcast or remove.

---

### 3. Python Files in Server Source Tree

**Files:**
- `server/src/marketData/angel_option_chain.py`
- `server/src/marketData/angel_option_ws.py`
- `server/src/marketData/angel_ticker.py`

**Status:** DEAD — never executed by Node.js server  
**Evidence:** No TypeScript file imports or `exec()`-calls these Python scripts  
**Action:** Move to `python_engine/` or archive.

---

### 4. `better-sqlite3` Dependency (No Longer Used)

**File:** `package.json` — `"better-sqlite3": "^11.8.0"`  
**Also:** `@types/better-sqlite3` in devDependencies  

**Status:** DEAD dependency — The server was originally SQLite. Migration to PostgreSQL (P0-1 fix) replaced all SQLite usage.  
**Evidence:** `server/src/db/schema.ts` comment: "P0-1 FIX: Replaces SQLite better-sqlite3 with PostgreSQL via pg pool"  
**Evidence:** No import of `better-sqlite3` found in any .ts file  
**Action:** Remove from `package.json` to reduce bundle size.

---

### 5. `@types/ioredis` (Outdated — Types Built Into ioredis 6)

**File:** `package.json` — `"@types/ioredis": "^4.28.10"`  
**Status:** DEAD/INCORRECT — ioredis 6.x bundles its own TypeScript types. `@types/ioredis` is for v4.  
**Action:** Remove `@types/ioredis` from devDependencies.

---

### 6. `bcryptjs` Dependency (Replaced by Argon2)

**File:** `package.json` — `"bcryptjs": "^2.4.3"` and `"@types/bcryptjs": "^2.4.6"`  
**Status:** DEAD — auth.ts and init.ts both use `argon2` (Argon2id). bcryptjs was the original implementation.  
**Evidence:** `api.ts` imports `argon2`, not `bcryptjs`. db/init.ts uses `argon2.hash()`.  
**Action:** Remove `bcryptjs` and `@types/bcryptjs` from package.json.

---

## Potentially Dead Code (KEEP-VERIFY)

### 7. `optionalAuth` Middleware

**File:** `server/src/middleware/auth.ts`, Lines 67–79  
**Status:** Defined but no usages found in routes  
**Evidence:** Neither `api.ts` nor `adminApi.ts` imports `optionalAuth`  
**Action:** Confirm no usage then remove, or mark as future use.

### 8. `getHistoricalCandles()` in Some Adapters

Some market data adapters may have getHistoricalCandles() that returns mock/empty data because the provider doesn't support historical data. These are not "dead" but may return unhelpful data.

### 9. `requireSuperAdmin` Middleware

**File:** `server/src/middleware/auth.ts`, Lines 104–106  
```typescript
export function requireSuperAdmin(...) { checkRole(['SUPER_ADMIN'])(req, res, next); }
```
**Status:** Defined but routes use `checkRole(['SUPER_ADMIN'])` directly  
**Action:** Remove or use consistently.

---

## Summary of Safe Removals

| Item | Files | Saves |
|------|-------|-------|
| `better-sqlite3` + types | package.json | ~1.5MB npm package |
| `bcryptjs` + types | package.json | ~100KB npm package |
| `@types/ioredis` v4 | package.json | Dev-only |
| Python files in wrong dir | 3 .py files | Clarity |
| dump.rdb | 1 file | 3.5KB + security risk |
| Dead candles route | api.ts lines 603-698 | 96 lines |
| Duplicate /orders/place | api.ts lines 726-747 | 22 lines |
