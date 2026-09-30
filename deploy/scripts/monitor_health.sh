#!/usr/bin/env bash

HEALTH_URL="http://127.0.0.1:5000/api/v1/health/live"
LOG_FILE="/var/log/tradegrow_monitor.log"

STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$HEALTH_URL" || echo "000")

if [ "$STATUS_CODE" != "200" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️ Health check returned HTTP $STATUS_CODE. Restarting container..." >> "$LOG_FILE"
    docker restart tradegrow_app >> "$LOG_FILE" 2>&1
    sleep 5
    NEW_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$HEALTH_URL" || echo "000")
    if [ "$NEW_STATUS" = "200" ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Container recovered successfully." >> "$LOG_FILE"
    else
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🚨 Container failed to recover! HTTP $NEW_STATUS" >> "$LOG_FILE"
    fi
fi
