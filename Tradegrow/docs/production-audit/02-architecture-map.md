# 02 — Architecture Map

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│  STOCKSHARP — MULTI-USER PAPER TRADING PLATFORM                        │
│  Architecture Version: 1.0 (Production-Ready Build)                    │
│  Audit Date: 2026-08-10                                                 │
└─────────────────────────────────────────────────────────────────────────┘

USER BROWSER (Desktop + Mobile)
│
├── React 19 SPA (client/src/)                              PORT 5173 (dev)
│   ├── Framework: React 19, Vite 6, TypeScript 5.7
│   ├── UI: TailwindCSS 3.4, Lucide-React icons
│   ├── Charts: lightweight-charts 4.2
│   ├── State: useState/useContext (no Redux/Zustand)
│   └── HTTP: Native fetch()  │  WebSocket: Native WebSocket API
│
├── WebSocket ──────────────────────────────── ws://localhost:5000/ws
│   └── JWT auth via query param (?token=...)
│
└── REST API ───────────────────────────────── http://localhost:5000/api/v1

NODE.JS BACKEND (server/src/)                              PORT 5000
│
├── Express 4.21 HTTP Server
│   ├── Helmet.js security headers
│   ├── CORS restricted to allowedOrigins
│   ├── Rate limiting (auth: 50/15min, orders: 30/min, API: 2000/15min)
│   ├── JWT Bearer token authentication (Argon2id passwords)
│   └── Zod request validation
│
├── REST Routes
│   ├── /api/v1/* → api.ts (main routes)
│   └── /api/v1/admin/* → adminApi.ts (admin routes)
│
├── WebSocket Gateway (/ws)
│   └── server.ts — tick fan-out to subscribed clients
│
├── Market Data Engine
│   ├── DhanAdapter (PRIMARY — live WebSocket)
│   ├── AngelOneAdapter (SECONDARY)
│   ├── TrueDataAdapter (WS replay mode)
│   ├── AlphaVantageAdapter (historical candles)
│   ├── IndianStockMarketApiAdapter (indices)
│   └── MockMarketDataProvider (24/7 fallback, off-market hours)
│
├── Trading Engine (virtual/simulated only — SafetyLock)
│   ├── OMS (Order Management System)
│   ├── RMS (Risk Management System)
│   ├── ExecutionEngine (simulated fills)
│   ├── PortfolioService (positions/holdings)
│   └── VirtualWalletLedger (wallet + ledger)
│
├── Services
│   ├── MarginEngineService (SPAN margin calc)
│   ├── ExpiryCalendarService (weekly/monthly expiry)
│   ├── FnOStockService (F&O top stocks)
│   ├── MarketDataStorageService (local candles)
│   ├── ReconciliationMonitorService (60s interval)
│   ├── AccuracyCheckService (60s interval)
│   └── SafetyLock (hardcoded real-money=false)
│
├── Database Layer
│   ├── PostgreSQL (pg pool, max 20 connections)
│   └── Migrations (8 SQL files, auto-applied on startup)
│
└── Cache/PubSub Layer
    └── Redis (ioredis, in-memory fallback if unavailable)
        ├── tick:{token} — 3600s TTL
        └── channel: market:ticks (pub/sub fan-out)

PYTHON ENGINE (python_engine/)                            PORT 8000
│
└── FastAPI
    ├── /api/v1/greeks/calculate — Black-Scholes + py_vollib
    ├── /health — health check
    └── /ws — echo WebSocket (stub, unused in production)

INFRASTRUCTURE
│
├── PostgreSQL 16 (TimescaleDB) — pg_data volume
├── Redis 7 Alpine — redis_data volume
└── Docker Compose — single network (trading-net)
```

---

## Technology Stack Summary

| Layer | Technology | Version | Status |
|-------|-----------|---------|--------|
| Frontend Framework | React | 19.0.0 | ACTIVE |
| Build Tool | Vite | 6.0.11 | ACTIVE |
| Frontend Language | TypeScript | 5.7.3 | ACTIVE |
| CSS Framework | TailwindCSS | 3.4.17 | ACTIVE |
| Charts | lightweight-charts | 4.2.2 | ACTIVE |
| Icons | lucide-react | 0.474.0 | ACTIVE |
| Backend Runtime | Node.js | 22 (Alpine) | ACTIVE |
| Backend Framework | Express | 4.21.2 | ACTIVE |
| Backend Language | TypeScript | 5.7.3 | ACTIVE |
| WebSocket | ws | 8.18.0 | ACTIVE |
| Authentication | JWT + Argon2id | jwt@9/argon2@0.45 | ACTIVE |
| Database | PostgreSQL | 16 (TimescaleDB) | ACTIVE |
| ORM/Query | pg (raw SQL) | 8.22.0 | ACTIVE |
| Migrations | Custom SQL runner | manual | ACTIVE |
| Cache | Redis | 7 Alpine | ACTIVE |
| Redis Client | ioredis | 6.0.0 | ACTIVE |
| Validation | Zod | 4.4.3 | ACTIVE |
| Security | Helmet.js | 8.3.0 | ACTIVE |
| Rate Limiting | express-rate-limit | 8.6.1 | ACTIVE |
| Logging | pino + pino-http | 10.3.1 | ACTIVE |
| Python Backend | FastAPI + uvicorn | latest | PARTIAL |
| Python Options | py_vollib / fallback | 3.11+ | PARTIAL |
| Containerization | Docker + Compose | latest | DEPLOYMENT |

---

## Deployment Topology

```
Internet
    │
    ├── NGINX Reverse Proxy (recommended — not yet configured)
    │
    └── Docker Network (trading-net)
        ├── brokerage-platform:5000  ← Node.js app
        ├── python-engine:8000       ← FastAPI
        ├── postgres:5432            ← TimescaleDB
        └── redis:6379               ← Redis cache
```
