#!/usr/bin/env bash
# ==============================================================================
# Expert Stocks Consultancy — Zero-Downtime Production Deployment Script
# Usage: ./deploy/deploy.sh [branch_or_tag]
# ==============================================================================

set -euo pipefail

APP_DIR="/srv/expertstocks"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SHARED_DIR="${APP_DIR}/shared"
RELEASES_DIR="${APP_DIR}/releases"
CURRENT_LINK="${APP_DIR}/current"
BRANCH="${1:-main}"
TIMESTAMP=$(date '+%Y%m%d%H%M%S')
NEW_RELEASE="${RELEASES_DIR}/${TIMESTAMP}"
KEEP_RELEASES=5

echo "=========================================================="
echo " Starting Zero-Downtime Deployment"
echo " Timestamp: ${TIMESTAMP}"
echo " Branch/Ref: ${BRANCH}"
echo " Release: ${NEW_RELEASE}"
echo "=========================================================="

cd "${SOURCE_ROOT}"

# 1. Ensure directories exist
mkdir -p "${RELEASES_DIR}"
mkdir -p "${SHARED_DIR}/backend/storage"
mkdir -p "${SHARED_DIR}/frontend"

# 2. Export / Clone codebase into release folder
echo "--> [1/8] Fetching release files from ${SOURCE_ROOT}..."
if [ -d ".git" ]; then
    # Local git repo checkout to release directory
    git archive --format=tar "${BRANCH}" | tar -x -C "${NEW_RELEASE}" 2>/dev/null || {
        mkdir -p "${NEW_RELEASE}"
        cp -a . "${NEW_RELEASE}/"
        rm -rf "${NEW_RELEASE}/.git"
    }
else
    mkdir -p "${NEW_RELEASE}"
    cp -a . "${NEW_RELEASE}/"
fi

# 3. Link Shared Environment & Persistent Storage
echo "--> [2/8] Linking shared storage and environment..."
rm -f "${NEW_RELEASE}/backend/.env"
ln -sfn "${SHARED_DIR}/backend/.env" "${NEW_RELEASE}/backend/.env"

rm -rf "${NEW_RELEASE}/backend/storage"
ln -sfn "${SHARED_DIR}/backend/storage" "${NEW_RELEASE}/backend/storage"

# 4. Backend Dependencies & Optimization
echo "--> [3/8] Installing PHP dependencies..."
cd "${NEW_RELEASE}/backend"
composer install --no-dev --prefer-dist --optimize-autoloader --no-interaction --quiet

echo "--> [4/8] Executing database migrations..."
php artisan migrate --force

echo "--> [5/8] Caching configuration, routes, and Filament components..."
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache
php artisan filament:optimize || true

# 5. Atomic Symlink Switch
echo "--> [6/8] Switching active release symlink..."
cd "${APP_DIR}"
ln -sfn "${NEW_RELEASE}" "${CURRENT_LINK}.tmp"
mv -Tf "${CURRENT_LINK}.tmp" "${CURRENT_LINK}"

# 6. Reload Services
echo "--> [7/8] Reloading PHP-FPM and Laravel workers..."
systemctl reload php8.3-fpm || true
supervisorctl restart esc-queue-* || true
supervisorctl restart esc-scheduler || true

# 7. Smoke Test & Health Check
echo "--> [8/8] Performing post-deployment smoke test..."
sleep 3
HEALTH_STATUS=$(curl --fail --silent --show-error --output /dev/null --write-out "%{http_code}" --header "Host: api.expertstocks.in" http://127.0.0.1/api/v1/health 2>/dev/null || true)
if [ "${HEALTH_STATUS}" != "200" ]; then
    HEALTH_STATUS=$(curl --fail --silent --show-error --output /dev/null --write-out "%{http_code}" https://api.expertstocks.in/api/v1/health 2>/dev/null || true)
fi

if [ "${HEALTH_STATUS}" = "200" ]; then
    echo "=========================================================="
    echo " SUCCESS: Deployment verified healthy (HTTP 200)!"
    echo " Active release: ${NEW_RELEASE}"
    echo "=========================================================="
else
    echo "=========================================================="
    echo " WARNING: Health check returned HTTP ${HEALTH_STATUS}."
    echo " Check logs: /srv/expertstocks/shared/backend/storage/logs/"
    echo "=========================================================="
fi

# 8. Clean Up Old Releases
echo "--> Cleaning up old releases (keeping latest ${KEEP_RELEASES})..."
cd "${RELEASES_DIR}"
ls -dt */ | tail -n +$((KEEP_RELEASES + 1)) | xargs -r rm -rf

echo "Deployment complete."
