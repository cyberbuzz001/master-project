# Production Readiness Audit & Baseline Architecture Report

## 1. Executive Summary
This document establishes the audit baseline for building a **Production-Ready Multi-User Brokerage Simulation & Paper-Trading Platform** in accordance with the master specification.

**CRITICAL BUSINESS MANDATE**: This system operates strictly on **virtual currency / paper trading capital**. No real-money transactions, deposits, withdrawals, or live broker order execution are allowed. Market data providers (such as Angel One API and Indian-Stock-Market-API) are strictly scoped to market data retrieval (LTP, OHLC, Quotes, Option Chains, Instrument Masters). Technical safeguards are enforced to prevent real-money execution paths.

---

## 2. Workspace & Environment Audit

| Component | Status / Version | Notes |
| :--- | :--- | :--- |
| Workspace Path | `d:\2026 C downloads\Stocksharp` | Greenfield directory setup |
| Node.js Runtime | `v22.17.0` | Active backend & SSR / frontend engine |
| Package Manager | `npm 11.11.0` | Active dependency manager |
| Git | `2.53.0` | Active version control |
| Python | `3.13.12` | Available for auxiliary data tools |
| .NET SDK | Not installed | StockSharp reference library will be integrated via pure REST/WebSocket adapter architecture in JS/TS |

---

## 3. Reference Repositories Analysis

### 3.1 StockSharp Architecture Reference
- **Source**: `https://github.com/stocksharp/stocksharp`
- **Utility**: Reference architectural design for OMS, RMS, order state transitions, strategy pipelines, and market data normalization.
- **License & Scope**: Standard open platform patterns. Used for architectural reference only; execution engine implemented natively in TypeScript/Node.js to ensure zero real-money order leakage.

### 3.2 Indian Stock Market API Adapter Reference
- **Source**: `https://github.com/0xramm/Indian-Stock-Market-API`
- **Utility**: Secondary/fallback market data provider for NSE/BSE quotes, historical data, and option chains.
- **Integration**: Wrapped in a resilient `IndianStockMarketApiProvider` adapter with caching, rate limiting, and failover support.

---

## 4. Issues & Technical Debt Risk Audit (P0 - P3)

### P0 — Critical (Security & Core Safety)
1. **Real-Money Safety Lock**: Risk of accidental real-money order routing.
   - *Mitigation*: Hardcode `REAL_MONEY_TRADING = false` server-side kill switch; isolate market data APIs from order APIs.
2. **Multi-User Data Isolation (IDOR)**: Risk of cross-user virtual account or order access.
   - *Mitigation*: Enforce server-side ownership verification on all `/api/v1/*` database queries (`user_id` constraint).
3. **Financial Concurrency & Race Conditions**: Risk of double spending virtual balance or negative balance during high-frequency simulated order placement.
   - *Mitigation*: Implement ACID database transactions with double-entry virtual ledger for all balance mutations.

### P1 — High (Core Trading Engine & Market Data)
1. **Market Data Failover**: Disruption of real-time feeds during API downtime.
   - *Mitigation*: Multi-provider failover engine (`Angel One` → `Indian Stock Market API` → `Mock/Simulated Feed`).
2. **RMS Bypass**: Risk of orders exceeding virtual capital or risk limits.
   - *Mitigation*: Server-side RMS validation layer prior to simulated execution.

### P2 — Medium (UI / UX & Real-Time Performance)
1. **WebSocket Network Overhead**: High tick rate flooding client web sockets.
   - *Mitigation*: Server-side tick throttling, subscription-based room filtering, and delta compression.
2. **RBAC Control Gaps**: Inadequate role enforcement for administrative operations.
   - *Mitigation*: Comprehensive RBAC middleware with permission matrix enforcement.

### P3 — Low (Tooling & Minor Features)
1. **Scanner & Alert Overhead**: Polling overload for technical alerts.
   - *Mitigation*: Event-driven background alert evaluation engine using cached ticks.

---

## 5. Target Technology Stack & Architecture Design

- **Backend**: Node.js, Express, TypeScript, WebSockets (`ws`), SQLite/Better-SQLite3 (with Prisma / Knex for migrations and transaction safety).
- **Frontend**: React (Vite) + TypeScript, Modern Dark Financial UI (Glassmorphism, Inter font, green/red PnL indicators, responsive grid), Lightweight Charts / Chart.js for real-time candles.
- **Market Data Layer**: Provider abstraction interface (`IMarketDataProvider`), supporting Angel One API, Indian Stock Market API, and Fallback Mock Provider.
- **Virtual OMS & RMS Engine**: Virtual Order Management & Risk Engine with state transitions (CREATED, RMS_CHECK, PENDING, FILLED, REJECTED, CANCELLED) and full execution simulation modes (LTP, Slippage, Brokerage charges).
- **Virtual Ledger**: Double-entry ledger tracking every virtual cash movement (Opening Balance, Trade Margin, Realized PnL, Unused Margin).

---

## 6. Implementation Roadmap Overview
- **Phase 1**: Audit & Plan Baseline (Completed)
- **Phase 2**: Project Scaffold & DB Schema (Prisma/SQLite, Auth & RBAC)
- **Phase 3**: Market Data Abstraction & Provider Adapters
- **Phase 4**: Real-Time Data Pipeline & WebSockets
- **Phase 5**: Virtual Money Ledger & RMS Module
- **Phase 6**: OMS & Simulated Execution Engine
- **Phase 7**: Trading Terminal UI & Charting
- **Phase 8**: Administrative Panel & Audit Logging
- **Phase 9**: Automated Verification & Security Hardening
