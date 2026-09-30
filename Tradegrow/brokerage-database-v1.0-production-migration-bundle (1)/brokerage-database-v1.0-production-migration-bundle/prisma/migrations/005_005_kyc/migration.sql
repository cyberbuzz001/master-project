CREATE TABLE IF NOT EXISTS kyc.cases (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 customer_id UUID NOT NULL UNIQUE REFERENCES customers.customers(id),
 status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
 verification_provider VARCHAR(100), provider_reference VARCHAR(255),
 submitted_at TIMESTAMPTZ, verified_at TIMESTAMPTZ, rejected_at TIMESTAMPTZ, rejection_reason TEXT
);
CREATE TABLE IF NOT EXISTS kyc.documents (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 kyc_case_id UUID NOT NULL REFERENCES kyc.cases(id) ON DELETE CASCADE,
 document_type VARCHAR(50) NOT NULL, storage_reference TEXT NOT NULL, checksum VARCHAR(255),
 status VARCHAR(30) NOT NULL DEFAULT 'PENDING', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS kyc.consents (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 customer_id UUID NOT NULL REFERENCES customers.customers(id),
 consent_type VARCHAR(100) NOT NULL, version VARCHAR(50) NOT NULL,
 accepted_at TIMESTAMPTZ NOT NULL, ip_address INET, document_hash VARCHAR(255)
);
