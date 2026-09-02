import { Router } from 'express'
import { redis } from '../config/redis.js'
import {
  authMiddleware,
} from '../middleware/auth.middleware.js'
import {
  adminMiddleware,
} from '../middleware/admin.middleware.js'
import { AppError } from '../lib/errors.js'

const router = Router()

const INTERVAL_KEY =
  'scheduler:mission-events:interval'

const ALLOWED_INTERVALS = [
  1,
  5,
  10,
  30,
  60,
]

// ============================================================
// GET CURRENT SCHEDULER CONFIGURATION
// ============================================================

router.get(
  '/mission-events',
  authMiddleware,
  adminMiddleware,
  async (req, res, next) => {
    try {
      const value =
        await redis.get(INTERVAL_KEY)

      const interval = value
        ? Number(value)
        : 1

      res.json({
        data: {
          interval,
          unit: 'minutes',
        },
        requestId: req.requestId,
      })
    } catch (err) {
      next(err)
    }
  }
)

// ============================================================
// UPDATE SCHEDULER INTERVAL
// ============================================================

router.put(
  '/mission-events',
  authMiddleware,
  adminMiddleware,
  async (req, res, next) => {
    try {
      const interval =
        Number(req.body.interval)

      if (
        !Number.isInteger(interval) ||
        !ALLOWED_INTERVALS.includes(interval)
      ) {
        throw new AppError(
          'invalid_scheduler_interval',
          'Interval must be 1, 5, 10, 30 or 60 minutes',
          400
        )
      }

      await redis.set(
        INTERVAL_KEY,
        String(interval)
      )

      res.json({
        data: {
          interval,
          unit: 'minutes',
          message:
            'Mission event scheduler updated successfully',
        },
        requestId: req.requestId,
      })
    } catch (err) {
      next(err)
    }
  }
)

export {
  router as schedulerRouter,
}