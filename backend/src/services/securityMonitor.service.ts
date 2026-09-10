import { redis } from '../config/redis.js'
import { logger } from '../lib/logger.js'

const FAILURE_WINDOW_SECONDS = 5 * 60
const FAILURE_THRESHOLD = 20

export const securityMonitorService = {
  async recordAuthFailure(ip: string): Promise<void> {
    const normalizedIp = ip || 'unknown'
    const key = `security:auth-failures:${normalizedIp}`

    try {
      const count = await redis.incr(key)

      // Start the 5-minute window on the first failure.
      if (count === 1) {
        await redis.expire(key, FAILURE_WINDOW_SECONDS)
      }

      // Alert exactly when the threshold is reached.
      if (count === FAILURE_THRESHOLD) {
        logger.warn(
          'SECURITY',
          `Suspicious authentication activity detected: ${count} failed 401/403 responses from IP ${normalizedIp} within 5 minutes`,
        )
      }
    } catch (error) {
      // Security monitoring must never break the request.
      logger.error(
        'SECURITY',
        'Failed to record authentication failure',
        error,
      )
    }
  },
}