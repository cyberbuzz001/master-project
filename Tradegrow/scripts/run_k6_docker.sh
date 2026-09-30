#!/bin/bash
# ==============================================================================
# scripts/run_k6_docker.sh
# Execute k6 Concurrency Benchmark (500 WS + 250 orders/sec) via Docker
# ==============================================================================

set -e

BASE_URL="${BASE_URL:-http://host.docker.internal:5000}"
WS_URL="${WS_URL:-ws://host.docker.internal:5000/ws}"
AUTH_TOKEN="${AUTH_TOKEN:-}"

echo "==============================================================="
echo "⚡ EXECUTING K6 LOAD BENCHMARK (HIGH CONCURRENCY)"
echo "Target Base URL: $BASE_URL"
echo "Target WS URL:   $WS_URL"
echo "==============================================================="

docker run --rm -i \
  -e BASE_URL="$BASE_URL" \
  -e WS_URL="$WS_URL" \
  -e AUTH_TOKEN="$AUTH_TOKEN" \
  grafana/k6 run - < scripts/load_test_k6_concurrency.js
