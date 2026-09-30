import { query, queryOne, execute } from '../db/schema';
import { generateUUID } from '../utils/crypto';
import { logAuditAction } from '../middleware/audit';

const DIDIT_API_BASE = 'https://verification.didit.me/v3';
const DEFAULT_API_KEY = 'gP1zw26pYkNt3EyOgtHXb-HHHw_ly-1yGIcFPuxLUWA';
const DEFAULT_WORKFLOW_ID = '2fd48ae3-8d28-42a4-a5a8-658beb28f1bc'; // Live Free KYC workflow with OCR + Liveness + Face Match + IP Analysis

export interface DiditSessionResponse {
  sessionId: string;
  sessionUrl: string;
  status: string;
  workflowId: string;
}

export class DiditService {
  private static getApiKey(): string {
    return process.env.DIDIT_API_KEY || DEFAULT_API_KEY;
  }

  private static getWorkflowId(): string {
    return process.env.DIDIT_WORKFLOW_ID || DEFAULT_WORKFLOW_ID;
  }

  /**
   * Creates or retrieves an active Didit online verification session for a user
   */
  public static async createVerificationSession(params: {
    userId: string;
    callbackUrl?: string;
    clientIp?: string;
  }): Promise<{ success: boolean; session?: DiditSessionResponse; error?: string }> {
    const { userId, callbackUrl, clientIp } = params;

    try {
      // 1. Check if user already has an approved KYC
      const user = await queryOne<any>('SELECT id, email, username, is_kyc_completed FROM users WHERE id = $1', [userId]);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      if (user.is_kyc_completed) {
        return { success: false, error: 'KYC is already completed and approved for this account.' };
      }

      // 2. Check if user has an existing active Didit session that is still valid
      const existingKyc = await queryOne<any>(
        'SELECT * FROM kyc_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
        [userId]
      );

      if (existingKyc && existingKyc.verification_method === 'DIDIT' && existingKyc.didit_session_id && existingKyc.didit_session_url) {
        // If the session is already Approved, ensure DB is in sync
        if (existingKyc.status === 'APPROVED' || existingKyc.didit_session_status === 'Approved') {
          await execute('UPDATE users SET is_kyc_completed = TRUE WHERE id = $1', [userId]);
          return {
            success: true,
            session: {
              sessionId: existingKyc.didit_session_id,
              sessionUrl: existingKyc.didit_session_url,
              status: 'Approved',
              workflowId: this.getWorkflowId()
            }
          };
        }

        // If session was created recently (within 48 hours) and not in terminal state, we can reuse it
        const sessionAgeHours = (Date.now() - new Date(existingKyc.created_at).getTime()) / (1000 * 60 * 60);
        if (sessionAgeHours < 48 && !['Declined', 'Expired', 'Abandoned'].includes(existingKyc.didit_session_status)) {
          return {
            success: true,
            session: {
              sessionId: existingKyc.didit_session_id,
              sessionUrl: existingKyc.didit_session_url,
              status: existingKyc.didit_session_status || 'Not Started',
              workflowId: this.getWorkflowId()
            }
          };
        }
      }

      // 3. Call Didit API to create a new verification session
      const workflowId = this.getWorkflowId();
      const payload: any = {
        workflow_id: workflowId,
        vendor_data: userId,
      };

      if (callbackUrl) {
        payload.callback = callbackUrl;
      }

      const res = await fetch(`${DIDIT_API_BASE}/session/`, {
        method: 'POST',
        headers: {
          'x-api-key': this.getApiKey(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error('[DiditService] Failed to create session:', res.status, errText);
        return { success: false, error: `Didit API error (${res.status}): ${errText || 'Failed to initialize session'}` };
      }

      const data: any = await res.json();
      const sessionId = data.session_id;
      const sessionUrl = data.url || data.session_url;
      const initialStatus = data.status || 'Not Started';

      if (!sessionId || !sessionUrl) {
        return { success: false, error: 'Invalid response from Didit verification gateway' };
      }

      // 4. Record/Update in kyc_applications
      const appId = existingKyc ? existingKyc.id : 'kyc_' + generateUUID();

      if (!existingKyc) {
        await execute(
          `INSERT INTO kyc_applications (
            id, user_id, verification_method, didit_session_id, didit_session_url,
            didit_session_status, status, submitted_at
          ) VALUES ($1, $2, 'DIDIT', $3, $4, $5, 'SUBMITTED', NOW())`,
          [appId, userId, sessionId, sessionUrl, initialStatus]
        );
      } else {
        await execute(
          `UPDATE kyc_applications SET
            verification_method = 'DIDIT',
            didit_session_id = $1,
            didit_session_url = $2,
            didit_session_status = $3,
            status = 'SUBMITTED',
            submitted_at = NOW(),
            updated_at = NOW()
          WHERE id = $4`,
          [sessionId, sessionUrl, initialStatus, appId]
        );
      }

      if (clientIp) {
        await logAuditAction(userId, 'USER', 'DIDIT_SESSION_CREATED', 'KYC_APPLICATION', appId, null, { sessionId, sessionUrl }, clientIp);
      }

      return {
        success: true,
        session: {
          sessionId,
          sessionUrl,
          status: initialStatus,
          workflowId
        }
      };
    } catch (err: any) {
      console.error('[DiditService] Exception creating verification session:', err);
      return { success: false, error: err.message || 'Internal server error while initializing Didit verification' };
    }
  }

  /**
   * Syncs and checks the current decision status of a Didit session
   */
  public static async syncSessionDecision(userId: string): Promise<{
    success: boolean;
    status?: string;
    kycStatus?: string;
    decision?: any;
    error?: string;
  }> {
    try {
      const kycApp = await queryOne<any>(
        'SELECT * FROM kyc_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
        [userId]
      );

      if (!kycApp || !kycApp.didit_session_id) {
        return { success: false, error: 'No Didit verification session found for this user' };
      }

      const sessionId = kycApp.didit_session_id;

      // Query Didit decision endpoint
      const res = await fetch(`${DIDIT_API_BASE}/session/${sessionId}/decision/`, {
        headers: {
          'x-api-key': this.getApiKey()
        }
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error('[DiditService] Failed to retrieve decision:', res.status, errText);
        return { success: false, error: `Could not fetch Didit decision: ${res.status}` };
      }

      const decision: any = await res.json();
      const rawStatus = decision.status || kycApp.didit_session_status || 'Not Started';

      // Map Didit raw status to internal status
      let internalStatus = kycApp.status;
      let isCompleted = false;

      if (rawStatus === 'Approved') {
        internalStatus = 'APPROVED';
        isCompleted = true;
      } else if (rawStatus === 'Declined') {
        internalStatus = 'REJECTED';
      } else if (rawStatus === 'In Review') {
        internalStatus = 'UNDER_REVIEW';
      } else if (rawStatus === 'In Progress' || rawStatus === 'Awaiting User') {
        internalStatus = 'UNDER_REVIEW';
      } else if (rawStatus === 'Expired' || rawStatus === 'Abandoned') {
        internalStatus = 'RESUBMISSION_REQUIRED';
      }

      // Update database
      await execute(
        `UPDATE kyc_applications SET
          didit_session_status = $1,
          didit_decision_data = $2,
          status = $3,
          reviewed_at = ${rawStatus === 'Approved' ? 'NOW()' : 'reviewed_at'},
          updated_at = NOW()
        WHERE id = $4`,
        [rawStatus, JSON.stringify(decision), internalStatus, kycApp.id]
      );

      if (isCompleted) {
        await execute('UPDATE users SET is_kyc_completed = TRUE WHERE id = $1', [userId]);
      }

      return {
        success: true,
        status: rawStatus,
        kycStatus: internalStatus,
        decision
      };
    } catch (err: any) {
      console.error('[DiditService] Exception syncing session decision:', err);
      return { success: false, error: err.message || 'Internal server error while syncing verification decision' };
    }
  }

  /**
   * Handles incoming webhook notification from Didit
   */
  public static async handleWebhook(payload: any): Promise<{ success: boolean }> {
    try {
      const sessionId = payload?.session_id || payload?.sessionId || payload?.data?.session_id;
      const rawStatus = payload?.status || payload?.data?.status;

      if (!sessionId) {
        return { success: false };
      }

      const kycApp = await queryOne<any>(
        'SELECT * FROM kyc_applications WHERE didit_session_id = $1 LIMIT 1',
        [sessionId]
      );

      if (kycApp) {
        await this.syncSessionDecision(kycApp.user_id);
      }

      return { success: true };
    } catch (err) {
      console.error('[DiditService] Error handling webhook:', err);
      return { success: false };
    }
  }
}
