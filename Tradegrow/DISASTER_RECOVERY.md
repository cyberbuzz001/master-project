# DISASTER_RECOVERY.md — High Availability, Backup & Disaster Recovery

**Platform**: Trade Grow (Stocksharp Multi-User Brokerage & Paper Trading System)  
**Author**: Senior Principal FinTech SRE & DevOps Engineer  
**Status**: Production Specification (Version 1.0)

---

## 1. RPO & RTO Service Level Objectives

* **Recovery Point Objective (RPO)**: $< 1\text{ second}$ (Financial state must be recoverable to within 1 second of disaster).
* **Recovery Time Objective (RTO)**: $< 60\text{ seconds}$ for application nodes; $< 5\text{ minutes}$ for full database failover.

---

## 2. Automated PostgreSQL Backup & Point-in-Time Recovery (PITR)

### 2.1 Daily Automated Snapshot Script
```bash
#!/bin/bash
# scripts/backup_postgres.sh
BACKUP_DIR="/var/backups/tradegrow"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="tradegrow_db_${TIMESTAMP}.sql.gz"

mkdir -p $BACKUP_DIR
docker exec tradegrow_postgres pg_dump -U tradegrow -d tradegrow --clean --if-exists | gzip > "${BACKUP_DIR}/${FILENAME}"

# Encrypt backup with GPG
gpg --symmetric --batch --passphrase "$BACKUP_PASSPHRASE" "${BACKUP_DIR}/${FILENAME}"
rm -f "${BACKUP_DIR}/${FILENAME}"

# Retain backups for 30 days
find $BACKUP_DIR -name "*.gpg" -mtime +30 -delete
```

---

## 3. Component Failure Recovery Matrix

| Failed Component | Immediate System Impact | Automated Recovery Mechanism | Manual Escalation Procedure |
| :--- | :--- | :--- | :--- |
| **Node.js App Instance** | Minimal; NGINX drains traffic to healthy peer instances. | Docker / Systemd auto-restart container within 5 seconds. | Check logs for uncaught exceptions; scale additional node. |
| **WebSocket Gateway Node** | Connected clients disconnect; automatic reconnect loop triggered. | Clients reconnect to sibling WS nodes within 1–3 seconds with exponential backoff. | Inspect memory consumption and slow-client metrics. |
| **Redis Cache Node** | Pub/Sub degrades to in-memory mode; ticks fetched from DB. | Redis container restarts with AOF replay; auto-reconnects in 3 seconds. | If persistent crash, clear corrupted AOF and restart. |
| **PostgreSQL Primary** | Order placement halts (read-only mode enabled). | Promote Read Replica to Primary; update PgBouncer routing. | Run reconciliation script against exchange trade book. |
| **Exchange Market Feed (Dhan)**| Ticks stop streaming; dual-feed synthetic mode engages. | Heartbeat watchdog attempts auto-reconnect every 5s; fallback adapter activates. | Prompt admin to renew Dhan Access Token via Telegram alert. |
