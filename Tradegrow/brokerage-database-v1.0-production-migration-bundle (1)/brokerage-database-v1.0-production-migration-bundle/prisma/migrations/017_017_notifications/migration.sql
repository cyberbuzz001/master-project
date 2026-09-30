CREATE TABLE IF NOT EXISTS notifications.notifications (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES identity.users(id),
 notification_type VARCHAR(100) NOT NULL, title VARCHAR(255) NOT NULL, message TEXT NOT NULL,
 data JSONB, read_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
