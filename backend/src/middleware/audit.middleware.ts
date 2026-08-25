import type { Request, Response, NextFunction } from 'express'
import { prisma } from '../config/db.js'

// ============================================================
// AUDIT MIDDLEWARE
// ============================================================

/**
 * Non-blocking audit logger that records mutating HTTP operations.
 *
 * Behaviour:
 *  - Only fires for POST, PUT, PATCH, DELETE methods.
 *  - Runs AFTER the response is sent (`res.on('finish', ...)`) — zero latency impact.
 *  - Only records successful operations (statusCode < 400).
 *  - Inserts to `auditLog` table fire-and-forget; errors are logged, never thrown.
 */
export function auditMiddleware(req: Request, res: Response, next: NextFunction): void {
  res.on('finish', () => {
    // Only audit mutating methods
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return

    // Only audit successful operations
    if (res.statusCode >= 400) return

    const userId = req.user?.id
    if (!userId) return // anonymous mutations are not audited

    // Derive action string from method + route pattern
    const routePath = req.route?.path as string | undefined
    const action = `${req.method}:${routePath ?? req.path}`

    // Derive resource type from path segments
    const segments = req.path.split('/').filter(Boolean)
    const adminIdx = segments.indexOf('admin')
    const resourceType =
      adminIdx !== -1
        ? (segments[adminIdx + 1] ?? segments[0] ?? 'unknown')
        : (segments[0] ?? 'unknown')

    const rawId = req.params.id || req.params.userId || req.params.deptId || req.params.fileId
    const resourceId = Array.isArray(rawId) ? rawId[0] : (rawId ?? null)

    prisma.auditLog
      .create({
        data: {
          userId,
          action,
          resourceType,
          resourceId,
          ipAddress: req.ip ?? null,
          userAgent: req.get('user-agent') ?? null,
        },
      })
      .catch((err: unknown) => console.error('[AuditMiddleware] Failed to write audit log:', err))
  })

  next()
}
