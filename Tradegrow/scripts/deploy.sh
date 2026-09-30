#!/bin/bash
# ============================================================
# Trade Grow — Deploy / Update Script
# Run on VPS to pull latest code and redeploy:
#   cd /opt/tradegrow && ./scripts/deploy.sh
# ============================================================

set -e

APP_DIR="/opt/tradegrow"
cd "$APP_DIR"

echo "============================================="
echo "  Trade Grow — Deploying Update"
echo "  $(date '+%Y-%m-%d %H:%M:%S IST')"
echo "============================================="

# Pull latest code from GitHub
echo "[1/4] Pulling latest code from GitHub..."
git pull origin main

# Build and restart containers (zero downtime: build first, then swap)
echo "[2/4] Building Docker images..."
docker compose build --no-cache app

echo "[3/4] Restarting application container..."
docker compose up -d --no-deps app

echo "[4/4] Checking container health..."
sleep 10
docker ps --filter name=tradegrow

# Check application health endpoint
HEALTH=$(curl -sf http://localhost:5000/api/v1/health/live 2>/dev/null || echo "FAILED")
if echo "$HEALTH" | grep -q "ok\|healthy\|true"; then
  echo ""
  echo "✅ Deployment successful! Trade Grow is running."
else
  echo ""
  echo "⚠️  Health check uncertain. Check logs:"
  echo "   docker logs tradegrow_app --tail 50"
fi

echo "============================================="
