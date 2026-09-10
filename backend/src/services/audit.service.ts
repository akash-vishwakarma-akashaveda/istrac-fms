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

function safeStringify(obj: unknown): string | undefined {
  if (obj === undefined || obj === null) return undefined
  try {
    return JSON.stringify(obj, (_, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )
  } catch {
    return undefined
  }
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
          oldValue: safeStringify(opts.oldValue),
          newValue: safeStringify(opts.newValue),
          ipAddress: opts.ipAddress,
          userAgent: opts.userAgent,
        },
      })
      .catch((err: unknown) => console.error('[AuditService] log failed:', err))
  },
}
