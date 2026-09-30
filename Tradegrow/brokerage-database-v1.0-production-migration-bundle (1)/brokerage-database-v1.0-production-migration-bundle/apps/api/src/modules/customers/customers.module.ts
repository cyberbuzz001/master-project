import { Module } from '@nestjs/common';

@Module({})
export class CustomersModule {}

// Canonical PostgreSQL schema: customers
// This module is intentionally thin at database-foundation stage.
// Add controllers/services/repositories only after migration and invariant gates pass.
