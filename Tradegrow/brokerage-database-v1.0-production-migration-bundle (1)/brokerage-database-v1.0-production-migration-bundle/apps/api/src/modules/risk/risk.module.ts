import { Module } from '@nestjs/common';

@Module({})
export class RiskModule {}

// Canonical PostgreSQL schema: risk
// This module is intentionally thin at database-foundation stage.
// Add controllers/services/repositories only after migration and invariant gates pass.
