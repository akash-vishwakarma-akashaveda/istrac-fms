import type { Request, Response, NextFunction } from 'express'
import { redis } from '../config/redis.js'
import { env } from '../config/env.js'
import { AppError } from '../lib/errors.js'
import { prisma } from '../config/db.js'

// ============================================================
// SHARED FIXED-WINDOW COUNTER (Redis, with in-memory fallback)
// ============================================================
// ponytail: the in-memory fallback is per-process; with several backend instances and no
// Redis each instance counts separately. Run Redis in production for exact limits.

const memory = new Map<string, { count: number; expiresAt: number }>()

// Drop expired in-memory entries now and then so the map can't grow without bound.
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of memory) if (v.expiresAt < now) memory.delete(k)
}, 60_000).unref()

/** Increments `key` within a fixed window and returns the new count and seconds left. */
export async function hitCounter(key: string, windowSeconds: number): Promise<{ count: number; retryAfter: number }> {
  try {
    const count = await redis.incr(key)
    let ttl = await redis.ttl(key)
    if (count === 1 || ttl < 0) {
      await redis.expire(key, windowSeconds)
      ttl = windowSeconds
    }
    return { count, retryAfter: ttl }
  } catch {
    const now = Date.now()
    const rec = memory.get(key)
    if (!rec || rec.expiresAt < now) {
      memory.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 })
      return { count: 1, retryAfter: windowSeconds }
    }
    rec.count += 1
    return { count: rec.count, retryAfter: Math.max(1, Math.ceil((rec.expiresAt - now) / 1000)) }
  }
}

/** Current count without incrementing (0 if none). */
export async function peekCounter(key: string): Promise<{ count: number; retryAfter: number }> {
  try {
    const [raw, ttl] = await Promise.all([redis.get(key), redis.ttl(key)])
    return { count: Number(raw) || 0, retryAfter: Math.max(0, ttl) }
  } catch {
    const rec = memory.get(key)
    if (!rec || rec.expiresAt < Date.now()) return { count: 0, retryAfter: 0 }
    return { count: rec.count, retryAfter: Math.ceil((rec.expiresAt - Date.now()) / 1000) }
  }
}

export async function resetCounter(key: string): Promise<void> {
  memory.delete(key)
  try {
    await redis.del(key)
  } catch {
    // Redis unavailable: memory entry already cleared
  }
}

function minutes(seconds: number): string {
  const m = Math.ceil(seconds / 60)
  return m <= 1 ? 'a minute' : `${m} minutes`
}

interface LimiterOptions {
  name: string
  /** Fixed limit, or a function returning the current limit (e.g. an admin setting). */
  max: number | (() => Promise<number>)
  windowSeconds: number
  /** Bucket key; defaults to the client IP. Return null to skip limiting. */
  key?: (req: Request) => string | null
  message: (retryAfter: number, limit: number) => string
}

export function createRateLimiter({ name, max, windowSeconds, key, message }: LimiterOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const id = key ? key(req) : req.ip || req.socket.remoteAddress || 'unknown'
    if (id === null) return next()
    const { count, retryAfter } = await hitCounter(`rate:${name}:${id}`, windowSeconds)
    const limit = typeof max === 'number' ? max : await max()
    if (count > limit) {
      res.setHeader('Retry-After', String(retryAfter))
      return next(new AppError('rate_limit_exceeded', message(retryAfter, limit), 429))
    }
    next()
  }
}

const isDev = env.NODE_ENV === 'development'

// ============================================================
// LIMITERS
// ============================================================

/** All API traffic per IP. Generous: the SPA polls notifications and banners. */
export const globalRateLimiter = createRateLimiter({
  name: 'global',
  max: isDev ? 2000 : 300,
  windowSeconds: 60,
  key: (req) => (req.path.endsWith('/health') ? null : req.ip || 'unknown'),
  message: (s) => `Too many requests from this network address. Please wait ${minutes(s)} and try again.`,
})

/** Sign-in attempts per IP (per-account lockout is enforced in the login handler). */
export const loginRateLimiter = createRateLimiter({
  name: 'login',
  max: isDev ? 200 : 20,
  windowSeconds: 900,
  message: (s) => `Too many sign-in attempts. Please wait ${minutes(s)} and try again.`,
})

/** Password-reset requests per IP. */
export const forgotPasswordRateLimiter = createRateLimiter({
  name: 'forgot',
  max: isDev ? 100 : 5,
  windowSeconds: 3600,
  message: (s) => `Too many password reset requests. Please wait ${minutes(s)} and try again.`,
})

/** OTP verification and password reset submissions per IP (the code is only 6 digits). */
export const otpRateLimiter = createRateLimiter({
  name: 'otp',
  max: isDev ? 100 : 10,
  windowSeconds: 900,
  message: (s) => `Too many verification attempts. Please wait ${minutes(s)} and try again.`,
})

export const registerRateLimiter = createRateLimiter({
  name: 'register',
  max: isDev ? 100 : 5,
  windowSeconds: 3600,
  message: (s) => `Too many registration attempts. Please wait ${minutes(s)} and try again.`,
})

export const refreshRateLimiter = createRateLimiter({
  name: 'refresh',
  max: isDev ? 1000 : 200,
  windowSeconds: 900,
  message: (s) => `Too many session refresh attempts. Please wait ${minutes(s)} and sign in again.`,
})

/** Admin setting "downloadRateLimitPerHour" (System Settings), cached for a minute. */
let downloadLimitCache = { value: 100, at: 0 }
async function downloadLimit(): Promise<number> {
  if (Date.now() - downloadLimitCache.at < 60_000) return downloadLimitCache.value
  try {
    const row = await prisma.systemConfig.findUnique({ where: { configKey: 'downloadRateLimitPerHour' } })
    const parsed = parseInt(String(row?.configValue ?? '').replace(/"/g, ''), 10)
    downloadLimitCache = { value: parsed >= 1 && parsed <= 100_000 ? parsed : 100, at: Date.now() }
  } catch {
    downloadLimitCache = { ...downloadLimitCache, at: Date.now() }
  }
  return downloadLimitCache.value
}

/** Downloads per signed-in user. */
export const downloadRateLimiter = createRateLimiter({
  name: 'download',
  max: downloadLimit,
  windowSeconds: 3600,
  key: (req) => req.user?.id ?? null,
  message: (s, limit) => `Download limit reached (${limit} per hour). Please wait ${minutes(s)} and try again.`,
})

/** Uploads per signed-in user. */
export const uploadRateLimiter = createRateLimiter({
  name: 'upload',
  max: isDev ? 1000 : 120,
  windowSeconds: 3600,
  key: (req) => req.user?.id ?? null,
  message: (s) => `Upload limit reached (120 per hour). Please wait ${minutes(s)} and try again.`,
})

/** Broadcasts sent per admin, to stop accidental or scripted floods. */
export const broadcastRateLimiter = createRateLimiter({
  name: 'broadcast',
  max: isDev ? 200 : 20,
  windowSeconds: 3600,
  key: (req) => req.user?.id ?? null,
  message: (s) => `Broadcast limit reached (20 per hour). Please wait ${minutes(s)} before sending another.`,
})

// ============================================================
// PER-ACCOUNT SIGN-IN LOCKOUT
// IP limits alone don't stop guessing one account's password from many addresses.
// ============================================================
export const ACCOUNT_LOCK_MAX_FAILURES = 5
const ACCOUNT_LOCK_WINDOW = 900

const failKey = (email: string) => `lock:login:${email.toLowerCase()}`

export async function assertAccountNotLocked(email: string): Promise<void> {
  const { count, retryAfter } = await peekCounter(failKey(email))
  if (count >= ACCOUNT_LOCK_MAX_FAILURES) {
    throw new AppError(
      'account_locked',
      `Too many failed sign-in attempts for this account. Try again in ${minutes(retryAfter || ACCOUNT_LOCK_WINDOW)}, or reset your password.`,
      429,
    )
  }
}

export async function recordFailedLogin(email: string): Promise<number> {
  return (await hitCounter(failKey(email), ACCOUNT_LOCK_WINDOW)).count
}

export async function clearFailedLogins(email: string): Promise<void> {
  await resetCounter(failKey(email))
}
