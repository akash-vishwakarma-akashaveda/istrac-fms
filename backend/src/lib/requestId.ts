import type { Request, Response, NextFunction } from 'express'
import crypto from 'node:crypto'

// ============================================================
// REQUEST ID MIDDLEWARE
// ============================================================

/**
 * Injects a UUID v4 request identifier into every incoming request.
 *
 * - Sets `req.requestId` for downstream handlers and error middleware.
 * - Echoes the ID back via the `X-Request-Id` response header so clients
 *   can correlate logs with specific requests.
 *
 * Must be registered early in the middleware chain (before routes).
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const id = crypto.randomUUID()
  req.requestId = id
  res.setHeader('X-Request-Id', id)
  next()
}
