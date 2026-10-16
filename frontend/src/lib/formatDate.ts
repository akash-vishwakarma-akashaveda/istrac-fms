/**
 * Indian Standard Time (IST, UTC+05:30) date and time formatting utilities for ISTRAC-SIMS.
 * Ensures consistent, standardized mission timestamp displays across all consoles and reports.
 */

export const IST_TIMEZONE = 'Asia/Kolkata'

/**
 * Formats a date string or Date object into IST Date string: e.g. "03 Sep 2026"
 */
export function formatDateIST(dateInput: string | number | Date | null | undefined): string {
  if (!dateInput) return '—'
  const d = new Date(dateInput)
  if (isNaN(d.getTime())) return '—'

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

/**
 * Formats a date string or Date object into full IST Date & Time with explicit IST suffix:
 * e.g. "03 Sep 2026, 17:30 IST" or "03 Sep 2026, 17:30:45 IST"
 */
export function formatDateTimeIST(
  dateInput: string | number | Date | null | undefined,
  includeSeconds = false
): string {
  if (!dateInput) return '—'
  const d = new Date(dateInput)
  if (isNaN(d.getTime())) return '—'

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...(includeSeconds ? { second: '2-digit' } : {}),
    hour12: false,
  }).format(d)
}

/**
 * Formats into compact date: "DD/MM/YYYY"
 */
export function formatCompactDateIST(dateInput: string | number | Date | null | undefined): string {
  if (!dateInput) return '—'
  const d = new Date(dateInput)
  if (isNaN(d.getTime())) return '—'

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

/**
 * Formats only the time component: e.g. "17:30:45"
 */
export function formatTimeIST(dateInput: string | number | Date | null | undefined): string {
  if (!dateInput) return '—'
  const d = new Date(dateInput)
  if (isNaN(d.getTime())) return '—'

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d)
}
