-- Migration 028: Sync is_kyc_completed for users with APPROVED kyc_applications
UPDATE users 
SET is_kyc_completed = TRUE, updated_at = NOW() 
WHERE id IN (
  SELECT user_id 
  FROM kyc_applications 
  WHERE status = 'APPROVED'
);
