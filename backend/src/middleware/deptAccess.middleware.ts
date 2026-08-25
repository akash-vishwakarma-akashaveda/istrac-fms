import type { Request, Response, NextFunction } from 'express'
import { prisma } from '../config/db.js'
import { redis } from '../config/redis.js'
import { AppError } from '../lib/errors.js'

// ============================================================
// DEPARTMENT ACCESS MIDDLEWARE
// ============================================================

export async function deptAccessMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const deptId = (req.params.deptId ?? req.body?.departmentId ?? req.query?.departmentId ?? '') as string

    if (!deptId) {
      throw new AppError('missing_department', 'Department ID required', 400)
    }

    // ADMINs bypass dept access check
    if (req.user?.role === 'ADMIN') {
      req.deptAccessLevel = 'READ_WRITE'
      next()
      return
    }

    if (!req.user) {
      throw new AppError('missing_token', 'Authentication required', 401)
    }

    const userId = req.user.id
    const cacheKey = `dept-access:${userId}:${deptId}`

    // ----------------------------------------------------------
    // Cache read (safe fallback if Redis offline)
    // ----------------------------------------------------------
    try {
      const cached = await redis.get(cacheKey)
      if (cached !== null) {
        if (cached === 'none') {
          throw new AppError('dept_access_denied', 'You do not have access to this department', 403)
        }
        req.deptAccessLevel = cached
        next()
        return
      }
    } catch (cacheErr) {
      if (cacheErr instanceof AppError) throw cacheErr
      // Continue to DB lookup if Redis is unreachable
    }

    // ----------------------------------------------------------
    // DB lookup
    // ----------------------------------------------------------
    const access = await prisma.userDepartmentAccess.findFirst({
      where: {
        userId,
        departmentId: deptId,
        deletedAt: null,
      },
      select: { accessLevel: true },
    })

    const level = access?.accessLevel ?? null

    // Cache result (5 min = 300 sec)
    try {
      await redis.setex(cacheKey, 300, level ?? 'none')
    } catch {
      // Ignore cache write errors if Redis is offline
    }

    if (!level) {
      throw new AppError('dept_access_denied', 'You do not have access to this department', 403)
    }

    req.deptAccessLevel = level as string
    next()
  } catch (err) {
    next(err)
  }
}
