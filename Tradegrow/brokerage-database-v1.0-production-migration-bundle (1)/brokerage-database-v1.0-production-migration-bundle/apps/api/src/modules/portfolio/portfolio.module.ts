import { Module } from '@nestjs/common';

@Module({})
export class PortfolioModule {}

// Canonical PostgreSQL schema: portfolio
// This module is intentionally thin at database-foundation stage.
// Add controllers/services/repositories only after migration and invariant gates pass.
