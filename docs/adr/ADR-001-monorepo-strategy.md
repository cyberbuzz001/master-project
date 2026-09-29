# ADR-001: Monorepo Orchestration Strategy using Turborepo & pnpm

**Status**: ACCEPTED  
**Date**: September 2026  
**Deciders**: Lead FinTech Systems Architect, Engineering Core  

---

## Context
TradeGrow operates three distinct systems:
1. `Tradegrow website`: Zero-dependency static marketing and trust portal.
2. `Tradegrow`: High-frequency React 19 trading terminal and Node.js/TypeScript broker server.
3. `Expert advisory`: Next.js 15 client portal and Laravel 11 / Filament advisory and CRM backend.

Maintaining these across separate disconnected Git repositories creates version drift in domain models, duplicate types, decoupled deployments, and coordination friction for end-to-end features (such as 1-click advisory execution and CRM lead attribution).

## Decision
We adopt a **unified Monorepo** managed with **pnpm workspaces** and **Turborepo**:
* `apps/web-trust`: Static marketing and trust site.
* `apps/trading-terminal`: React 19 trading terminal SPA.
* `apps/advisory-portal`: Next.js 15 SEBI client advisory portal.
* `services/broker-service`: Node.js/TypeScript OMS, RMS, and market data feed.
* `services/advisory-service`: Laravel 11 SEBI governance, back-office, and CRM.
* `services/quant-engine`: Python FastAPI options math engine.
* `packages/shared-types`: Shared TypeScript definitions and DTO contracts.
* `packages/design-tokens`: Shared Tailwind styling tokens.

## Consequences
### Positive
* Single source of truth for version control, shared type contracts, and documentation.
* Atomic cross-application pull requests and unified CI/CD pipelines.
* Drastically reduced latency in delivering cross-application features.

### Negative
* Requires workspace orchestration tooling (Turborepo, pnpm).
* Polyglot environment (TypeScript, PHP, Python) requires distinct Dockerfiles and build steps.
