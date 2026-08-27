import type { Request, Response, NextFunction } from 'express'
import { redis } from '../config/redis.js'
import { AppError } from '../lib/errors.js'

// ============================================================
// LOGIN RATE LIMITER
// ============================================================

import { env } from '../config/env.js'

const LOGIN_MAX_ATTEMPTS = env.NODE_ENV === 'development' ? 200 : 10
const LOGIN_WINDOW_SECONDS = 900 // 15 minutes

const memoryRateLimit = new Map<string, { count: number; expiresAt: number }>()

export async function loginRateLimiter(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown'
    const key = `rate:login:${ip}`

    try {
      const current = await redis.incr(key)

      if (current === 1) {
        await redis.expire(key, LOGIN_WINDOW_SECONDS)
      }

      if (current > LOGIN_MAX_ATTEMPTS) {
        const ttl = await redis.ttl(key)
        res.setHeader('Retry-After', String(ttl > 0 ? ttl : LOGIN_WINDOW_SECONDS))
        throw new AppError(
          'rate_limit_exceeded',
          'Too many login attempts. Try again in 15 minutes.',
          429,
        )
      }

      next()
    } catch (redisErr) {
      if (redisErr instanceof AppError) throw redisErr

      // In-memory fallback if Redis is unavailable
      const now = Date.now()
      const record = memoryRateLimit.get(key)

      if (!record || record.expiresAt < now) {
        memoryRateLimit.set(key, { count: 1, expiresAt: now + LOGIN_WINDOW_SECONDS * 1000 })
        next()
        return
      }

      record.count += 1

      if (record.count > LOGIN_MAX_ATTEMPTS) {
        const retryAfter = Math.ceil((record.expiresAt - now) / 1000)
        res.setHeader('Retry-After', String(retryAfter > 0 ? retryAfter : LOGIN_WINDOW_SECONDS))
        throw new AppError(
          'rate_limit_exceeded',
          'Too many login attempts. Try again in 15 minutes.',
          429,
        )
      }

      next()
    }
  } catch (err) {
    next(err)
  }
}

// ============================================================
// DOWNLOAD RATE LIMITER
// ============================================================

const DOWNLOAD_MAX_PER_HOUR = 100
const DOWNLOAD_WINDOW_SECONDS = 3600 // 1 hour

export async function downloadRateLimiter(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id

    if (!userId) {
      next()
      return
    }

    try {
      const hourKey = `rate:download:${userId}`
      const hourCount = await redis.incr(hourKey)

      if (hourCount === 1) {
        await redis.expire(hourKey, DOWNLOAD_WINDOW_SECONDS)
      }

      if (hourCount > DOWNLOAD_MAX_PER_HOUR) {
        const ttl = await redis.ttl(hourKey)
        res.setHeader('Retry-After', String(ttl > 0 ? ttl : DOWNLOAD_WINDOW_SECONDS))
        throw new AppError(
          'download_limit_exceeded',
          'Download limit reached. Max 100 per hour.',
          429,
        )
      }

      next()
    } catch (redisErr) {
      if (redisErr instanceof AppError) throw redisErr
      next() // Bypass if Redis is unavailable in dev
    }
  } catch (err) {
    next(err)
  }
}

const GLOBAL_LIMIT = 200  // requests per minute per IP
const GLOBAL_WINDOW = 60

export async function globalRateLimiter(req: Request, res: Response, next: NextFunction): Promise<void> {
  const ip = req.ip || 'unknown'
  const key = `rate:global:${ip}`
  const count = await redis.incr(key)
  if (count === 1) await redis.expire(key, GLOBAL_WINDOW)
  if (count > GLOBAL_LIMIT) {
    res.setHeader('Retry-After', String(GLOBAL_WINDOW))
    return next(new AppError('rate_limit_exceeded', 'Too many requests', 429))
  }
  next()
}


const REGISTER_MAX = 5    // 5 registrations per hour per IP
const REGISTER_WINDOW = 3600
export async function registerRateLimiter(req: Request, res: Response, next: NextFunction): Promise<void> {
  const key = `rate:register:${req.ip}`
  const count = await redis.incr(key)
  if (count === 1) await redis.expire(key, REGISTER_WINDOW)
  if (count > REGISTER_MAX) throw new AppError('rate_limit_exceeded', 'Too many registration attempts', 429)
  next()
}

const REFRESH_MAX = 20  
const REFRESH_WINDOW = 3600
export async function refreshRateLimiter(req:Request,res:Response,next:NextFunction):Promise<void>{
  const key= `rate:refresh:${req.ip}`
  const count = await redis.incr(key)
   if (count === 1) await redis.expire(key, REFRESH_WINDOW)
  if (count > REFRESH_MAX) throw new AppError('rate_limit_exceeded', 'Too many refresh attempts', 429)
  next()


}