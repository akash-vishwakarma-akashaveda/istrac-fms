import { Redis } from 'ioredis'
import { env } from './env.js'

const redisOptions = {
  maxRetriesPerRequest: 1,
  retryStrategy(times: number) {
    if (times > 3) return null // Stop retrying after 3 attempts in local dev if Redis isn't running
    return Math.min(times * 100, 2000)
  },
  reconnectOnError: () => false,
  enableOfflineQueue: false,
}

export const redis = new Redis(env.REDIS_URL, redisOptions)
export const redisPub = new Redis(env.REDIS_URL, redisOptions)
export const redisSub = new Redis(env.REDIS_URL, redisOptions)

redis.on('error', (err) => {
  if (env.NODE_ENV === 'development') {
    // Suppress spam in local dev
  } else {
    console.error('Redis client error:', err)
  }
})
redisPub.on('error', () => {})
redisSub.on('error', () => {})