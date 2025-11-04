import { prisma } from '../lib/prisma';

export type AuditEventType =
  | 'legal.accepted'
  | 'legal.reaccepted'
  | 'tiktok.account_linked'
  | 'tiktok.account_unlinked'
  | 'tiktok.token_refreshed'
  | 'tiktok.publish_started'
  | 'tiktok.publish_succeeded'
  | 'tiktok.publish_failed'
  | 'auth.register'
  | 'auth.login'
  | 'auth.email_verified'
  | 'security.rate_limit_exceeded'
  | 'security.unauthorized_access';

interface AuditDetails {
  [key: string]: any;
}

/**
 * Log an audit event for compliance and debugging
 */
export async function logAuditEvent(
  userId: string | null,
  type: AuditEventType,
  details: AuditDetails,
  ip?: string,
  userAgent?: string
): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        userId,
        type,
        detailsJson: details,
        ip,
        userAgent,
      },
    });
  } catch (error) {
    // Don't throw - audit failures shouldn't break the app
    console.error('Failed to log audit event:', error);
  }
}
