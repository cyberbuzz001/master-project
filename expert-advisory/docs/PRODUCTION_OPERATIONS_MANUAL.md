# Expert Stocks Consultancy — Production Operations Manual

Complete guide for provisioning, deploying, maintaining, and recovering the Expert Stocks Consultancy platform in production.

---

## 1. System Topology & Specifications

The production deployment runs on **Ubuntu 24.04 LTS** (recommended KVM 4+ vCPU, 8–16 GB RAM, NVMe storage).

```
 Internet (Clients & Staff)
           │
           ▼
 Cloudflare (DNS · Full Strict TLS · WAF · DDoS Mitigation · Origin Pulls)
           │
           ▼ HTTPS (Port 443)
 Nginx Reverse Proxy (HTTP/2 · Cloudflare Real-IP · Rate Limiting · Static Caching)
     ├─── /api, /sanctum, /webhooks, /office ───► PHP 8.3-FPM (Laravel 13)
     │                                                ├──► MySQL 8.4 (Database)
     │                                                ├──► Redis 7 (Cache, Sessions, Queues)
     │                                                └──► /srv/expertstocks/shared/backend/storage
     └─── All Other Web Routes (/, /portal) ───► Next.js 16 (Node.js 22 LTS on :3000)

 Supervisor (Process Manager):
     ├── esc-queue-critical    (2 workers: payments, webhooks)
     ├── esc-queue-default     (2 workers: default, communications)
     ├── esc-queue-background  (1 worker: ai, reports, imports)
     ├── esc-scheduler         (1 process: artisan schedule:work)
     └── esc-nextjs            (1 process: npm run start -- -p 3000)
```

---

## 2. Server Provisioning

On a fresh Ubuntu 24.04 LTS server, run the automated setup script as root:

```bash
# Clone the repository
cd /tmp
git clone <YOUR_GIT_REPO_URL> expertstocks-repo
cd expertstocks-repo

# Run automated provisioning
sudo bash deploy/setup-vps.sh
```

The provisioning script automatically installs and configures:
- PHP 8.3-FPM and all required extensions (`bcmath`, `curl`, `gd`, `intl`, `mbstring`, `mysql`, `opcache`, `readline`, `redis`, `sqlite3`, `xml`, `zip`).
- Composer 2 & Node.js 22 LTS.
- MySQL 8.4 Server & Redis 7.
- Nginx & Supervisor.
- Dedicated non-root user `expertstocks` and `/srv/expertstocks/{releases,shared,backups}` hierarchy.
- UFW firewall (restricted to ports 22, 80, 443) & Fail2ban.

---

## 3. Database & Redis Setup

### 3.1 MySQL Database & User Grants

Log into MySQL as root and execute the principle-of-least-privilege grants:

```bash
sudo mysql
```

```sql
CREATE DATABASE expertstocks CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Application user
CREATE USER 'expertstocks'@'127.0.0.1' IDENTIFIED BY 'STRONG_DATABASE_PASSWORD_HERE';
GRANT ALL PRIVILEGES ON expertstocks.* TO 'expertstocks'@'127.0.0.1';
GRANT ALL PRIVILEGES ON expertstocks_restore_test.* TO 'expertstocks'@'127.0.0.1';

FLUSH PRIVILEGES;
EXIT;
```

### 3.2 Redis Password Protection

Edit `/etc/redis/redis.conf`:
```ini
requirepass YOUR_STRONG_REDIS_PASSWORD_HERE
bind 127.0.0.1 ::1
```
Restart Redis:
```bash
sudo systemctl restart redis-server
```

---

## 4. Environment & Secrets Configuration

Create the persistent production `.env` file in the shared directory:

```bash
sudo -u expertstocks cp /srv/expertstocks/releases/current/backend/.env.production.example /srv/expertstocks/shared/backend/.env
sudo chmod 0600 /srv/expertstocks/shared/backend/.env
```

Edit `/srv/expertstocks/shared/backend/.env` and supply:
1. `APP_KEY`: Generate via `php artisan key:generate --show`.
2. `DB_PASSWORD`: Password configured in MySQL.
3. `REDIS_PASSWORD`: Password configured in Redis.
4. `MAIL_HOST`, `MAIL_USERNAME`, `MAIL_PASSWORD`: Production transactional mail provider.
5. Payment Gateway credentials (when ready for Cashfree / Razorpay).

---

## 5. Cloudflare & SSL Configuration

1. In Cloudflare Dashboard:
   - Set SSL/TLS encryption mode to **Full (strict)**.
   - Generate an **Origin Certificate** for `expertstocks.in` and `*.expertstocks.in` (15 years validity).
   - Save the certificate to `/etc/ssl/cloudflare/expertstocks.pem`.
   - Save the private key to `/etc/ssl/cloudflare/expertstocks.key` (`chmod 600`).
   - Download the Cloudflare Origin Pull CA:
     ```bash
     sudo curl -s https://developers.cloudflare.com/ssl/static/authenticated_origin_pull_ca.pem -o /etc/ssl/cloudflare/origin-pull-ca.pem
     ```
   - Enable **Authenticated Origin Pulls** in Cloudflare.

2. Enable Nginx site:
   ```bash
   sudo cp deploy/nginx/expertstocks.conf /etc/nginx/sites-available/expertstocks.conf
   sudo ln -s /etc/nginx/sites-available/expertstocks.conf /etc/nginx/sites-enabled/
   sudo rm -f /etc/nginx/sites-enabled/default
   sudo nginx -t
   sudo systemctl reload nginx
   ```

3. Enable Supervisor configuration:
   ```bash
   sudo cp deploy/supervisor/expertstocks.conf /etc/supervisor/conf.d/expertstocks.conf
   sudo supervisorctl reread
   sudo supervisorctl update
   ```

---

## 6. Zero-Downtime Deployment

All production deployments should be run using `deploy/deploy.sh`:

```bash
cd /srv/expertstocks/current
sudo -u expertstocks bash deploy/deploy.sh master
```

### What `deploy.sh` executes automatically:
1. Creates a timestamped directory `/srv/expertstocks/releases/<timestamp>`.
2. Exports clean repository code into the new release.
3. Symlinks shared `.env` and `/storage` directories into the release.
4. Runs `composer install --no-dev -o` and `php artisan migrate --force`.
5. Caches config, routes, views, events, and Filament components.
6. Builds the Next.js production frontend (`npm ci && npm run build`).
7. Atomically switches `/srv/expertstocks/current` symlink.
8. Reloads PHP-FPM, restarts queue workers, and restarts Next.js.
9. Performs an automated curl smoke test against `/api/v1/health`.
10. Automatically prunes old releases, keeping the 5 most recent.

---

## 7. Initial Platform Bootstrap & Compliance Initialization

On the very first deployment:

```bash
cd /srv/expertstocks/current/backend

# 1. Sync RBAC roles and permissions (19 roles, 102 permissions)
php artisan rbac:sync

# 2. Seed onboarding risk suitability questionnaire & agreements
php artisan db:seed --class=OnboardingSeeder

# 3. Seed AI models & prompt versions
php artisan db:seed --class=AiSeeder

# 4. Create Initial Super Admin
php artisan platform:create-super-admin admin@expertstocks.in
```

### Regulatory Profile Activation (SEBI Compliance Gate)
1. Sign in as Super Admin at `https://expertstocks.in/office`.
2. Enroll TOTP Authenticator app.
3. Go to **Admin → Regulatory profile**: Enter registered entity details, registration number (`INH...`), authorized persons, and grievance officer contact.
4. Submit the profile version.
5. Have a **second authorized Compliance Officer** verify the profile.
6. Once verified, research publication gates, disclosures, and Trust Center will activate automatically.

---

## 8. Scheduled Sweeps & Cron

The Laravel scheduler runs continuously under Supervisor (`esc-scheduler`). It automatically manages:

| Command | Frequency | Purpose |
|---|---|---|
| `crm:followups-sweep` | Every 5 minutes | Follow-up reminders and missed status marking |
| `crm:escalate-stale-leads` | Every 15 minutes | Stale lead alert notifications to managers |
| `billing:sweep` | Daily at 00:05 | Subscription expiration, renewal reminders, overdue invoices |
| `documents:retention-sweep` | Daily at 01:00 | Document expiry and regulatory retention compliance |
| `research:track-performance` | Daily at 16:30 IST | MFE, MAE, and target/stop loss detection |

---

## 9. Automated Backups & Test Restore Verification

A daily cron job runs `deploy/backup-restore.sh` at 01:30 IST:

```bash
sudo crontab -u expertstocks -e
```
Add:
```cron
30 1 * * * /srv/expertstocks/current/deploy/backup-restore.sh >> /srv/expertstocks/shared/backend/storage/logs/backup.log 2>&1
```

### Verification Guarantee
The script dumps MySQL using `--single-transaction`, archives the encrypted vault, and **restores the dump into a temporary database** `expertstocks_restore_test` to verify table counts. If the restore verification fails, an exit code 1 is triggered and alerts are generated.

---

## 10. Disaster Recovery & Rollback

### Rollback to Previous Release
If an unexpected issue occurs after deployment:
```bash
# List recent releases
ls -l /srv/expertstocks/releases

# Atomically switch back to previous timestamp
ln -sfn /srv/expertstocks/releases/PREVIOUS_TIMESTAMP /srv/expertstocks/current

# Reload services
sudo systemctl reload php8.3-fpm
sudo supervisorctl restart all
```

### Database Emergency Restore
```bash
# Extract and restore database from backup
zstd -dc /srv/expertstocks/backups/YYYYMMDD_HHMMSS/database_*.sql.zst | mysql -u expertstocks -p expertstocks
```
