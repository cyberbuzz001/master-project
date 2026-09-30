CREATE TABLE IF NOT EXISTS identity.users (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 email CITEXT UNIQUE,
 mobile_country_code VARCHAR(5),
 mobile_number VARCHAR(20),
 password_hash TEXT,
 status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
 email_verified_at TIMESTAMPTZ,
 mobile_verified_at TIMESTAMPTZ,
 last_login_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_mobile ON identity.users(mobile_country_code,mobile_number) WHERE mobile_number IS NOT NULL;
CREATE TABLE IF NOT EXISTS identity.sessions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
 refresh_token_hash TEXT NOT NULL,
 ip_address INET,
 user_agent TEXT,
 expires_at TIMESTAMPTZ NOT NULL,
 revoked_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS identity.devices (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
 device_fingerprint VARCHAR(255) NOT NULL,
 device_name VARCHAR(255),
 trusted BOOLEAN NOT NULL DEFAULT false,
 last_seen_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(user_id,device_fingerprint)
);
CREATE TABLE IF NOT EXISTS identity.roles (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 code VARCHAR(100) UNIQUE NOT NULL,
 name VARCHAR(150) NOT NULL,
 description TEXT,
 is_system_role BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS identity.permissions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 code VARCHAR(150) UNIQUE NOT NULL,
 name VARCHAR(200) NOT NULL,
 resource VARCHAR(100) NOT NULL,
 action VARCHAR(100) NOT NULL
);
CREATE TABLE IF NOT EXISTS identity.role_permissions (
 role_id UUID NOT NULL REFERENCES identity.roles(id) ON DELETE CASCADE,
 permission_id UUID NOT NULL REFERENCES identity.permissions(id) ON DELETE CASCADE,
 PRIMARY KEY(role_id,permission_id)
);
CREATE TABLE IF NOT EXISTS identity.user_roles (
 user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
 role_id UUID NOT NULL REFERENCES identity.roles(id) ON DELETE CASCADE,
 PRIMARY KEY(user_id,role_id)
);
