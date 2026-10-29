#!/usr/bin/env bash
# renew_market_feed.sh — Scheduled at 03:15 AM UTC / 08:45 AM IST (Mon-Fri)
# Restarts primary container to ensure clean Dhan connection for the new trading day.

LOG_FILE="/var/log/tradegrow_market_renew.log"
HEALTH_URL="http://127.0.0.1:5001/api/v1/health/live"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🌅 Daily market feed renewal check starting..." >> "$LOG_FILE"

# Check if the container is already healthy
CURRENT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 "$HEALTH_URL" || echo "000")

if [ "$CURRENT_STATUS" = "200" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Primary container already healthy (HTTP 200). Proceeding with scheduled renewal restart." >> "$LOG_FILE"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️ Primary container not healthy (HTTP $CURRENT_STATUS) before renewal — restarting." >> "$LOG_FILE"
fi

docker restart tradegrow_app_1 >> "$LOG_FILE" 2>&1
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🔄 Primary container restarted. Waiting 20s for startup..." >> "$LOG_FILE"
sleep 20

# Verify it came back healthy
NEW_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$HEALTH_URL" || echo "000")
if [ "$NEW_STATUS" = "200" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Renewal restart successful. Container healthy (HTTP 200)." >> "$LOG_FILE"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🚨 Container not healthy after renewal restart! HTTP $NEW_STATUS — check logs immediately." >> "$LOG_FILE"
fi

# Verify Dhan feed is active in Redis
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📊 Checking Redis tick cache:" >> "$LOG_FILE"
docker exec tradegrow_redis redis-cli mget tick:NSE_NIFTY50 tick:BSE_SENSEX 2>&1 >> "$LOG_FILE" || true
