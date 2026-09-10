import * as fs from 'node:fs/promises'
import type { Request, Response, NextFunction } from 'express'
import { env } from '../config/env.js'
import { redis } from '../config/redis.js'
import { pubsub } from '../lib/pubsub.js'
import { AppError } from '../lib/errors.js'

// ============================================================
// HDD AVAILABILITY MIDDLEWARE
// ============================================================

const HDD_CACHE_KEY = 'hdd:available'
const HDD_CACHE_TTL_SECONDS = 30

export async function hddAvailabilityMiddleware(
  _req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    try {
      const cached = await redis.get(HDD_CACHE_KEY)
      if (cached === 'ok') {
        next()
        return
      }
      if (cached === 'fail') {
        throw new AppError('hdd_unavailable', 'Storage is temporarily unavailable', 503)
      }
    } catch (cacheErr) {
      if (cacheErr instanceof AppError) throw cacheErr
      // Continue if Redis is offline
    }

    try {
      // Check read/write accessibility or create directory if missing in dev
      try {
        await fs.access(env.HDD_MOUNT_PATH, fs.constants.R_OK | fs.constants.W_OK)
      } catch (accessErr: any) {
        if (accessErr.code === 'ENOENT') {
          await fs.mkdir(env.HDD_MOUNT_PATH, { recursive: true })
        } else {
          throw accessErr
        }
      }

      try {
        await redis.setex(HDD_CACHE_KEY, HDD_CACHE_TTL_SECONDS, 'ok')
      } catch {}

      next()
    } catch {
      try {
        await redis.setex(HDD_CACHE_KEY, HDD_CACHE_TTL_SECONDS, 'fail')
      } catch {}

      pubsub
        .publish('admin.alert', {
          type: 'HDD_FAILURE',
          timestamp: new Date().toISOString(),
          mountPath: env.HDD_MOUNT_PATH,
        })
        .catch((err) => console.error('[HDD] Failed to publish admin alert:', err))

      throw new AppError('hdd_unavailable', 'Storage is temporarily unavailable', 503)
    }
  } catch (err) {
    next(err)
  }
}
