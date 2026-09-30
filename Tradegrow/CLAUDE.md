# TradeGrow / StockSharp — Developer & AI Assistant Guidelines (CLAUDE.md)

This document contains critical architectural rules, conventions, and guardrails for any AI assistant (Claude, Antigravity, Cursor, Copilot) working on the TradeGrow codebase. **Always follow these rules to avoid breaking production features.**

---

## 1. System Overview & Technology Stack
* **Backend:** Node.js / TypeScript (Express, native `ws` WebSockets, `pg` for PostgreSQL, `ioredis` for Redis).
* **Frontend:** React + TypeScript (Vite, TailwindCSS, Lucide icons, lightweight charting).
* **Database:** PostgreSQL 16 + TimescaleDB extension for hypertable market data.
* **Cache & Pub/Sub:** Redis 7 (Standalone, `/market:ticks` channel).
* **Python Engine:** Python 3.11+ FastAPI for accelerated Black-Scholes Greeks (`py_vollib`).
* **Live Domain & VPS:** `https://tradegrowx.in` hosted on Hostinger VPS (Docker Compose project: `tradegrow`).

---

## 2. Fundamental Architectural Rules (NEVER BREAK)

### A. Market Data Provider: Dhan HQ API v2 ONLY
* **Primary Provider:** Dhan HQ API v2 is the authoritative, exclusive live market data provider.
* **Disabled Providers:** Fyers is completely disabled. Do not re-enable or mix Fyers feeds unless explicitly directed.
* **Adapter File:** `server/src/marketData/DhanAdapter.ts`.

### B. NO Synthetic Ticks on WebSocket Feed
* **Rule:** Simulated or synthetic Black-Scholes option ticks must **NEVER** be injected into `MarketDataEngine.broadcastTick` or streamed over `wss://tradegrowx.in/ws`.
* **Why:** Injecting synthetic ticks overwrites real Dhan market prices (e.g. overwriting a ₹116 Sensex call with a ₹458 theoretical Black-Scholes price).
* Real ticks from Dhan WebSocket must be mapped back to canonical instrument tokens (e.g. `BFO_SENSEX_77300_CE`, `NFO_NIFTY_24300_PE`) and broadcast directly to subscribers.

### C. BSE Derivatives & Symbology Rules
* **BSE F&O Segment:** BSE options and futures use segment prefix `BFO` (e.g. `BFO_SENSEX_77300_CE`).
* **Scrip Master Normalization:** In `InstrumentMasterService.ts`, Dhan CSV scrip master instruments with `BSXOPT` and `BSXFUT` MUST map to `SENSEX`, and `BKXOPT` / `BKXFUT` MUST map to `BANKEX`.
* **Option Token Formats:** Canonical token formats are `${segment}_${symbol}_${strike}_${optType}` (e.g. `BFO_SENSEX_77300_CE` or `NFO_NIFTY_24300_PE`).

### D. Option Chain Centering & Expiry Modeling
* **Live Spot Centering:** `OptionChainEngine.ts` must dynamically center strike ranges around Dhan's real-time spot price (`spotPrice`), computing `atmStrike = Math.round(spotPrice / step) * step`.
* **0DTE (Expiry Day) Modeling:** On expiry days (e.g. Thursday SENSEX expiry), time-to-expiry must reflect intraday fractions of a day (`diffMs / (1000 * 60 * 60 * 24)`), **never hardcode or clamp to 3.5 days**.
* **In-Flight Caching:** `OptionChainEngine.ts` uses a 2-second in-memory response cache and single-flight request deduping to prevent external rate limits and keep API response times under 300ms.

### E. Callback Leak & Redis Output Buffer Protection
* In `MarketDataEngine.subscribe(tokens)`: **Do NOT** register duplicate `(tick) => this.broadcastTick(tick)` callbacks to `DhanAdapter.callbacks` on every client subscribe. `DhanAdapter` must only have a single master broadcaster registered on startup.
* Accumulating duplicate callbacks floods Redis with 100+ duplicate publishes per tick frame, exhausting Redis client output buffers and freezing Node.js.

### F. Order Execution & Position Creation
* **Matching Loop:** `ExecutionEngine.ts` processes pending orders every 500ms against real live ticks.
* **Order Statuses:** Orders transition from `ACCEPTED` / `PENDING` -> `EXECUTING` (during lock) -> `FILLED`.
* **Auto-Healing:** If an order remains in `EXECUTING` for >3 seconds (e.g. due to server restart or transient error), `ExecutionEngine.ts` auto-heals and completes the execution against live market ticks.
* **Positions Table:** An order is only added to `positions` once atomically transitioned to `FILLED` in `PortfolioService.recordExecutionInTransaction`.

---

## 3. Standard Git & Build Workflow

Before making changes and committing:
1. Run `npm run build` from project root (builds both server `tsc -p server/tsconfig.json` and client `cd client && npm run build`).
2. Ensure TypeScript compiles with zero errors.
3. Commit with semantic messages (e.g. `fix(market-data): ...`, `perf(option-chain): ...`).
4. Keep Docker containers healthy and online.
