export type DatePreset = 'ALL' | 'today' | 'yesterday' | '7days' | '30days' | '90days' | 'thisMonth' | 'thisYear' | 'custom'

export interface DateRangeValue {
  preset: DatePreset
  from: string // YYYY-MM-DD, only used for 'custom'
  to: string
}

export const EMPTY_DATE_RANGE: DateRangeValue = { preset: 'ALL', from: '', to: '' }

export const DATE_PRESET_OPTIONS: { value: DatePreset; label: string }[] = [
  { value: 'ALL', label: 'Any date' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7days', label: 'Last 7 days' },
  { value: '30days', label: 'Last 30 days' },
  { value: '90days', label: 'Last 90 days' },
  { value: 'thisMonth', label: 'This month' },
  { value: 'thisYear', label: 'This year' },
  { value: 'custom', label: 'Custom range…' },
]

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}
// Parse YYYY-MM-DD as a *local* date (new Date('2026-10-06') would be UTC midnight).
const parseLocal = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return y && m && d ? new Date(y, m - 1, d) : null
}

/**
 * Resolves a filter value to inclusive local-time bounds. Calendar presets use whole days,
 * so "Today" means since midnight rather than the last 24 hours.
 */
export function resolveDateRange(v: DateRangeValue): { start?: Date; end?: Date; error?: string } {
  const now = new Date()
  switch (v.preset) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) }
    case 'yesterday':
      return { start: startOfDay(daysAgo(1)), end: endOfDay(daysAgo(1)) }
    case '7days':
      return { start: startOfDay(daysAgo(6)), end: endOfDay(now) }
    case '30days':
      return { start: startOfDay(daysAgo(29)), end: endOfDay(now) }
    case '90days':
      return { start: startOfDay(daysAgo(89)), end: endOfDay(now) }
    case 'thisMonth':
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: endOfDay(now) }
    case 'thisYear':
      return { start: new Date(now.getFullYear(), 0, 1), end: endOfDay(now) }
    case 'custom': {
      const from = v.from ? parseLocal(v.from) : null
      const to = v.to ? parseLocal(v.to) : null
      if (from && to && from > to) return { error: 'The start date is after the end date.' }
      return { start: from ? startOfDay(from) : undefined, end: to ? endOfDay(to) : undefined }
    }
    default:
      return {}
  }
}

export function isInDateRange(iso: string, range: { start?: Date; end?: Date }): boolean {
  const t = new Date(iso).getTime()
  if (range.start && t < range.start.getTime()) return false
  if (range.end && t > range.end.getTime()) return false
  return true
}

export function isDateRangeActive(v: DateRangeValue): boolean {
  return v.preset !== 'ALL' && (v.preset !== 'custom' || Boolean(v.from || v.to))
}
