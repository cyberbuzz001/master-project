#!/usr/bin/env bash
set -euo pipefail
npx prisma validate
npx prisma generate
