/**
 * KycSyncService.ts
 *
 * Authoritative Synchronization Engine for KYC State.
 * Solves the critical implicit state machine vulnerability where KYC verification state
 * was triplicated and desynchronized across kyc_applications, kyc_records,
 * users (is_kyc_completed), and warroom.kyc_applications.
 */

import { withTransaction, queryOne, execute } from '../db/schema';
import { generateUUID } from '../utils/crypto';
import { adminEventBus } from '../utils/adminEventBus';

export type CanonicalKycStatus = 'NOT_STARTED' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'RESUBMISSION_REQUIRED';

export interface SyncKycParams {
  userId: string;
  status: CanonicalKycStatus;
  reviewerId?: string;
  rejectionReason?: string;
  rejectionCategory?: string;
  notes?: string;
  bankDetails?: {
    bankAccountName?: string;
    bankAccountNumber?: string;
    bankIfsc?: string;
    bankName?: string;
  };
  diditSession?: {
    sessionId?: string;
    sessionUrl?: string;
    sessionStatus?: string;
    decisionData?: any;
  };
}

export class KycSyncService {
  /**
   * Synchronizes KYC state across all four stores atomically in a single PostgreSQL transaction.
   */
  public static async syncKycStatus(params: SyncKycParams): Promise<{ success: boolean; error?: string }> {
    const { userId, status, reviewerId, rejectionReason, rejectionCategory, notes, bankDetails, diditSession } = params;

    try {
      await withTransaction(async (client) => {
        // 1. Synchronize users table flag & bank details
        const isCompleted = (status === 'APPROVED');
        if (bankDetails && (bankDetails.bankAccountNumber || bankDetails.bankIfsc)) {
          await client.query(
            `UPDATE users 
             SET is_kyc_completed = $1,
                 bank_account_name = COALESCE($2, bank_account_name),
                 bank_account_number = COALESCE($3, bank_account_number),
                 bank_ifsc = COALESCE($4, bank_ifsc),
                 bank_name = COALESCE($5, bank_name),
                 updated_at = NOW()
             WHERE id = $6`,
            [
              isCompleted,
              bankDetails.bankAccountName || null,
              bankDetails.bankAccountNumber || null,
              bankDetails.bankIfsc || null,
              bankDetails.bankName || null,
              userId
            ]
          );
        } else {
          await client.query(
            `UPDATE users 
             SET is_kyc_completed = $1,
                 updated_at = NOW()
             WHERE id = $2`,
            [isCompleted, userId]
          );
        }

        // 2. Synchronize kyc_applications table
        const existingApp = await client.query(
          `SELECT id FROM kyc_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [userId]
        );

        if (existingApp.rows.length > 0) {
          const appId = existingApp.rows[0].id;
          await client.query(
            `UPDATE kyc_applications 
             SET status = $1,
                 rejection_reason = $2,
                 rejection_category = $3,
                 reviewed_by = COALESCE($4, reviewed_by),
                 reviewed_at = ${status === 'APPROVED' || status === 'REJECTED' ? 'NOW()' : 'reviewed_at'},
                 didit_session_status = COALESCE($5, didit_session_status),
                 didit_decision_data = COALESCE($6, didit_decision_data),
                 bank_account_name = COALESCE($7, bank_account_name),
                 bank_account_number = COALESCE($8, bank_account_number),
                 bank_ifsc = COALESCE($9, bank_ifsc),
                 bank_name = COALESCE($10, bank_name),
                 updated_at = NOW()
             WHERE id = $11`,
            [
              status,
              rejectionReason || null,
              rejectionCategory || null,
              reviewerId || null,
              diditSession?.sessionStatus || null,
              diditSession?.decisionData ? JSON.stringify(diditSession.decisionData) : null,
              bankDetails?.bankAccountName || null,
              bankDetails?.bankAccountNumber || null,
              bankDetails?.bankIfsc || null,
              bankDetails?.bankName || null,
              appId
            ]
          );
        } else {
          const newAppId = 'kyc_' + generateUUID();
          await client.query(
            `INSERT INTO kyc_applications (
               id, user_id, status, rejection_reason, rejection_category, reviewed_by,
               reviewed_at, didit_session_id, didit_session_url, didit_session_status,
               bank_account_name, bank_account_number, bank_ifsc, bank_name,
               submitted_at, created_at, updated_at
             ) VALUES (
               $1, $2, $3, $4, $5, $6,
               ${status === 'APPROVED' || status === 'REJECTED' ? 'NOW()' : 'NULL'},
               $7, $8, $9,
               $10, $11, $12, $13,
               NOW(), NOW(), NOW()
             )`,
            [
              newAppId,
              userId,
              status,
              rejectionReason || null,
              rejectionCategory || null,
              reviewerId || null,
              diditSession?.sessionId || null,
              diditSession?.sessionUrl || null,
              diditSession?.sessionStatus || null,
              bankDetails?.bankAccountName || null,
              bankDetails?.bankAccountNumber || null,
              bankDetails?.bankIfsc || null,
              bankDetails?.bankName || null
            ]
          );
        }

        // 3. Synchronize kyc_records table
        const recordKycStatus = status === 'APPROVED'
          ? 'APPROVED'
          : status === 'REJECTED'
          ? 'REJECTED'
          : status === 'RESUBMISSION_REQUIRED'
          ? 'RESUBMIT'
          : status === 'NOT_STARTED'
          ? 'DRAFT'
          : 'PENDING';

        const recordVerificationStatus = status === 'APPROVED'
          ? 'VERIFIED'
          : status === 'REJECTED'
          ? 'FAILED'
          : 'PENDING';

        const existingRecord = await client.query(
          `SELECT id FROM kyc_records WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [userId]
        );

        if (existingRecord.rows.length > 0) {
          await client.query(
            `UPDATE kyc_records
             SET kyc_status = $1,
                 verification_status = $2,
                 verified_by = COALESCE($3, verified_by),
                 verified_at = ${status === 'APPROVED' || status === 'REJECTED' ? 'NOW()' : 'verified_at'},
                 notes = COALESCE($4, notes),
                 updated_at = NOW()
             WHERE id = $5`,
            [
              recordKycStatus,
              recordVerificationStatus,
              reviewerId || null,
              rejectionReason || notes || null,
              existingRecord.rows[0].id
            ]
          );
        } else {
          await client.query(
            `INSERT INTO kyc_records (
               id, customer_id, kyc_status, verification_status, risk_category,
               verified_by, verified_at, notes, created_at, updated_at
             ) VALUES (
               $1, $2, $3, $4, 'MEDIUM',
               $5, ${status === 'APPROVED' || status === 'REJECTED' ? 'NOW()' : 'NULL'},
               $6, NOW(), NOW()
             )`,
            [
              'kyc_rec_' + generateUUID(),
              userId,
              recordKycStatus,
              recordVerificationStatus,
              reviewerId || null,
              rejectionReason || notes || null
            ]
          );
        }

        // 4. Synchronize warroom.kyc_applications & warroom.leads (if schema exists)
        try {
          if (status === 'APPROVED') {
            await client.query(
              `UPDATE warroom.kyc_applications 
               SET status = 'COMPLETED', current_step = 'VERIFIED', completed_at = NOW() 
               WHERE user_id = $1`,
              [userId]
            );
            await client.query(
              `UPDATE warroom.leads 
               SET stage = CASE WHEN stage IN ('NEW', 'CONTACTED', 'KYC_STARTED', 'KYC_SUBMITTED') THEN 'KYC_SUBMITTED' ELSE stage END,
                   updated_at = clock_timestamp()
               WHERE phone_e164 IN (SELECT phone_number FROM users WHERE id = $1 AND phone_number IS NOT NULL)`,
              [userId]
            );
          } else if (status === 'SUBMITTED' || status === 'UNDER_REVIEW') {
            await client.query(
              `UPDATE warroom.kyc_applications 
               SET status = 'IN_PROGRESS', current_step = 'DOCS_UPLOADED' 
               WHERE user_id = $1`,
              [userId]
            );
            await client.query(
              `UPDATE warroom.leads 
               SET stage = 'KYC_SUBMITTED', updated_at = clock_timestamp()
               WHERE phone_e164 IN (SELECT phone_number FROM users WHERE id = $1 AND phone_number IS NOT NULL)`,
              [userId]
            );
          } else if (status === 'REJECTED') {
            await client.query(
              `UPDATE warroom.kyc_applications 
               SET status = 'REJECTED', rejection_code = $1 
               WHERE user_id = $2`,
              [rejectionReason || 'REJECTED', userId]
            );
          }
        } catch (_) {
          // Non-fatal if warroom schema is not present or user is not a warroom lead
        }
      });

      // 5. Emit real-time notification to all active admin dashboards
      adminEventBus.emitUserEvent('KYC_UPDATED', userId, {
        userId,
        status,
        isCompleted: status === 'APPROVED',
        reviewerId,
        timestamp: Date.now()
      });

      return { success: true };
    } catch (err: any) {
      console.error('[KycSyncService] Failed to sync KYC status:', err.message);
      return { success: false, error: err.message || 'Failed to synchronize KYC status' };
    }
  }
}
