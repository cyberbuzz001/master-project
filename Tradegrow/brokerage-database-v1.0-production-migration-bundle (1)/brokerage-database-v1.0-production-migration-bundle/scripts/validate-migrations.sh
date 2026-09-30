#!/usr/bin/env bash
set -euo pipefail
test "$(find prisma/migrations -mindepth 1 -maxdepth 1 -type d | wc -l)" -eq 25
find prisma/migrations -name migration.sql -print0 | xargs -0 -n1 sh -c 'test -s "$0"'
echo "25 migration directories validated."
