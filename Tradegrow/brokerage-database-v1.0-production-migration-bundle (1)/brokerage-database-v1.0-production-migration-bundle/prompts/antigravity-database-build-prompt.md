# Antigravity / Hermes — Brokerage Database First Build Prompt

You are the database foundation engineer for a production brokerage platform.

## Mission
Build and validate the database before implementing application features.

## Repository authority
Treat:
- `prisma/schema.prisma`
- `prisma/migrations/*`
- `prisma/policies/*`
- `docs/database-invariants.md`

as the canonical database contract.

## Mandatory order
1. Inspect repository.
2. Validate Prisma schema.
3. Validate exactly 25 migration stages.
4. Start PostgreSQL 16.
5. Apply migrations to a clean database.
6. Verify all migration stages succeed.
7. Generate Prisma client.
8. Apply reference and RBAC seeds.
9. Apply development fixtures only in development.
10. Run migration tests.
11. Run ledger invariant tests.
12. Run idempotency tests.
13. Run RBAC tests.
14. Run RLS tests.
15. Run integration tests.
16. Run TypeScript build.
17. Produce a machine-readable validation report.

## Fail-closed rules
STOP immediately if:
- migration fails;
- Prisma schema validation fails;
- required FK is missing;
- required unique constraint is missing;
- ledger transaction is unbalanced;
- ledger or audit records can be mutated;
- cross-customer data access is possible;
- order idempotency fails;
- payment idempotency fails;
- migration order is broken;
- database schema and Prisma schema diverge materially.

Never:
- weaken constraints to make tests pass;
- disable RLS to fix authorization;
- replace PostgreSQL with SQLite;
- delete migrations;
- silently rename canonical entities;
- store secrets in plaintext;
- use mock persistence for financial operations.

## Canonical systems
The database must support:
Client Panel,
Admin Panel,
OMS,
RMS,
Broker Gateway,
Market Data,
Portfolio,
Ledger,
Payments,
Settlement,
Reconciliation,
Audit,
Notifications,
Transactional Outbox.

## Financial safety
All money movement uses double-entry ledger transactions.
Corrections use compensating/reversal transactions.
No destructive mutation of financial history.

## Integration
Use the transactional outbox for asynchronous publication.
Every externally initiated command must be idempotent.
Consumers must be idempotent.

## Completion gate
Do not begin frontend or feature implementation until:
`npx prisma validate`
`npx prisma migrate deploy`
`npm test`
`npm run build`
all pass.

After the database passes, create application modules mapped one-to-one to
the canonical schemas without creating duplicate customer, order, trade,
ledger, payment, or instrument entities.
