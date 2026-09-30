#!/usr/bin/env bash
set -eo pipefail

BACKUP_DIR="/opt/backups/daily"
LOG_FILE="/var/log/tradegrow_backup.log"
DATE_STR=$(date '+%Y%m%d_%H%M%S')
TARGET_FILE="${BACKUP_DIR}/tradegrow_db_${DATE_STR}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting automated database backup..." >> "$LOG_FILE"

if docker exec tradegrow_postgres pg_dump -U tradegrow tradegrow | gzip > "$TARGET_FILE"; then
    FILE_SIZE=$(du -h "$TARGET_FILE" | cut -f1)
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Backup successful: $TARGET_FILE (Size: $FILE_SIZE)" >> "$LOG_FILE"
    
    # Retain backups for 14 days, delete older
    find "$BACKUP_DIR" -type f -name "tradegrow_db_*.sql.gz" -mtime +14 -delete
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🧹 Retention cleanup completed." >> "$LOG_FILE"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ Backup failed!" >> "$LOG_FILE"
    exit 1
fi
