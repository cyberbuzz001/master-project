-- Migration 004: Client Fund Deposit & Withdrawal Requests with Admin Approval Workflow

CREATE TABLE IF NOT EXISTS fund_requests (
  id VARCHAR(64) PRIMARY KEY,
  request_id VARCHAR(64) NOT NULL UNIQUE,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_type VARCHAR(20) NOT NULL, -- 'DEPOSIT' or 'WITHDRAWAL'
  amount NUMERIC(20,4) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
  payment_method VARCHAR(50) DEFAULT 'BANK_TRANSFER',
  reference_note TEXT,
  rejection_reason TEXT,
  approved_by VARCHAR(64),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fund_requests_user_id ON fund_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_fund_requests_status ON fund_requests(status);
