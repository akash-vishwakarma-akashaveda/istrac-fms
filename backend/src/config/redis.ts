import { Redis } from 'ioredis'
import { env } from './env.js'

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

redis.on('error', (err) => {
  if (env.NODE_ENV === 'development') {
    // Suppress spam in local dev
  } else {
    console.warn('[Redis] Connection warning (falling back to memory):', err.message)
  }
})
redisPub.on('error', () => {})
redisSub.on('error', () => {})