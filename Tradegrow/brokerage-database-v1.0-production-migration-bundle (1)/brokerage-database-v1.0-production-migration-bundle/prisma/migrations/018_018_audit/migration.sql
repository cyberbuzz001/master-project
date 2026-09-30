CREATE TABLE IF NOT EXISTS audit.events (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), actor_user_id UUID REFERENCES identity.users(id),
 actor_type VARCHAR(50) NOT NULL, action VARCHAR(150) NOT NULL, resource_type VARCHAR(150) NOT NULL,
 resource_id UUID, before_state JSONB, after_state JSONB, ip_address INET, user_agent TEXT,
 correlation_id UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
