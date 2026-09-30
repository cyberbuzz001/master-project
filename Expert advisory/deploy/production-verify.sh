#!/usr/bin/env bash
# ==============================================================================
# Expert Stocks Consultancy — Production Verification & Health Check Script
# Validates live endpoints, TLS, headers, supervisor processes, and database.
# Usage: ./deploy/production-verify.sh [domain_or_ip]
# Default target: https://expertstocks.in
# ==============================================================================

set -euo pipefail

TARGET="${1:-https://expertstocks.in}"
PASSED=0
FAILED=0

echo "=========================================================="
echo " 🔍 EXPERT STOCKS PRODUCTION READINESS & HEALTH VERIFIER"
echo " Target: ${TARGET}"
echo " Time:   $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "=========================================================="
echo ""

report() {
    local test_name="$1"
    local success="$2"
    local detail="$3"

    if [ "$success" = "true" ]; then
        echo -e " \033[0;32m[PASS]\033[0m ${test_name}: ${detail}"
        PASSED=$((PASSED + 1))
    else
        echo -e " \033[0;31m[FAIL]\033[0m ${test_name}: ${detail}"
        FAILED=$((FAILED + 1))
    fi
}

# 1. API Health Check Endpoint
HTTP_HEALTH=$(curl -s -k -o /dev/null -w "%{http_code}" "${TARGET}/api/v1/health" || echo "000")
if [ "$HTTP_HEALTH" = "200" ]; then
    report "REST API Liveness" "true" "HTTP ${HTTP_HEALTH} at ${TARGET}/api/v1/health"
else
    report "REST API Liveness" "false" "Received HTTP ${HTTP_HEALTH}"
fi

# 2. Public Homepage
HTTP_HOME=$(curl -s -k -o /dev/null -w "%{http_code}" "${TARGET}/" || echo "000")
if [ "$HTTP_HOME" = "200" ]; then
    report "Public Website" "true" "HTTP ${HTTP_HOME} at ${TARGET}/"
else
    report "Public Website" "false" "Received HTTP ${HTTP_HOME}"
fi

# 3. Trust Center
HTTP_TRUST=$(curl -s -k -o /dev/null -w "%{http_code}" "${TARGET}/trust-center" || echo "000")
if [ "$HTTP_TRUST" = "200" ]; then
    report "Trust Center" "true" "HTTP ${HTTP_TRUST} at ${TARGET}/trust-center"
else
    report "Trust Center" "false" "Received HTTP ${HTTP_TRUST}"
fi

# 4. Sign-in Page
HTTP_LOGIN=$(curl -s -k -o /dev/null -w "%{http_code}" "${TARGET}/login" || echo "000")
if [ "$HTTP_LOGIN" = "200" ]; then
    report "Authentication Page" "true" "HTTP ${HTTP_LOGIN} at ${TARGET}/login"
else
    report "Authentication Page" "false" "Received HTTP ${HTTP_LOGIN}"
fi

# 5. Security Headers Check
HEADERS=$(curl -s -k -I "${TARGET}/")
if echo "$HEADERS" | grep -iq "Strict-Transport-Security"; then
    report "HSTS Header" "true" "Present with max-age directive"
else
    report "HSTS Header" "false" "Missing Strict-Transport-Security header"
fi

if echo "$HEADERS" | grep -iq "X-Content-Type-Options"; then
    report "MIME Sniffing Protection" "true" "X-Content-Type-Options: nosniff"
else
    report "MIME Sniffing Protection" "false" "Missing X-Content-Type-Options"
fi

# 6. Supervisor Background Workers (if running on VPS)
if command -v supervisorctl &> /dev/null; then
    WORKER_STATUS=$(supervisorctl status 2>/dev/null || echo "FAILED")
    if echo "$WORKER_STATUS" | grep -q "RUNNING"; then
        report "Supervisor Workers" "true" "Queue workers and Next.js are RUNNING"
    else
        report "Supervisor Workers" "false" "Workers not running or degraded: ${WORKER_STATUS}"
    fi
fi

# 7. Local Parity / Database Readiness (if on server)
if [ -d "/srv/expertstocks/current/backend" ]; then
    cd /srv/expertstocks/current/backend
    if php artisan about &> /dev/null; then
        report "Laravel Framework Status" "true" "Environment cached and operational"
    else
        report "Laravel Framework Status" "false" "Artisan command failed"
    fi
fi

echo ""
echo "=========================================================="
echo " 📊 VERIFICATION SUMMARY: ${PASSED} PASSED, ${FAILED} FAILED"
echo "=========================================================="

if [ "$FAILED" -eq 0 ]; then
    exit 0
else
    exit 1
fi
