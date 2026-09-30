import { Module } from '@nestjs/common';

@Module({})
export class PaymentsModule {}

// Canonical PostgreSQL schema: payments
// This module is intentionally thin at database-foundation stage.
// Add controllers/services/repositories only after migration and invariant gates pass.
