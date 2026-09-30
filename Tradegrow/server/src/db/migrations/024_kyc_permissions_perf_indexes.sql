-- C1 fix: /admin/kyc/applications sorts by submitted_at with no supporting index, and its
-- batched documents lookup (WHERE kyc_application_id = ANY($1)) had no index on that column at
-- all (only the primary key on kyc_documents.id existed).
CREATE INDEX IF NOT EXISTS idx_kyc_applications_submitted_at ON kyc_applications(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_kyc_documents_kyc_application_id ON kyc_documents(kyc_application_id);
