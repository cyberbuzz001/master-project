# reconciliation module

Canonical PostgreSQL schema: `reconciliation`.

Implementation rule:
- Reuse Prisma canonical models.
- Do not create duplicate domain tables.
- All writes must respect database invariants.
- Financial writes must be transactional.
