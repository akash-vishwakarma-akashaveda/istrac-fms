import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { env } from '../config/env.js'
import { redis } from '../config/redis.js'
import { emailService } from './email.service.js'

const PROBE_FILE_NAME = '.health_probe'
const HDD_DEGRADED_KEY = 'hdd:degraded'

let hasAlerted = false
let intervalTimer: NodeJS.Timeout | null = null

async function runProbe(): Promise<void> {
  const mountRoot = path.resolve(env.HDD_MOUNT_PATH)
  const probePath = path.join(mountRoot, PROBE_FILE_NAME)

  try {
    // 1. Write probe test
    await fs.mkdir(mountRoot, { recursive: true })
    await fs.writeFile(probePath, `probe-${Date.now()}`)
    // 2. Read probe test
    await fs.readFile(probePath, 'utf8')
    // 3. Remove probe test
    await fs.unlink(probePath).catch(() => {})

    // Storage is healthy
    let wasDegraded: string | null = null
    try {
      wasDegraded = await redis.get(HDD_DEGRADED_KEY)
      if (wasDegraded || hasAlerted) {
        await redis.del(HDD_DEGRADED_KEY)
      }
    } catch {}

    if (wasDegraded || hasAlerted) {
      hasAlerted = false
      emailService.sendAdminAlert(
        'Storage System Recovered',
        `HDD mount at ${mountRoot} has passed health check and is back online.`,
      )
    }
  } catch (err: any) {
    console.error('[HddHealthService] Storage probe check failed:', err.message)

    try {
      await redis.setex(HDD_DEGRADED_KEY, 120, '1')
    } catch {}

    if (!hasAlerted) {
      hasAlerted = true
      emailService.sendAdminAlert(
        'CRITICAL: Storage System Offline or Degraded',
        `Storage probe failed on path: ${mountRoot}\nError: ${err.message}`,
      )
    }
  }
}

export function startHddHealthService(): void {
  if (intervalTimer) return
  runProbe().catch(() => {})
  intervalTimer = setInterval(() => {
    runProbe().catch((err) => console.error('[HddHealthService] Interval error:', err))
  }, 60000)
}

export async function isHddDegraded(): Promise<boolean> {
  try {
    const degraded = await redis.get(HDD_DEGRADED_KEY)
    return degraded === '1'
  } catch {
    return false
  }
}
