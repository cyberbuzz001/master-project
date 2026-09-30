CREATE TABLE IF NOT EXISTS integration.outbox_events (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 aggregate_type VARCHAR(100) NOT NULL, aggregate_id UUID NOT NULL,
 event_type VARCHAR(150) NOT NULL, event_version INTEGER NOT NULL DEFAULT 1,
 payload JSONB NOT NULL, correlation_id UUID, causation_id UUID,
 published_at TIMESTAMPTZ, attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_outbox_unpublished ON integration.outbox_events(created_at) WHERE published_at IS NULL;
