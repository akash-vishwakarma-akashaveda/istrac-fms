import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../lib/errors.js'

// ============================================================
// ADMIN GUARD MIDDLEWARE
// ============================================================

/**
 * Ensures the authenticated user holds the ADMIN role.
 *
 * Must be placed AFTER `authMiddleware` in the route chain — it assumes
 * `req.user` is already populated.
 *
 * @throws AppError(403) if the user is not an ADMIN.
 */
export function adminMiddleware(req: Request, _res: Response, next: NextFunction): void {
  try {
    if (req.user?.role !== 'ADMIN') {
      throw new AppError('forbidden', 'Admin access required', 403)
    }
    next()
  } catch (err) {
    next(err)
  }
}
