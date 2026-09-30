# audit module

Canonical PostgreSQL schema: `audit`.

Implementation rule:
- Reuse Prisma canonical models.
- Do not create duplicate domain tables.
- All writes must respect database invariants.
- Financial writes must be transactional.
