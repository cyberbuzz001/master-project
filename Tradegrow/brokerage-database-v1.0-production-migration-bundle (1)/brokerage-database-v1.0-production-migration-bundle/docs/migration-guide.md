# Migration Guide

1. Start PostgreSQL 16.
2. Set DATABASE_URL.
3. Run `npx prisma migrate deploy`.
4. Run `npx prisma generate`.
5. Run `npm run db:seed`.
6. Run `npm test`.
7. Run `npm run db:validate`.

Never edit an applied migration. Create a new migration.
