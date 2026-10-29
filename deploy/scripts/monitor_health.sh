#!/usr/bin/env bash
# monitor_health.sh — TradeGrow container health monitor
# Runs every 5 min via cron. Only restarts after 2 consecutive failures.
# NEVER restarts during NSE market hours (09:15-15:30 IST).

HEALTH_URL="http://127.0.0.1:5001/api/v1/health/live"
LOG_FILE="/var/log/tradegrow_monitor.log"
FAIL_STATE_FILE="/tmp/tradegrow_health_fail_count"

# ── Market hours guard (IST = UTC+5:30) ──────────────────────────────────────
HOUR_IST=$(TZ=Asia/Kolkata date +%H)
MIN_IST=$(TZ=Asia/Kolkata date +%M)
TOTAL_MIN=$(( 10#$HOUR_IST * 60 + 10#$MIN_IST ))
# 09:10 IST = 550 min, 15:35 IST = 935 min — give 5-min buffer on either side
if [ $TOTAL_MIN -ge 550 ] && [ $TOTAL_MIN -le 935 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ℹ️ Market hours active (${HOUR_IST}:${MIN_IST} IST) — restart guard ON. Skipping restart check." >> "$LOG_FILE"
    # Still check health and log the result but DO NOT restart
    STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$HEALTH_URL" || echo "000")
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Health status during market hours: HTTP $STATUS_CODE" >> "$LOG_FILE"
    # Reset fail counter during market hours — we tolerate brief hiccups
    echo 0 > "$FAIL_STATE_FILE"
    exit 0
fi

# ── Off-market health check with consecutive failure threshold ────────────────
STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 "$HEALTH_URL" || echo "000")

if [ "$STATUS_CODE" = "200" ]; then
    # Healthy — reset consecutive fail counter
    echo 0 > "$FAIL_STATE_FILE"
    exit 0
fi

# Health check failed — increment counter
FAIL_COUNT=$(cat "$FAIL_STATE_FILE" 2>/dev/null || echo 0)
FAIL_COUNT=$(( FAIL_COUNT + 1 ))
echo "$FAIL_COUNT" > "$FAIL_STATE_FILE"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️ Health check returned HTTP $STATUS_CODE. Consecutive failures: $FAIL_COUNT/2" >> "$LOG_FILE"

# Only restart after 2 consecutive failures (not just 1 transient blip)
if [ "$FAIL_COUNT" -lt 2 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ℹ️ Waiting for 2nd consecutive failure before restarting (transient blip protection)." >> "$LOG_FILE"
    exit 0
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🔴 2 consecutive failures confirmed. Restarting primary container..." >> "$LOG_FILE"
echo 0 > "$FAIL_STATE_FILE"

docker restart tradegrow_app_1 >> "$LOG_FILE" 2>&1
sleep 15

NEW_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 "$HEALTH_URL" || echo "000")
if [ "$NEW_STATUS" = "200" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Container recovered successfully after restart (HTTP $NEW_STATUS)." >> "$LOG_FILE"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🚨 Container FAILED to recover after restart! HTTP $NEW_STATUS" >> "$LOG_FILE"
fi
