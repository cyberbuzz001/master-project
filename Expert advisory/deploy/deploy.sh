#!/usr/bin/env bash
# ==============================================================================
# Expert Stocks Consultancy — Zero-Downtime Production Deployment Script
# Usage: ./deploy/deploy.sh [branch_or_tag]
# ==============================================================================

set -euo pipefail

APP_DIR="/srv/expertstocks"
SHARED_DIR="${APP_DIR}/shared"
RELEASES_DIR="${APP_DIR}/releases"
CURRENT_LINK="${APP_DIR}/current"
BRANCH="${1:-master}"
TIMESTAMP=$(date '+%Y%m%d%H%M%S')
NEW_RELEASE="${RELEASES_DIR}/${TIMESTAMP}"
KEEP_RELEASES=5

echo "=========================================================="
echo " Starting Zero-Downtime Deployment"
echo " Timestamp: ${TIMESTAMP}"
echo " Branch/Ref: ${BRANCH}"
echo " Release: ${NEW_RELEASE}"
echo "=========================================================="

# 1. Ensure directories exist
mkdir -p "${RELEASES_DIR}"
mkdir -p "${SHARED_DIR}/backend/storage"
mkdir -p "${SHARED_DIR}/frontend"

# 2. Export / Clone codebase into release folder
echo "--> [1/9] Fetching release files..."
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
echo "--> [2/9] Linking shared storage and environment..."
rm -f "${NEW_RELEASE}/backend/.env"
ln -sfn "${SHARED_DIR}/backend/.env" "${NEW_RELEASE}/backend/.env"

rm -rf "${NEW_RELEASE}/backend/storage"
ln -sfn "${SHARED_DIR}/backend/storage" "${NEW_RELEASE}/backend/storage"

# 4. Backend Dependencies & Optimization
echo "--> [3/9] Installing PHP dependencies..."
cd "${NEW_RELEASE}/backend"
composer install --no-dev --prefer-dist --optimize-autoloader --no-interaction --quiet

echo "--> [4/9] Executing database migrations..."
php artisan migrate --force

echo "--> [5/9] Caching configuration, routes, and Filament components..."
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache
php artisan filament:optimize || true

# 5. Frontend Build
echo "--> [6/9] Building Next.js production frontend..."
cd "${NEW_RELEASE}/frontend"
npm ci --silent
npm run build

# 6. Atomic Symlink Switch
echo "--> [7/9] Switching active release symlink..."
cd "${APP_DIR}"
ln -sfn "${NEW_RELEASE}" "${CURRENT_LINK}.tmp"
mv -Tf "${CURRENT_LINK}.tmp" "${CURRENT_LINK}"

# 7. Reload Services
echo "--> [8/9] Reloading PHP-FPM, Supervisor workers, and Next.js..."
systemctl reload php8.3-fpm || true
supervisorctl restart esc-queue-* || true
supervisorctl restart esc-scheduler || true
supervisorctl restart esc-nextjs || true

# 8. Smoke Test & Health Check
echo "--> [9/9] Performing post-deployment smoke test..."
sleep 3
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/api/v1/health || echo "000")

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

# 9. Clean Up Old Releases
echo "--> Cleaning up old releases (keeping latest ${KEEP_RELEASES})..."
cd "${RELEASES_DIR}"
ls -dt */ | tail -n +$((KEEP_RELEASES + 1)) | xargs -r rm -rf

echo "Deployment complete."
