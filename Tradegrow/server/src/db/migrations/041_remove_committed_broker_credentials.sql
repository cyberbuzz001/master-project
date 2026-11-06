-- Remove credentials that were previously shipped in migration 005.
-- Operators must provision replacement values through the secret manager or
-- protected system configuration UI after rotating the exposed credentials.
UPDATE system_config
SET value = ''
WHERE key IN (
  'ALPHAVANTAGE_API_KEY',
  'ANGELONE_API_KEY',
  'ANGELONE_CLIENT_ID',
  'ANGELONE_CLIENT_SECRET',
  'ANGELONE_TOTP_SECRET'
)
AND value IN ('CC23XT2DVHARWKAU', '4DBv6HvT', 'N89824', '9691', 'AV7KF7BEJBOOCVIS53TZZB2VEU');
