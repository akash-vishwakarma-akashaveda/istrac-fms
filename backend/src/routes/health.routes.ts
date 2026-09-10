import { Router } from 'express'
import * as fs from 'node:fs/promises'
import { prisma } from '../config/db.js'
import { redis } from '../config/redis.js'
import { env } from '../config/env.js'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { adminMiddleware } from '../middleware/admin.middleware.js'

const router = Router()

// ============================================================
// SYSTEM LIVENESS & DEPENDENCY HEALTH PROBE
// ============================================================
router.get('/health', async (_req, res) => {
  const checks = await Promise.allSettled([
    // DB check
    prisma.$queryRaw`SELECT 1`,
    // Redis check
    redis.ping(),
    // HDD mount check
    fs.access(env.HDD_MOUNT_PATH, fs.constants.R_OK | fs.constants.W_OK),
  ])

  const dbOk = checks[0].status === 'fulfilled'
  const redisOk = checks[1].status === 'fulfilled'
  const hddOk = checks[2].status === 'fulfilled'

  const allHealthy = dbOk && redisOk && hddOk

  const responsePayload = {
    status: allHealthy ? 'ok' : 'degraded',
    db: dbOk ? 'ok' : 'error',
    redis: redisOk ? 'ok' : 'error',
    hdd: hddOk ? 'ok' : 'error',
    timestamp: new Date().toISOString(),
  }

  res.status(allHealthy ? 200 : 503).json(responsePayload)
})

// ============================================================
// ADMIN DETAILED HDD HEALTH REPORT
// ============================================================
router.get('/admin/health/hdd', authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    let mounted = false
    try {
      await fs.access(env.HDD_MOUNT_PATH, fs.constants.R_OK | fs.constants.W_OK)
      mounted = true
    } catch {
      mounted = false
    }

    const degradedFlag = await redis.get('hdd:degraded')

    res.json({
      data: {
        mounted,
        mountPath: env.HDD_MOUNT_PATH,
        isDegraded: degradedFlag === '1',
        lastChecked: new Date().toISOString(),
      },
    })
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'hdd_probe_error', message: err.message },
    })
  }
})

export { router as healthRouter }
