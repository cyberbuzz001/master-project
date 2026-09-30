# Frontend-Backend Integration Audit

## Executive Summary
This document performs a complete audit of the StockSharp FinTech Platform frontend components, design HTML assets (`/Frontend`), backend API services, database schema (PostgreSQL), and real-time WebSocket infrastructure.

---

## 1. Frontend Architecture Audit
- **Client App (`/client`)**: React 19 + Vite + TailwindCSS + Lucide Icons + TradingView Lightweight Charts v4.
- **Frontend Designs (`/Frontend`)**: 72 design mockups / HTML templates covering Client Panel, Admin Suite, Dealer Terminal, RMS Dashboard, OMS Monitor, Back Office, CRM, KYC Queue, and Compliance Center.
- **State Management**: Local React state, custom WebSocket event hooks, API clients.
- **Routing & Tabs**: Multi-tab navigation bar (`Trading Terminal`, `Option Chain`, `Strategy Builder`, `Level-2 Depth`, `Portfolio & Risk`, `Market Scanner`, `Admin Control`).

---

## 2. Backend Architecture Audit
- **Engine**: Node.js + Express + TypeScript.
- **Database**: PostgreSQL 16 (`pg-pool` with max 20 connections) with schema migrations (`001_initial_schema.sql`, `002_watchlists_audit_sessions.sql`).
- **Caching & Event Bus**: Redis 7 (`ioredis`) for tick caching, historical candle caching, and WebSocket Pub/Sub fan-out (`market:ticks`).
- **Trading Engine**: `OMS` (Order Management System), `RMS` (Risk Management System), `ExecutionEngine` (Simulated Order Matching Loop), `VirtualWalletLedger` (Atomic Double-Entry Ledger with `SELECT FOR UPDATE` locks).
- **Market Data Engine**: `MarketDataEngine` with `AlphaVantageAdapter` (Primary), `AngelOneAdapter`, `IndianStockMarketApiAdapter`, and `MockMarketDataProvider` fallback.

---

## 3. Existing vs Missing API Endpoints Matrix

| Subsystem | Existing API Endpoints | Missing / Required Endpoints |
|---|---|---|
| **Authentication** | `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `GET /api/v1/auth/me` | `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`, `POST /api/v1/auth/totp/setup` |
| **Market Data** | `GET /api/v1/market/ticks`, `GET /api/v1/market/candles`, `GET /api/v1/market/option-chain` | `GET /api/v1/market/depth/:symbol`, `GET /api/v1/market/mover-summary` |
| **Orders & Trades** | `POST /api/v1/orders`, `GET /api/v1/orders`, `DELETE /api/v1/orders/:id` | `POST /api/v1/orders/multileg`, `POST /api/v1/orders/preview` |
| **Portfolio & Funds**| `GET /api/v1/positions`, `GET /api/v1/holdings`, `GET /api/v1/funds/balance` | `POST /api/v1/funds/add`, `POST /api/v1/funds/withdraw` |
| **Admin & RMS** | `POST /api/v1/admin/users/:id/status`, `POST /api/v1/admin/users/:id/role`, `POST /api/v1/admin/adjust-balance`, `POST /api/v1/admin/risk-settings` | `GET /api/v1/admin/crm/leads`, `GET /api/v1/admin/kyc/queue`, `GET /api/v1/admin/surveillance/alerts` |

---

## 4. WebSocket Streaming Audit
- **Gateway**: `/ws` on Port 5000.
- **Events Implemented**: `TICK_SNAPSHOT`, `MARKET_TICK`, `ORDER_UPDATE`, `TRADE_EXECUTION`.
- **Pub/Sub Channel**: `market:ticks` (Redis Pub/Sub).

---

## 5. Security & Risk Audit
- **Password Hashing**: Argon2id (`argon2`).
- **JWT Signing**: Strict 32+ character secrets (`JWT_SECRET`).
- **IDOR Protection**: Watchlist & user resource ownership checks.
- **Safety Lock**: `REAL_MONEY_TRADING=false` hardlock enforced across `SafetyLock.ts`.
