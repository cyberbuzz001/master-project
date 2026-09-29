# TradeGrow Unified Platform — Target Monorepo Folder Structure Blueprint

**Document Reference**: `docs/architecture/03_FOLDER_STRUCTURE_BLUEPRINT.md`  
**Status**: APPROVED BASELINE (Phase 0)  

---

## 1. Monorepo Organization Philosophy

The TradeGrow platform will adopt a **Turborepo + pnpm workspaces** architecture to manage multiple user-facing web applications, backend services, and shared libraries while preserving distinct deployment cadences and team ownership.

```
tradegrow-platform/
│
├── .github/                         # Unified CI/CD GitHub Actions Workflows
│   ├── workflows/
│   │   ├── ci-lint-and-test.yml     # Lints, type checks, unit tests across all workspaces
│   │   ├── audit-compliance.yml     # Automated prohibited claim scanner & a11y linter
│   │   └── deploy-production.yml    # Continuous delivery to VPS / Cloud Run / CDN
│
├── apps/                            # User-Facing Frontend Applications
│   ├── web-trust/                   # [Migrated from 'Tradegrow website']
│   │   ├── site/                    # Static content, compliance configs (site.config.json)
│   │   ├── build/                   # Zero-dependency Node SSG & claim linters
│   │   └── dist/                    # Static build output for Cloudflare / Edge CDN
│   │
│   ├── trading-terminal/            # [Migrated from 'Tradegrow/client']
│   │   ├── src/                     # React 19 + Vite 6 + TypeScript trading terminal
│   │   │   ├── components/          # GrowwTerminalView, OptionChain, OrdersPositions
│   │   │   ├── context/             # MarketDataSocketContext, AuthContext, OrderContext
│   │   │   └── hooks/               # useTicker, usePortfolio, useGreeks
│   │   └── package.json
│   │
│   └── advisory-portal/             # [Migrated from 'Expert advisory/frontend']
│       ├── src/                     # Next.js 15 App Router (React 19)
│       │   ├── app/(site)/          # SEBI Advisory landing & education pages
│       │   ├── app/(auth)/          # Authentication & TOTP enrolment
│       │   ├── app/(app)/           # Client Portal (Research feed, Risk profiler, Billing)
│       │   └── components/          # ResearchCard, GrievanceTracker, InvoiceTable
│       └── package.json
│
├── services/                        # Backend Microservices & API Gateways
│   ├── broker-service/              # [Migrated from 'Tradegrow/server']
│   │   ├── src/
│   │   │   ├── marketData/          # DhanAdapter, AngelOneAdapter, FyersAdapter, Normalizer
│   │   │   ├── trading/             # OMS, RMS, ExecutionEngine, VirtualWalletLedger
│   │   │   ├── websocket/           # Multi-room client tick broadcaster with backpressure
│   │   │   ├── db/                  # TimescaleDB connection pool & 35+ migrations
│   │   │   └── routes/              # Express REST API (/api/v1/trading, /api/v1/auth)
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── advisory-service/            # [Migrated from 'Expert advisory/backend']
│   │   ├── app/
│   │   │   ├── Domain/              # Research, Compliance, Billing, CRM, Workforce
│   │   │   ├── Filament/            # Filament 3 Admin & Operations Panel
│   │   │   ├── Http/Controllers/    # Laravel API controllers (/api/v1/advisory, /api/v1/crm)
│   │   │   └── Models/              # 73 domain models with regulatory audit hooks
│   │   ├── routes/api.php
│   │   ├── Dockerfile
│   │   └── composer.json
│   │
│   └── quant-engine/                # [Migrated from 'Tradegrow/python_engine']
│       ├── app/
│       │   ├── main.py              # FastAPI high-performance microservice (Port 8000)
│       │   ├── greeks.py            # py_vollib vectorized Black-Scholes calculations
│       │   └── iv_surface.py        # Implied volatility surface interpolation
│       ├── requirements.txt
│       └── Dockerfile
│
├── packages/                        # Shared Internal Libraries & Tooling
│   ├── shared-types/                # TypeScript Interfaces, Enums, DTOs & Validation Schemas
│   │   ├── src/
│   │   │   ├── orders.ts            # OrderSide, OrderType, ProductType, OrderStatus
│   │   │   ├── marketData.ts        # MarketTick, OptionStrike, GreeksPayload
│   │   │   ├── advisory.ts          # RecommendationStatus, RiskSuitabilityCategory
│   │   │   └── crm.ts               # LeadStage, DispositionType, AttributionMetadata
│   │   └── package.json
│   │
│   ├── design-tokens/               # Universal UI Tokens (CSS Variables, Tailwind Preset)
│   │   ├── tokens.json              # Colors (emerald/slate/violet), font scales, elevation
│   │   └── tailwind.preset.js       # Shared Tailwind preset across terminal & advisory
│   │
│   └── compliance-rules/            # Shared Regulatory Linter & Validation Helpers
│       ├── src/
│       │   ├── claimChecker.ts      # Automated detection of prohibited phrases
│       │   └── sebiDisclosures.ts   # Mandatory statutory disclaimer footers
│       └── package.json
│
├── docs/                            # Unified Platform Architecture & Governance Docs
│   ├── architecture/                # System architecture, C4 diagrams, integrations
│   ├── database/                    # Schema DDL, ERD diagrams, migration plans
│   ├── api/                         # OpenAPI specs, REST & WebSocket contracts
│   ├── adr/                         # Architecture Decision Records
│   ├── security/                    # RBAC matrices, SEBI Chinese Wall policies
│   ├── deployment/                  # Docker Compose, Nginx reverse proxy configs
│   ├── testing/                     # Test strategy, performance benchmarks
│   ├── PHASE_0_AUDIT_REPORT.md      # Baseline audit of existing 3 codebases
│   └── IMPLEMENTATION_ROADMAP.md    # Multi-phase execution schedule (Phases 0-7)
│
├── docker-compose.yml               # Unified local & production multi-container setup
├── docker-compose.production.yml    # Hardened production deployment setup
├── pnpm-workspace.yaml              # Workspace definition
├── turbo.json                       # Turborepo task pipeline configuration
└── .gitignore                       # Universal security & build artifact exclusions
```

---

## 2. Workspace Mapping & Migration Plan

| Current Directory | Target Monorepo Path | Role in Unified Platform |
| :--- | :--- | :--- |
| `Tradegrow website` | `apps/web-trust/` | Public trust, education, fee transparency, SEO, lead funnels |
| `Tradegrow/client` | `apps/trading-terminal/` | High-frequency trading terminal, real-time charts & option chains |
| `Expert advisory/frontend` | `apps/advisory-portal/` | SEBI research analyst advisory portal, client onboarding, billing |
| `Tradegrow/server` | `services/broker-service/` | Brokerage execution engine, OMS, RMS, TimescaleDB, Dhan feed |
| `Expert advisory/backend` | `services/advisory-service/` | SEBI governance, dual-signature approvals, CRM, Filament admin |
| `Tradegrow/python_engine` | `services/quant-engine/` | FastAPI options pricing, Black-Scholes Greeks engine |

*Note*: During **Phase 0**, existing directories remain in their current physical paths while architectural specifications are certified. Physical relocation into `apps/` and `services/` will take place during **Phase 1 (Foundation)** following user approval.

---
*Folder structure blueprint certified and saved to [03_FOLDER_STRUCTURE_BLUEPRINT.md](file:///d:/2026%20C%20downloads/tradegrow%20app/docs/architecture/03_FOLDER_STRUCTURE_BLUEPRINT.md).*
