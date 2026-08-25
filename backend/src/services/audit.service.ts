import { prisma } from '../config/db.js'

export interface AuditLogOpts {
  userId?: string
  action: string
  resourceType?: string
  resourceId?: string
  oldValue?: Record<string, unknown>
  newValue?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

/**
 * Append-only audit logger.
 * Mutations are logged fire-and-forget; never blocks the caller.
 */
export const auditService = {
  log(opts: AuditLogOpts): void {
    prisma.auditLog
      .create({
        data: {
          userId: opts.userId,
          action: opts.action,
          resourceType: opts.resourceType,
          resourceId: opts.resourceId,
          oldValue: opts.oldValue ? JSON.stringify(opts.oldValue) : undefined,
          newValue: opts.newValue ? JSON.stringify(opts.newValue) : undefined,
          ipAddress: opts.ipAddress,
          userAgent: opts.userAgent,
        },
      })
      .catch((err: unknown) => console.error('[AuditService] log failed:', err))
  },
}
