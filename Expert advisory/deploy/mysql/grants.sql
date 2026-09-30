-- Least-privilege MySQL users. Run as an administrator after migrations, and re-run after
-- any migration that adds tables (step 2 regenerates per-table grants).
--   app_rw      runtime user: no DDL; append-only tables get SELECT/INSERT only
--   app_migrate deploy-time only: `php artisan migrate --force`
--   backup_ro   backup job only

CREATE USER IF NOT EXISTS 'app_rw'@'localhost' IDENTIFIED BY 'CHANGE_ME';
CREATE USER IF NOT EXISTS 'app_migrate'@'localhost' IDENTIFIED BY 'CHANGE_ME';
CREATE USER IF NOT EXISTS 'backup_ro'@'localhost' IDENTIFIED BY 'CHANGE_ME';

GRANT ALL PRIVILEGES ON expertstocks.* TO 'app_migrate'@'localhost';
GRANT SELECT, LOCK TABLES, SHOW VIEW, TRIGGER, EVENT ON expertstocks.* TO 'backup_ro'@'localhost';

-- 1. Generate per-table grants for app_rw (MySQL cannot revoke a table privilege that was
--    granted schema-wide, so app_rw is never granted schema-wide DML).
SELECT CONCAT(
  'GRANT ',
  IF(table_name IN ('audit_logs', 'consent_records', 'login_histories', 'lead_attributions', 'lead_status_histories'),
     'SELECT, INSERT', 'SELECT, INSERT, UPDATE, DELETE'),
  ' ON expertstocks.`', table_name, '` TO ''app_rw''@''localhost'';'
) AS grant_statement
FROM information_schema.tables
WHERE table_schema = 'expertstocks' AND table_type = 'BASE TABLE';

-- 2. Execute the statements printed above, then:
FLUSH PRIVILEGES;
