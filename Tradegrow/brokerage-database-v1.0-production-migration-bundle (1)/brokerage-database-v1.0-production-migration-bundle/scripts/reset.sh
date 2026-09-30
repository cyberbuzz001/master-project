#!/usr/bin/env bash
set -euo pipefail
npx prisma migrate reset --force
