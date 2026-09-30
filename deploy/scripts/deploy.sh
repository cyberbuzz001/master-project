#!/usr/bin/env bash
set -eo pipefail

echo "=========================================================="
echo "🚀 [TradeGrow] Starting Production Zero-Downtime Deploy"
echo "📅 $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "=========================================================="

APP_DIR="/opt/tradegrow"
BACKUP_DIR="/opt/backups"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')

mkdir -p "$BACKUP_DIR"

# 1. Automatic Pre-Deployment Safety Snapshot
echo "📦 [1/5] Creating pre-deployment PostgreSQL safety backup..."
docker exec tradegrow_postgres pg_dump -U tradegrow tradegrow | gzip > "${BACKUP_DIR}/tradegrow_predeploy_${TIMESTAMP}.sql.gz"
echo "✅ Safety snapshot created: ${BACKUP_DIR}/tradegrow_predeploy_${TIMESTAMP}.sql.gz ($(du -h "${BACKUP_DIR}/tradegrow_predeploy_${TIMESTAMP}.sql.gz" | cut -f1))"

# 2. Sync migrations into container
echo "🔄 [2/6] Syncing database migrations..."
docker exec -i tradegrow_app mkdir -p /app/server/dist/db/migrations /app/server/src/db/migrations
docker cp "${APP_DIR}/server/src/db/migrations/." tradegrow_app:/app/server/src/db/migrations/
docker cp "${APP_DIR}/server/src/db/migrations/." tradegrow_app:/app/server/dist/db/migrations/

# 3. Sync compiled code bundles into container
echo "📦 [3/6] Syncing compiled server and client bundles..."
if [ -d "${APP_DIR}/server/dist" ]; then
  docker cp "${APP_DIR}/server/dist/." tradegrow_app:/app/server/dist/
fi
if [ -d "${APP_DIR}/client/dist" ]; then
  docker cp "${APP_DIR}/client/dist/." tradegrow_app:/app/client/dist/
fi

# 4. Gracefully restart application container to load new bundle & run pending migrations
echo "♻️  [4/6] Restarting tradegrow_app container..."
docker restart tradegrow_app

# 4. Wait for health check
echo "⏳ [4/5] Waiting for server healthcheck on port 5000..."
MAX_RETRIES=20
RETRY_COUNT=0
HEALTH_OK=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if curl -s -f http://127.0.0.1:5000/api/v1/health/live > /dev/null 2>&1; then
    HEALTH_OK=true
    break
  fi
  sleep 2
  RETRY_COUNT=$((RETRY_COUNT+1))
done

if [ "$HEALTH_OK" = true ]; then
  echo "✅ Application health check passed!"
else
  echo "❌ Health check failed after $MAX_RETRIES attempts! Check docker logs tradegrow_app"
  exit 1
fi

# 5. Reload Nginx without dropping active connections
echo "🌐 [5/5] Reloading Nginx reverse proxy..."
nginx -t && systemctl reload nginx

echo "=========================================================="
echo "🎉 [TradeGrow] Deployment Successful & Live at tradegrowx.in!"
echo "=========================================================="
