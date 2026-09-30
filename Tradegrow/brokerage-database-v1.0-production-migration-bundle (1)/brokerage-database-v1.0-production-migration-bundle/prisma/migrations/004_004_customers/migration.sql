CREATE TABLE IF NOT EXISTS customers.customers (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL UNIQUE REFERENCES identity.users(id),
 customer_code VARCHAR(50) NOT NULL UNIQUE,
 pan_hash VARCHAR(255),
 pan_last4 VARCHAR(4),
 date_of_birth DATE,
 gender VARCHAR(20),
 status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
 onboarding_completed_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS customers.profiles (
 customer_id UUID PRIMARY KEY REFERENCES customers.customers(id) ON DELETE CASCADE,
 first_name VARCHAR(100), middle_name VARCHAR(100), last_name VARCHAR(100),
 display_name VARCHAR(255), occupation VARCHAR(100), annual_income_range VARCHAR(100),
 risk_profile VARCHAR(50), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS customers.addresses (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 customer_id UUID NOT NULL REFERENCES customers.customers(id) ON DELETE CASCADE,
 address_type VARCHAR(30) NOT NULL, address_line_1 TEXT NOT NULL, address_line_2 TEXT,
 city VARCHAR(100), state VARCHAR(100), postal_code VARCHAR(20),
 country VARCHAR(100) NOT NULL DEFAULT 'India', is_primary BOOLEAN NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS customers.bank_accounts (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 customer_id UUID NOT NULL REFERENCES customers.customers(id) ON DELETE CASCADE,
 account_holder_name VARCHAR(255) NOT NULL, account_number_encrypted TEXT NOT NULL,
 account_number_last4 VARCHAR(4), ifsc_code VARCHAR(20) NOT NULL, bank_name VARCHAR(255),
 status VARCHAR(30) NOT NULL DEFAULT 'PENDING', is_primary BOOLEAN NOT NULL DEFAULT false,
 verified_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS customers.nominees (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 customer_id UUID NOT NULL REFERENCES customers.customers(id) ON DELETE CASCADE,
 full_name VARCHAR(255) NOT NULL, relationship VARCHAR(100), date_of_birth DATE,
 allocation_percentage NUMERIC(5,2) NOT NULL CHECK(allocation_percentage > 0 AND allocation_percentage <= 100),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
