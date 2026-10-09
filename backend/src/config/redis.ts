import { Redis } from 'ioredis'
import { env } from './env.js'
import { logger } from '../lib/logger.js'

const redisOptions = {
  maxRetriesPerRequest: 1,
  retryStrategy(times: number) {
    // Reconnect with backoff up to 3s
    return Math.min(times * 200, 3000)
  },
  reconnectOnError: (err: Error) => {
    const targetError = 'READONLY'
    if (err.message.includes(targetError)) {
      return true
    }
    return false
  },
  enableOfflineQueue: false,
  lazyConnect: false,
}

export const redis = new Redis(env.REDIS_URL, redisOptions)
export const redisPub = new Redis(env.REDIS_URL, redisOptions)
export const redisSub = new Redis(env.REDIS_URL, redisOptions)

redis.on('connect', () => {
  logger.info('[Redis] Client connected to Redis server')
})
// ioredis emits an error on every reconnect attempt (every 1-3 s while Redis is down).
// Log once per outage plus a reminder every 10 minutes, instead of flooding the journal.
let outageSince: number | null = null
let lastReminder = 0
redis.on('ready', () => {
  if (outageSince !== null) {
    logger.info(`[Redis] Connection restored after ${Math.round((Date.now() - outageSince) / 1000)}s`)
  }
  outageSince = null
  logger.info('[Redis] Client ready for distributed rate-limiting and cache operations')
})
redis.on('error', (err: Error & { code?: string }) => {
  if (env.NODE_ENV === 'development') return // Redis is optional locally
  const now = Date.now()
  const detail = err.message || err.code || 'connection refused'
  if (outageSince === null) {
    outageSince = now
    lastReminder = now
    logger.warn(`[Redis] Unavailable (${detail}). Using in-memory fallbacks; rate limits are per process until Redis returns.`)
  } else if (now - lastReminder > 10 * 60_000) {
    lastReminder = now
    logger.warn(`[Redis] Still unavailable after ${Math.round((now - outageSince) / 60_000)} min (${detail}).`)
  }
})
redisPub.on('error', () => {})
redisSub.on('error', () => {})