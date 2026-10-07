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

# 2. Sync migrations and code into cluster containers
echo "🔄 [2/6] Syncing database migrations and bundles across cluster..."
CONTAINERS=("tradegrow_app_1" "tradegrow_app_2" "tradegrow_app_3" "tradegrow_app_4")
PORTS=(5001 5002 5003 5004)

# Fallback check if single container is running
if ! docker ps --format '{{.Names}}' | grep -q 'tradegrow_app_1'; then
  CONTAINERS=("tradegrow_app")
  PORTS=(5000)
fi

for c in "${CONTAINERS[@]}"; do
  if docker ps -a --format '{{.Names}}' | grep -q "^${c}$"; then
    docker exec -i "$c" mkdir -p /app/server/dist/db/migrations /app/server/src/db/migrations || true
    docker cp "${APP_DIR}/server/src/db/migrations/." "$c":/app/server/src/db/migrations/ || true
    docker cp "${APP_DIR}/server/src/db/migrations/." "$c":/app/server/dist/db/migrations/ || true
    if [ -d "${APP_DIR}/server/dist" ]; then
      docker cp "${APP_DIR}/server/dist/." "$c":/app/server/dist/ || true
    fi
    if [ -d "${APP_DIR}/client/dist" ]; then
      docker cp "${APP_DIR}/client/dist/." "$c":/app/client/dist/ || true
    fi
  fi
done

# 3. Rolling Restart: Zero-Downtime Cluster Reload
echo "♻️  [3/5] Performing rolling cluster restart..."
for i in "${!CONTAINERS[@]}"; do
  c="${CONTAINERS[$i]}"
  p="${PORTS[$i]}"
  
  if docker ps --format '{{.Names}}' | grep -q "^${c}$"; then
    echo "🔄 Rolling restarting node: $c (Port $p)..."
    docker restart "$c"
    
    # Wait for healthcheck before restarting the next node
    MAX_RETRIES=20
    RETRY_COUNT=0
    HEALTH_OK=false
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
      if curl -s -f "http://127.0.0.1:${p}/api/v1/health/live" > /dev/null 2>&1; then
        HEALTH_OK=true
        break
      fi
      sleep 1.5
      RETRY_COUNT=$((RETRY_COUNT+1))
    done
    
    if [ "$HEALTH_OK" = true ]; then
      echo "✅ Node $c healthy on port $p!"
    else
      echo "⚠️ Node $c health check timed out on port $p. Check docker logs $c"
    fi
  fi
done

# 4. Reload Nginx reverse proxy to distribute traffic to updated nodes
echo "🌐 [4/5] Reloading Nginx reverse proxy..."
nginx -t && systemctl reload nginx

echo "=========================================================="
echo "🎉 [TradeGrow] Deployment Successful & Live at tradegrowx.in!"
echo "=========================================================="
