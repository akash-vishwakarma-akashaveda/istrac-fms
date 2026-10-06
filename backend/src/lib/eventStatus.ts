// A mission event's lifecycle state follows its schedule. Only CANCELLED and COMPLETED are
// set by people; everything else is derived from eventDate/endDate so that editing the dates
// (e.g. moving a timed-out event into the future) immediately puts it back in the right list.
export const MANUAL_EVENT_STATUSES = ['CANCELLED', 'COMPLETED'] as const

export function deriveEventStatus(
  e: { status?: string | null; eventDate: Date | string; endDate?: Date | string | null },
  now = new Date(),
): string {
  if (e.status && (MANUAL_EVENT_STATUSES as readonly string[]).includes(e.status)) return e.status
  const start = new Date(e.eventDate)
  const end = e.endDate ? new Date(e.endDate) : null
  if (start > now) return 'UPCOMING'
  if (end && end <= now) return 'TIMED_OUT'
  return 'IN_PROGRESS'
}

/** Returns the event with its status recomputed for the current moment. */
export function withLiveStatus<T extends { status: string; eventDate: Date; endDate: Date | null }>(e: T, now = new Date()): T {
  return { ...e, status: deriveEventStatus(e, now) }
}
