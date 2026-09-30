# Brokerage Database v1.0 — Production Migration Bundle

Production-oriented PostgreSQL + Prisma foundation for a brokerage platform covering:
Client Panel, Admin/Back Office, OMS, RMS, Broker Gateway, Portfolio, Ledger, Payments,
Settlement, Reconciliation, Notifications, Audit, and Integration Outbox.

## Stack
- PostgreSQL 16
- Prisma ORM
- Node.js / TypeScript
- NestJS database module
- Jest integration/invariant tests
- Docker Compose
- GitHub Actions CI

## Quick start

```bash
cp .env.example .env
docker compose up -d postgres
npm install
npm run db:migrate
npm run db:seed
npm test
npm run db:validate
```

## Safety
This repository is a database foundation, not a certification of regulatory compliance.
Before production use, validate accounting, exchange settlement, KYC/AML, privacy,
cybersecurity, retention, and broker/exchange requirements with qualified professionals.

## Migration policy
Migrations are append-only. Never edit an applied migration. Create a new migration.
Financial records are append-only and corrected by compensating/reversal transactions.

## Database-first build gate
See `prompts/antigravity-database-build-prompt.md`.
