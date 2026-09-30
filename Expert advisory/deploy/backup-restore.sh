#!/usr/bin/env bash
# ==============================================================================
# Expert Stocks Consultancy — Automated Backup & Verified Restore Script
# Runs daily via cron/scheduler:
# 1. Dumps MySQL with transaction consistency
# 2. Archives encrypted private document vault
# 3. Computes SHA-256 integrity checksums
# 4. Performs TEST RESTORE into scratch DB (Mandatory SEBI audit requirement)
# ==============================================================================

set -euo pipefail

BACKUP_ROOT="/srv/expertstocks/backups"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
BACKUP_DIR="${BACKUP_ROOT}/${TIMESTAMP}"
STORAGE_VAULT="/srv/expertstocks/shared/backend/storage/app/private"
DB_NAME="${DB_DATABASE:-expertstocks}"
DB_USER="${DB_USERNAME:-expertstocks}"
DB_PASS="${DB_PASSWORD:-expertstocks}"
SCRATCH_DB="expertstocks_restore_test"

mkdir -p "${BACKUP_DIR}"

echo "=========================================================="
echo " Starting Expert Stocks Backup & Restore Verification"
echo " Target dir: ${BACKUP_DIR}"
echo " Timestamp: ${TIMESTAMP}"
echo "=========================================================="

# 1. MySQL Database Dump (Single transaction, consistent point-in-time)
echo "--> [1/4] Dumping database: ${DB_NAME}..."
SQL_DUMP="${BACKUP_DIR}/database_${TIMESTAMP}.sql.zst"

mysqldump --single-transaction \
          --quick \
          --routines \
          --triggers \
          --user="${DB_USER}" \
          --password="${DB_PASS}" \
          "${DB_NAME}" | zstd -q -o "${SQL_DUMP}"

sha256sum "${SQL_DUMP}" > "${SQL_DUMP}.sha256"

# 2. Archive Encrypted Document Vault
echo "--> [2/4] Archiving private document vault..."
VAULT_ARCHIVE="${BACKUP_DIR}/vault_${TIMESTAMP}.tar.zst"

if [ -d "${STORAGE_VAULT}" ]; then
    tar -cf - -C "$(dirname "${STORAGE_VAULT}")" "$(basename "${STORAGE_VAULT}")" | zstd -q -o "${VAULT_ARCHIVE}"
    sha256sum "${VAULT_ARCHIVE}" > "${VAULT_ARCHIVE}.sha256"
fi

# 3. Verified Restore Test (Mandatory SEBI Audit Requirement)
# Never trust a backup without proving it restores cleanly!
echo "--> [3/4] Verifying restore integrity into scratch database: ${SCRATCH_DB}..."

mysql --user="${DB_USER}" --password="${DB_PASS}" -e "DROP DATABASE IF EXISTS ${SCRATCH_DB}; CREATE DATABASE ${SCRATCH_DB} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

zstd -dc "${SQL_DUMP}" | mysql --user="${DB_USER}" --password="${DB_PASS}" "${SCRATCH_DB}"

# Assert table count in scratch DB matches production
ORIG_TABLE_COUNT=$(mysql --user="${DB_USER}" --password="${DB_PASS}" -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${DB_NAME}';")
RESTORE_TABLE_COUNT=$(mysql --user="${DB_USER}" --password="${DB_PASS}" -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${SCRATCH_DB}';")

if [ "${ORIG_TABLE_COUNT}" -eq "${RESTORE_TABLE_COUNT}" ] && [ "${ORIG_TABLE_COUNT}" -gt 0 ]; then
    echo "✅ Backup verification PASSED: Restored ${RESTORE_TABLE_COUNT}/${ORIG_TABLE_COUNT} tables."
    mysql --user="${DB_USER}" --password="${DB_PASS}" -e "DROP DATABASE ${SCRATCH_DB};"
    echo "STATUS: VERIFIED" > "${BACKUP_DIR}/RESTORE_VERIFIED.txt"
    date -u '+%Y-%m-%dT%H:%M:%SZ' >> "${BACKUP_DIR}/RESTORE_VERIFIED.txt"
else
    echo "❌ Backup verification FAILED! Original tables: ${ORIG_TABLE_COUNT}, Restored tables: ${RESTORE_TABLE_COUNT}"
    exit 1
fi

# 4. Retention: Keep 35 daily backups locally
echo "--> [4/4] Purging backups older than 35 days..."
find "${BACKUP_ROOT}" -maxdepth 1 -type d -mtime +35 -exec rm -rf {} +

echo "=========================================================="
echo " Backup & Verified Restore Finished Successfully!"
echo " Output files: ${BACKUP_DIR}"
echo "=========================================================="
