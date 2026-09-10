import { redisPub, redisSub } from '../config/redis.js'

type Handler = (message: string) => void
const handlers = new Map<string, Handler[]>()

export const pubsub = {
  async publish(channel: string, message: object) {
    const payload = JSON.stringify(message)
    try {
      await redisPub.publish(channel, payload)
    } catch {
      // In-memory local broadcast if Redis is offline
      const channelHandlers = handlers.get(channel) || []
      channelHandlers.forEach((h) => h(payload))
    }
  },

  subscribe(channel: string, handler: Handler) {
    if (!handlers.has(channel)) {
      handlers.set(channel, [])
      try {
        redisSub.subscribe(channel)
      } catch {
        // Fallback to in-memory subscription
      }
    }
    handlers.get(channel)!.push(handler)
  },
}

redisSub.on('message', (channel, message) => {
  const channelHandlers = handlers.get(channel) || []
  channelHandlers.forEach((h) => h(message))
})