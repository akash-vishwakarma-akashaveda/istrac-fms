import { redis } from './config/redis.js'
import { startMissionEventWorker } from './jobs/mission-event.worker.js'

async function run() {
  if (redis.status !== 'ready') {
    try {
      await Promise.race([
        new Promise<void>((resolve) => redis.once('ready', () => resolve())),
        new Promise<void>((_, reject) => {
          redis.once('error', (err) => reject(err))
          setTimeout(() => reject(new Error('Redis timeout')), 800)
        }),
      ])
    } catch {
      console.log('[Scheduler] Redis is offline. Operating in standalone in-memory scheduler mode.')
    }
  }

  await startMissionEventWorker()
}

run().catch((err) => {
  console.error('[Scheduler] Worker startup failed:', err)
  process.exit(1)
})