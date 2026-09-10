import { redis } from './config/redis.js' // adjust path to where your redis instance is exported
import { startMissionEventWorker } from './jobs/mission-event.worker.js'

async function run() {
  if (redis.status !== 'ready') {
    await new Promise<void>((resolve, reject) => {
      redis.once('ready', () => resolve())
      redis.once('error', (err) => reject(err))
    })
  }

  await startMissionEventWorker()
}

run().catch((err) => {
  console.error('[Scheduler] Worker startup failed:', err)
  process.exit(1)
})