import type { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from '../lib/jwt.js'
import { sessionStore } from '../services/sessionStore.js'
import { AppError } from '../lib/errors.js'

// ============================================================
// AUTH MIDDLEWARE
// ============================================================

/**
 * Extracts and validates the Bearer token from the Authorization header.
 *
 * Steps:
 *  1. Parse `Authorization: Bearer <token>`
 *  2. Verify JWT signature and expiry
 *  3. Check blacklist (covers logged-out tokens)
 *  4. Attach decoded payload to `req.user`
 *
 * @throws AppError(401) for missing, invalid, or revoked tokens.
 */
export async function authMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('missing_token', 'Authentication required', 401)
    }

    const token = authHeader.slice(7) // strip "Bearer "

    // Verify signature + expiry
    const payload = verifyAccessToken(token)
 
    // Check blacklist safely (handles Redis & in-memory fallback)
    const blacklisted = await sessionStore.isBlacklisted(payload.jti) 
    if (blacklisted) {
      throw new AppError('token_revoked', 'Token has been revoked', 401)
    }

    req.user = {
      id: payload.id,
      role: payload.role,
      email: payload.email,
      name: payload.name,
    }

    next()
  } catch (err: any) {
    if (err instanceof AppError) {
      next(err)
    } else {
      next(new AppError('unauthorized', err.message || 'Invalid authentication token', 401))
    }
  }
}

// ============================================================
// OPTIONAL AUTH MIDDLEWARE
// ============================================================

/**
 * Same as authMiddleware but does NOT reject requests without a token.
 * Useful for routes that serve both authenticated and anonymous users.
 * If a token IS present, it is fully validated (blacklist check included).
 */
export async function optionalAuthMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next()
      return
    }

    const token = authHeader.slice(7)
    const payload = verifyAccessToken(token)

    const blacklisted = await sessionStore.isBlacklisted(payload.jti)
    if (blacklisted) {
      throw new AppError('token_revoked', 'Token has been revoked', 401)
    }

    req.user = {
      id: payload.id,
      role: payload.role,
      email: payload.email,
      name: payload.name,
    }

    next()
  } catch {
    // Optional auth silently ignores invalid tokens and proceeds as anonymous
    next()
  }
}
