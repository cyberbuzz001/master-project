import { execute } from '../db/schema';
import { generateUUID } from '../utils/crypto';

/**
 * Log an auditable action to the audit_logs table.
 * PostgreSQL async version.
 */
export async function logAuditAction(
  actorId: string,
  actorRole: string,
  action: string,
  resourceType: string,
  resourceId?: string,
  beforeState?: any,
  afterState?: any,
  ipAddress?: string,
  requestId?: string
): Promise<void> {
  try {
    await execute(
      `INSERT INTO audit_logs (id, actor_id, actor_role, action, resource_type, resource_id, before_state, after_state, ip_address, request_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::inet, $10)`,
      [
        'aud_' + generateUUID(),
        actorId, actorRole, action, resourceType,
        resourceId || null,
        beforeState ? JSON.stringify(beforeState) : null,
        afterState  ? JSON.stringify(afterState)  : null,
        ipAddress   || '127.0.0.1',
        requestId   || null
      ]
    );
  } catch (err: any) {
    // Audit log failures should never crash the app — log to stderr only
    console.error('[AuditLog] Failed to log action:', err.message);
  }
}
