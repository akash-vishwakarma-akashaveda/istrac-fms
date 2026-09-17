import { redis } from '../config/redis.js'
import { updateMissionEventStatuses } from './mission-event-status.job.js'

const INTERVAL_KEY =
  'scheduler:mission-events:interval'

const LOCK_KEY =
  'scheduler:mission-events:lock'

const DEFAULT_INTERVAL = 1

const ALLOWED_INTERVALS = [
  1,
  5,
  10,
  30,
  60,
]

const CONFIG_CHECK_INTERVAL = 10_000

const getInterval = async (): Promise<number> => {
  try {
    const value = await redis.get(INTERVAL_KEY)
    if (!value) return DEFAULT_INTERVAL
    const interval = Number(value)
    if (!ALLOWED_INTERVALS.includes(interval)) return DEFAULT_INTERVAL
    return interval
  } catch {
    return DEFAULT_INTERVAL
  }
}

const acquireLock = async (): Promise<boolean> => {
  try {
    const lockValue = `${process.pid}-${Date.now()}`
    const result = await redis.set(
      LOCK_KEY,
      lockValue,
      'EX',
      60,
      'NX'
    )
    return result === 'OK'
  } catch {
    // Standalone fallback: single worker holds execution lock
    return true
  }
}

export const startMissionEventWorker = async () => {
  console.log(
    '[Scheduler] Mission event worker started'
  )

  let lastRun = 0

  while (true) {
    try {
      const interval = await getInterval()

      const now = Date.now()

      const intervalMs =
        interval * 60 * 1000

      // Has enough time passed since the last execution?
      if (now - lastRun >= intervalMs) {
        const lockAcquired =
          await acquireLock()

        if (lockAcquired) {
          console.log(
            '[Scheduler] Running mission event status job'
          )

          await updateMissionEventStatuses()

          lastRun = now
        }
      }

      // Check Redis every 10 seconds.
      // This allows admin changes to be picked up quickly.
      await new Promise(resolve =>
        setTimeout(
          resolve,
          CONFIG_CHECK_INTERVAL
        )
      )
    } catch (error) {
      console.error(
        '[Scheduler] Worker error:',
        error
      )

      // Wait 10 seconds before trying again.
      await new Promise(resolve =>
        setTimeout(resolve, 10_000)
      )
    }
  }
}