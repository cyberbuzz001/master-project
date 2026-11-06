-- Live Dhan access tokens must never be retained in general configuration
-- storage. Operators should provide them through a secret manager or use the
-- in-memory/TOTP renewal flow.
DELETE FROM system_config WHERE key = 'DHAN_ACCESS_TOKEN';
