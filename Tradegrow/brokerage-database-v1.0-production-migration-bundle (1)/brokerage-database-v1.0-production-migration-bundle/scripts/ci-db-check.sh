#!/usr/bin/env bash
set -euo pipefail
npx prisma validate
bash scripts/validate-migrations.sh
npx prisma generate
npm test
echo "Database CI validation passed."
