# TradeGrow / StockSharp — Developer & AI Agent Guidelines (AGENTS.md)

This document contains critical architectural rules, conventions, and guardrails for all AI coding agents working on the TradeGrow codebase.

---

## 1. System Architecture & Technology Stack
* **Backend:** Node.js / TypeScript (Express, native `ws` WebSockets, PostgreSQL via `pg`, Redis via `ioredis`).
* **Frontend:** React + TypeScript (Vite, TailwindCSS, Lucide icons).
* **Database:** PostgreSQL 16 + TimescaleDB extension.
* **Cache & Pub/Sub:** Redis 7 (channel: `market:ticks`).
* **Python Engine:** Python 3.11+ FastAPI for option Greeks (`py_vollib`).
* **Live Deployment:** `https://tradegrowx.in` hosted on Hostinger VPS (Docker Compose project: `tradegrow`).

---

## 2. Mandatory Rules & Guardrails

### A. Market Data Authority
* **Sole Provider:** Dhan HQ API v2 (`DhanAdapter.ts`) is the primary real-time market data source.
* **Disabled Providers:** Fyers is disabled. Do not activate or mix synthetic/Fyers tick generators.

### B. No Synthetic Ticks on Live WebSocket Stream
* Never inject simulated/Black-Scholes ticks into `MarketDataEngine.broadcastTick` or WebSocket clients.
* Real binary ticks from Dhan WebSocket are mapped to canonical tokens (`BFO_SENSEX_77300_CE`, `NFO_NIFTY_24300_PE`) and broadcast directly.

### C. BSE Derivatives & Symbology Rules
* BSE options and futures use segment prefix `BFO` (`BSE_FNO`).
* In `InstrumentMasterService.ts`, Dhan CSV instruments with `BSXOPT`/`BSXFUT` map to `SENSEX`, and `BKXOPT`/`BKXFUT` map to `BANKEX`.

### D. Option Chain Centering & Expiry Modeling
* `OptionChainEngine.ts` must center strike matrices around Dhan's real-time spot price (`spotPrice`), calculating `atmStrike = Math.round(spotPrice / step) * step`.
* On 0DTE expiry days, calculate fractional intraday time to expiry (`diffMs / (1000 * 60 * 60 * 24)`), never clamp to 3.5 days.
* In-flight promise caching (2 seconds) in `OptionChainEngine.ts` prevents external rate limits and keeps response times <300ms.

### E. Callback Leak & Redis Protection
* In `MarketDataEngine.subscribe(tokens)`: Never add duplicate broadcaster callbacks to `DhanAdapter.callbacks` on client subscription. Accumulating callbacks overflows Redis buffers and freezes Node.js.

### F. Order Execution & Position Creation
* `ExecutionEngine.ts` processes orders every 500ms against real live ticks.
* Stuck `EXECUTING` orders (>3 seconds) are auto-healed and executed to `FILLED`.
* Positions are updated atomically in `PortfolioService.recordExecutionInTransaction`.

---

## 3. Build & Quality Verification
* Before committing, always verify with `npm run build`.
* Zero TypeScript compilation errors required.
