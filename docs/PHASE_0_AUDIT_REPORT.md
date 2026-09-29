# TradeGrow Unified Platform — Phase 0 Codebase Audit Report

**Date**: September 2026  
**Auditor**: Lead Enterprise & FinTech Systems Architect  
**Scope**: In-depth audit of 3 independent codebases earmarked for convergence into a single, cohesive Indian FinTech Ecosystem.

---

## 1. Executive Summary

The target ecosystem combines three specialized software applications currently developed independently in `d:\2026 C downloads\tradegrow app`:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           TRADEGROW UNIFIED ECOSYSTEM                           │
├──────────────────────────┬──────────────────────────┬───────────────────────────┤
│    Tradegrow website     │        Tradegrow         │      Expert advisory      │
│   (Trust & Acquisition)  │     (Trading Broker)     │   (SEBI Stock Advisory)   │
├──────────────────────────┼──────────────────────────┼───────────────────────────┤
│ • Zero-dep Node SSG      │ • Node.js / Express 4.21 │ • Laravel 11 / PHP 8.2+   │
│ • Prohibited-claim lint  │ • React 19 Trading SPA   │ • Next.js 15 App Router   │
│ • SEBI Charters & a11y   │ • TimescaleDB & Redis 7  │ • Filament 3 Back-office  │
│ • Lead capture funnels   │ • Python FastAPI Greeks  │ • 73 SEBI/CRM Data Models │
│ • Acquisition calculator │ • Real-time OMS & RMS    │ • Client Portal & Billing │
└──────────────────────────┴──────────────────────────┴───────────────────────────┘
```

The three components represent complementary stages of the Indian retail investor lifecycle:
1. **Acquisition & Trust (`Tradegrow website`)**: Attracts organic search and campaign traffic, delivers regulatory transparency (SEBI charters, pricing breakdowns, fee comparison), and captures high-intent leads.
2. **Trading Terminal & Execution (`Tradegrow`)**: Provides the Demat/trading account, live streaming market data (NSE/BSE/MCX), options chain with Greeks, order execution, margin accounting, and risk management.
3. **Research Desk & Advisory (`Expert advisory`)**: Provides SEBI-regulated Research Analyst (RA) recommendations, suitability assessments, risk profiling, client subscription billing, CRM telephony, grievance redressal, and performance tracking.

By architecturally unifying these platforms, TradeGrow eliminates customer acquisition friction, enables **1-Click Advisory Order Execution** inside the trading terminal, establishes a unified customer identity, and provides an end-to-end SEBI compliance audit trail.

---

## 2. In-Depth Project Audits

### 2.1 Project 1: `Tradegrow` (Demat Account & Trading Brokerage System)

* **Repository Location**: `D:\2026 C downloads\tradegrow app\Tradegrow`
* **Core Technology Stack**:
  - **Runtime**: Node.js 22 (ESM/TypeScript 5.x)
  - **Web Framework**: Express 4.21 + WebSockets (`ws` 8.18)
  - **Frontend Client**: React 19 Single Page Application (Vite 6, TypeScript, Tailwind CSS, Lucide icons, TradingView Lightweight Charts 4.2)
  - **Persistence**: PostgreSQL 16 with TimescaleDB hypertable extensions (market candles & order events)
  - **Caching / In-Memory State**: Redis 7 (`ioredis`) for tick caching, pub/sub, and lock management
  - **Quantitative Engine**: Python 3.11+ / FastAPI (`tradegrow_python_engine`) running `py_vollib` for Black-Scholes Greeks, Implied Volatility (IV), and theoretical pricing.

#### Architecture Highlights
1. **Double-Entry Financial Ledger**:
   - Implemented in `server/src/trading/VirtualWalletLedger.ts`.
   - Utilizes strict `SELECT ... FOR UPDATE` row-level locks on `virtual_wallets`.
   - Atomic state transitions: `MARGIN_BLOCK` on order placement, `MARGIN_RELEASE` on cancellation/rejection, `TRADE_SETTLE` on fill with brokerage fee deduction.
   - Zero tolerance for floating point balance errors: maintains precision balances and audit records.
2. **Order Management System (OMS) & Pre-Trade RMS**:
   - `server/src/trading/OMS.ts` and `server/src/trading/RMS.ts`.
   - Pre-trade validation: checks instrument trade status, user KYC status (`ACTIVE`), contract expiry, user buying power, circuit breakers, and order rate limits.
   - Idempotency key protection on order submission endpoints (`POST /api/v1/orders`).
   - `RmsLossMonitor.ts` and `RmsAutoSquareOffEngine.ts`: Automated intraday position liquidation upon reaching maximum loss thresholds or market close cut-off times.
3. **Market Data Architecture**:
   - Pluggable provider pattern (`IMarketDataProvider.ts`).
   - Active adapters: `DhanAdapter.ts` (binary/JSON WebSocket v2 with automated TOTP session renewal), `AngelOneAdapter.ts`, `FyersAdapter.ts`, and fallback `MockMarketDataProvider.ts`.
   - In-memory tick cache + Redis stream publication + WebSocket broadcast to subscribed clients with backpressure monitoring (`bufferedAmount > 1MB`).
   - `InstrumentMasterService.ts` synchronizes canonical NSE/BSE security masters with pg_trgm fuzzy search index.
4. **Client Experience**:
   - `GrowwTerminalView.tsx`, `GrowwWatchlistView.tsx`, `OrdersPositionsView.tsx`, `OptionChainView.tsx`, `OptionStrategyBuilder.tsx`.
   - Exceptional responsiveness, multi-watchlist tabs, index tickers (NIFTY, BANKNIFTY, SENSEX), depth ladders, and TradingView charting.

#### Key Gaps & Technical Debt
* **Monolithic Route Handlers**: `server/src/routes/adminApi.ts` is 186 KB and `api.ts` is 130 KB. These files combine business logic, validation, direct SQL queries, and error handling in single files, requiring decomposition into domain-driven service controllers.
* **In-Process Matching Polling**: `ExecutionEngine.ts` runs a 500ms `setInterval` database query (`SELECT * FROM orders WHERE status IN ('ACCEPTED', 'PENDING') LIMIT 50`). While functional for simulation, under production scale this creates unnecessary DB I/O. Transition to an event-driven queue (Redis Streams or RabbitMQ) is essential.
* **Single Node.js Process Bottleneck**: Express REST, WebSocket gateway, Market Data ingest, and RMS loss monitoring run in one Node.js process. CPU-intensive operations (e.g. JSON serialization of massive option chains) can delay tick dispatch.

---

### 2.2 Project 2: `Expert advisory` (SEBI Research Analyst & CRM Platform)

* **Repository Location**: `D:\2026 C downloads\tradegrow app\Expert advisory`
* **Core Technology Stack**:
  - **Backend**: PHP 8.2+, Laravel 11.x, Laravel Filament 3.x Admin Panel, Laravel Sanctum authentication.
  - **Frontend**: Next.js 15 (React 19, TypeScript, Tailwind CSS, App Router).
  - **Persistence**: SQLite (development) / MySQL / PostgreSQL (production).
  - **Queues / Storage**: Redis queues, S3-compatible document storage for signed client agreements and PDFs.

#### Architecture Highlights
1. **SEBI Regulatory Compliance & Governance**:
   - Strict adherence to SEBI (Research Analysts) Regulations, 2014 and SEBI (Investment Advisers) Regulations.
   - `RegulatoryProfileVersion`: Versioned tracking of SEBI registration numbers, compliance officers, grievance redressal escalations, and official disclosures.
   - **Dual-Signature Research Approval Workflow**: Research analysts draft recommendations (`ResearchReport`, `ResearchRecommendation`), which must be digitally approved by an Authorized Research Head (`ResearchApproval`) before distribution.
   - Comprehensive risk profiling engine (`RiskQuestionnaire`, `RiskQuestionnaireVersion`, `RiskProfile`, `RiskOverride`, `RiskAnswer`), ensuring statutory suitability assessment before subscription purchase.
2. **Back-Office & Operations Management**:
   - Complete HR & workforce tracking (`Employee`, `Team`, `AttendanceDay`, `TrainingModule`, `TrainingAcknowledgement`).
   - Full-featured CRM for telecalling and lead management (`Lead`, `LeadActivity`, `LeadAssignment`, `LeadAttribution`, `Campaign`, `ObjectionScript`, `Followup`, `CallLog`, `MessageLog`).
   - Billing & GST Invoicing (`Plan`, `PlanVersion`, `Subscription`, `Invoice`, `InvoiceItem`, `Payment`, `PaymentAllocation`, `Receipt`).
3. **Client Portal (`(app)` routes in Next.js)**:
   - Onboarding wizard with digital agreement acceptance (`AgreementVersion`, `AgreementAcceptance`), document uploads, and risk profiling.
   - Live research feed, grievance ticketing system with SEBI SCORES integration links.

#### Key Gaps & Technical Debt
* **Disparate Tech Stack**: PHP/Laravel alongside Node.js/TypeScript introduces cognitive overhead and infrastructure dual-hosting (PHP-FPM/Nginx vs Node runtime).
* **Isolated User Store**: User accounts in `Expert advisory` have no direct linkage with Demat trading accounts in `Tradegrow`. Clients currently have to create two separate accounts and log in twice.
* **Static SQLite Development Default**: The project currently uses SQLite for local testing, whereas `Tradegrow` uses PostgreSQL with TimescaleDB extensions.

---

### 2.3 Project 3: `Tradegrow website` (Trust & Acquisition Engine)

* **Repository Location**: `D:\2026 C downloads\tradegrow app\Tradegrow website`
* **Core Technology Stack**:
  - **Generator**: Custom zero-dependency Node.js Static Site Generator (`build/build.js`).
  - **Output**: Pure static HTML/CSS/JS (`dist/`) suitable for instant CDN delivery (Cloudflare, Vercel, S3/CloudFront, Hostinger).
  - **Testing & Verification**: Automated prohibited-claim linter, link validator (`build/check-links.js`), structural accessibility checker (`build/check-a11y.js`), Lighthouse CI.

#### Architecture Highlights
1. **Verification-First Compliance Engine**:
   - Configuration files in `site/config/*.json` serve as the Single Source of Truth (`site.config.json`, `charges.config.json`, `faq.json`, `compare.json`).
   - Any missing or unverified regulatory value renders as an amber *"Information to be verified"* badge; prevents phantom or misleading claims.
   - Prohibited claim detector aborts the build if phrases like `"guaranteed returns"`, `"100% safe"`, `"zero tax"`, or `"multibagger"` are detected without negation.
2. **Transparent Fee & Regulatory Breakdowns**:
   - Explicitly distinguishes TradeGrow brokerage (e.g. ₹0 or flat ₹20) from statutory government levies (STT, GST, Stamp Duty, SEBI turnover fees).
   - Investor Charter, Grievance Escalation Matrix, and PMLA policies rendered according to SEBI circular specifications.
3. **Zero Performance Overhead**:
   - Achieves 100/100 Lighthouse performance scores, WCAG AA contrast compliance, and instant page loads without hydration lag.

#### Key Gaps & Technical Debt
* **Detached Forms**: Public lead capture forms (`open-account.html`, modal lead forms) currently submit to local stubs or lack live webhook dispatch to the CRM pipeline.
* **No Direct SSO Hand-off**: Opening an account from the marketing site requires manual navigation to the trading terminal rather than seamless deep linking with attribution metadata preserved.

---

## 3. Cross-Cutting Analysis: Synergies, Overlaps & Conflicts

| Domain Dimension | Tradegrow website | Tradegrow Broker | Expert advisory | Unified Convergence Path |
| :--- | :--- | :--- | :--- | :--- |
| **Primary Audience** | Prospective traders, search visitors | Active retail & F&O traders | Advisory subscribers, research team | Single unified customer journey |
| **User Identity** | Anonymous leads | `users` (PostgreSQL) | `users` (MySQL/SQLite) | Unified OAuth2/OIDC Auth Gateway |
| **Compliance Focus** | SEBI advertising code, disclosure | Brokerage regulations, pre-trade RMS | SEBI RA Regulations 2014, Suitability | Consolidated Compliance Hub |
| **Lead / CRM Data** | Static lead intake | Internal KYC & Didit verifications | 15+ Lead & Campaign tables | Unified CRM Pipeline (Phase 2) |
| **Market Symbology** | Static ticker references | Dhan/NSE security tokens | Stock recommendation tickers | Canonical Instrument Service |
| **Hosting & Runtime** | Static CDN | Node 22 + Python + TimescaleDB | PHP 8.2 + Next.js 15 | Monorepo / Container Orchestration |

---

## 4. Architectural Readiness for Phases 1 through 7

1. **Phase 1 (Foundation)**: Requires establishing the unified monorepo repository, shared type definitions, single database migration strategy, and unified Auth/SSO gateway.
2. **Phase 2 (CRM + Funnel)**: Integrates `Tradegrow website` lead captures into the rich `Expert advisory` CRM backend with automated lead deduplication, agent assignment, and status workflows.
3. **Phase 3 (Attribution + Campaigns)**: Wires UTM and referral query parameters from `Tradegrow website` through to Demat account creation and Advisory subscription conversion.
4. **Phase 4 (Referral + Creators)**: Bridges referral codes between advisory subscribers and brokerage active traders, providing unified creator revenue sharing and tracking.
5. **Phase 5 (WhatsApp + Automation)**: Connects broker execution notifications and advisory recommendation alerts through a unified multi-channel messaging service.
6. **Phase 6 (Analytics + War Room)**: Consolidates marketing acquisition metrics, trading desk volume/margin stats, and research advisory performance into an executive dashboard.
7. **Phase 7 (Testing + Production)**: Hardens end-to-end security, executes load tests on market data/order execution pipelines, validates WCAG AA accessibility, and deploys to production infrastructure.

---
*Report certified and saved to [PHASE_0_AUDIT_REPORT.md](file:///d:/2026%20C%20downloads/tradegrow%20app/docs/PHASE_0_AUDIT_REPORT.md).*
