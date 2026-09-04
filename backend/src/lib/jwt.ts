import jwt from 'jsonwebtoken'
import * as crypto from 'node:crypto'
import { env } from '../config/env.js'
import type { AuthUser } from '../types/api.js'
import { AppError } from './errors.js'

// ============================================================
// TOKEN PAYLOAD INTERFACES
// ============================================================

export interface AccessTokenPayload extends AuthUser {
  jti: string
  exp?: number // optional because jwt.verify() may not include it in the decoded payload
}

export interface RefreshTokenPayload {
  /** userId */
  sub: string
  jti?: string
  
}

// ============================================================
// TOKEN SIGN FUNCTIONS
// ============================================================

/**
 * Signs a 15-minute access token containing full AuthUser claims.
 */
export function signAccessToken(user: AuthUser): string {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email, name: user.name, jti: crypto.randomUUID() },
    env.JWT_SECRET,
    { expiresIn: '15m' },
  )
}

/**
 * Signs a 7-day refresh token containing unique jti + userId as `sub`.
 */
export function signRefreshToken(userId: string): string {
  return jwt.sign(
    { sub: userId, jti: crypto.randomUUID() },
    env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' },
  )
}

// ============================================================
// TOKEN VERIFY FUNCTIONS
// ============================================================

/**
 * Verifies an access token and returns the decoded payload.
 * @throws AppError(401) if the token is invalid or expired.
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload
    return payload
  } catch {
    throw new AppError('token_invalid', 'Invalid or expired access token', 401)
  }
}

/**
 * Verifies a refresh token and returns the decoded payload.
 * @throws AppError(401) if the token is invalid or expired.
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload
    return payload
  } catch {
    throw new AppError('refresh_token_invalid', 'Invalid or expired refresh token', 401)
  }
}
