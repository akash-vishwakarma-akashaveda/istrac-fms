import { prisma } from '../config/db.js'
import { deriveEventStatus, MANUAL_EVENT_STATUSES } from '../lib/eventStatus.js'

// Persists the same rule the API applies on read (lib/eventStatus) so stored data stays tidy.
// Covers both directions: forward (UPCOMING -> IN_PROGRESS -> TIMED_OUT) and back
// (an event whose dates were moved into the future returns to UPCOMING).
export const updateMissionEventStatuses = async () => {
  const now = new Date()

  try {
    const candidates = await prisma.missionEvent.findMany({
      where: { deletedAt: null, status: { notIn: [...MANUAL_EVENT_STATUSES] } },
      select: { id: true, status: true, eventDate: true, endDate: true },
    })

    const changes = new Map<string, string[]>()
    for (const e of candidates) {
      const next = deriveEventStatus(e, now)
      if (next !== e.status) changes.set(next, [...(changes.get(next) ?? []), e.id])
    }

    for (const [next, ids] of changes) {
      await prisma.missionEvent.updateMany({ where: { id: { in: ids } }, data: { status: next } })
    }

    const count = (k: string) => changes.get(k)?.length ?? 0
    console.log(
      `[Mission Event Job] Ran status sync at ${now.toISOString()}: ` +
      `${count('UPCOMING')} → UPCOMING | ` +
      `${count('IN_PROGRESS')} → IN_PROGRESS | ` +
      `${count('TIMED_OUT')} → TIMED_OUT`
    )
  } catch (error) {
    console.error('[Mission Event Job] Failed to update statuses:', error)
    throw error
  }
}
