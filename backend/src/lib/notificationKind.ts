// One classification for every notification, used by every list/filter.
// Before this, the UI guessed from `type` + `category` in several places and the guesses
// disagreed (event/file notices leaked into the Broadcast filter, critical broadcasts didn't).
//
// Writers set `category` to one of: 'broadcast' (admin-composed broadcasts only), 'event',
// 'file', 'access'/'account'. Older broadcast rows used the urgency as category, so those
// values are still recognised as broadcasts.

export type NotificationKind = 'broadcast' | 'event' | 'file' | 'account' | 'system'

export const BROADCAST_CATEGORY = 'broadcast'

// Categories written by the admin broadcast composer before this change (urgency.toLowerCase()).
const LEGACY_BROADCAST_CATEGORIES = ['broadcast', 'standard', 'tracking', 'maintenance', 'critical', 'notice', 'telemetry', 'system']

/** Prisma `where` fragment selecting admin broadcasts only (MySQL comparison is case-insensitive). */
export const BROADCAST_WHERE = { category: { in: LEGACY_BROADCAST_CATEGORIES } }

export function notificationKind(n: { category?: string | null; type?: string | null }): NotificationKind {
  const cat = (n.category || '').toLowerCase()
  if (cat === 'event' || cat === 'events') return 'event'
  if (cat === 'file') return 'file'
  if (cat === 'access' || cat === 'account' || cat === 'security') return 'account'
  if (LEGACY_BROADCAST_CATEGORIES.includes(cat)) return 'broadcast'
  return 'system'
}

/** Reads the metadata JSON regardless of whether it was stored as an object or a string. */
export function parseMetadata(raw: unknown): Record<string, any> {
  if (!raw) return {}
  if (typeof raw === 'object') return raw as Record<string, any>
  try {
    const parsed = JSON.parse(String(raw))
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/** Custom broadcast category label stored with the broadcast (BUG-12). */
export function broadcastLabel(n: { metadata?: unknown }): string | null {
  const label = parseMetadata(n.metadata).label
  return typeof label === 'string' && label.trim() ? label.trim() : null
}
