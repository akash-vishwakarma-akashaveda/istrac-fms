export type NotificationKind = 'broadcast' | 'event' | 'file' | 'account' | 'system'

/**
 * The server sends `kind` on every notification (backend lib/notificationKind.ts). This
 * fallback only covers payloads that lack it (e.g. a live socket message) and mirrors the
 * server rule: classify by `category`, never by message text or `type`.
 */
export function kindOf(n: { kind?: string | null; category?: string | null }): NotificationKind {
  if (n.kind) return n.kind as NotificationKind
  const cat = (n.category || '').toLowerCase()
  if (cat === 'event' || cat === 'events') return 'event'
  if (cat === 'file') return 'file'
  if (cat === 'access' || cat === 'account' || cat === 'security') return 'account'
  if (['broadcast', 'standard', 'tracking', 'maintenance', 'critical', 'notice', 'telemetry', 'system'].includes(cat)) return 'broadcast'
  return 'system'
}
