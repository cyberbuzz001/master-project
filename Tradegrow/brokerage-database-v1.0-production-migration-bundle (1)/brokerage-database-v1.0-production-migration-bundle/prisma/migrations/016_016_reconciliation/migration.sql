CREATE TABLE IF NOT EXISTS reconciliation.runs (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), reconciliation_type VARCHAR(100) NOT NULL,
 business_date DATE NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'RUNNING',
 started_at TIMESTAMPTZ NOT NULL DEFAULT now(), completed_at TIMESTAMPTZ,
 total_records INTEGER NOT NULL DEFAULT 0, matched_records INTEGER NOT NULL DEFAULT 0,
 exception_records INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS reconciliation.exceptions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), run_id UUID NOT NULL REFERENCES reconciliation.runs(id),
 entity_type VARCHAR(100) NOT NULL, entity_id UUID, internal_value JSONB, external_value JSONB,
 difference JSONB, status VARCHAR(30) NOT NULL DEFAULT 'OPEN', assigned_to UUID,
 resolution_notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), resolved_at TIMESTAMPTZ
);
