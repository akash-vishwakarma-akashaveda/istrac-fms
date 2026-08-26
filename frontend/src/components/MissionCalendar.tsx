import { useState, useMemo, useEffect } from 'react'
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Building,
  Radio,
  X,
  ArrowRight,
} from 'lucide-react'
import { useCms, DEFAULT_CMS_BLOCKS } from '../context/cmsContext'
import { eventsApi } from '../api/events.api'

export interface MissionEvent {
  id: string
  title: string
  subtitle?: string
  date: string // YYYY-MM-DD
  time: string
  category: 'PASS' | 'MANEUVER' | 'MAINTENANCE' | 'SPECIAL' | 'OTHER'
  department?: string
  station?: string
  description?: string
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const DAYS_OF_WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

export interface MissionCalendarProps {
  isEmbedded?: boolean
  title?: string
  hideViewAll?: boolean
  className?: string
}

export function MissionCalendar({
  isEmbedded = false,
  title = 'Upcoming Events',
  hideViewAll = false,
  className = '',
}: MissionCalendarProps = {}) {
  const { cmsBlocks } = useCms()
  const calData = cmsBlocks['calendar_events'] as
    | {
        events?: MissionEvent[]
      }
    | undefined

  const fallbackData = DEFAULT_CMS_BLOCKS['calendar_events'] as {
    events: MissionEvent[]
  }

  const [serverEvents, setServerEvents] = useState<MissionEvent[]>([])

  useEffect(() => {
    eventsApi
      .getEvents()
      .then((data) => {
        if (data && data.length > 0) {
          const mapped: MissionEvent[] = data.map((ev) => {
            const dateObj = new Date(ev.eventDate)
            const dateStr = dateObj.toISOString().split('T')[0]
            const timeStr =
              dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) +
              ' UTC'

            let cat: MissionEvent['category'] = 'PASS'
            if (ev.eventType === 'ORBIT_MANEUVER') cat = 'MANEUVER'
            else if (ev.eventType === 'MAINTENANCE') cat = 'MAINTENANCE'
            else if (ev.eventType === 'SEMINAR') cat = 'SPECIAL'
            else if (ev.eventType === 'LAUNCH') cat = 'SPECIAL'

            return {
              id: ev.id,
              title: ev.title,
              subtitle: ev.satellite?.name ? `${ev.satellite.name} Operations` : ev.location || 'ISTRAC MOX',
              date: dateStr,
              time: timeStr,
              category: cat,
              department: ev.department?.name || 'Operations',
              station: ev.location || 'ISTRAC Bengaluru',
              description: ev.description || undefined,
            }
          })
          setServerEvents(mapped)
        }
      })
      .catch(() => {})
  }, [])

  const rawEvents = useMemo(() => {
    if (serverEvents.length > 0) {
      return serverEvents
    }
    return calData?.events ?? fallbackData.events ?? []
  }, [serverEvents, calData, fallbackData])

  // Dual-month navigation: month1 and month2 (defaulting to current real month)
  const [baseDate, setBaseDate] = useState(() => new Date())
  const [activeModalEvent, setActiveModalEvent] = useState<MissionEvent | null>(null)

  // Month 1 & Month 2 dates
  const year1 = baseDate.getFullYear()
  const month1 = baseDate.getMonth()

  const date2 = new Date(year1, month1 + 1, 1)
  const year2 = date2.getFullYear()
  const month2 = date2.getMonth()

  const prevMonth = () => setBaseDate(new Date(year1, month1 - 1, 1))
  const nextMonth = () => setBaseDate(new Date(year1, month1 + 1, 1))

  // Map events to date strings
  const eventsByDate = useMemo(() => {
    const map: Record<string, MissionEvent[]> = {}
    rawEvents.forEach((ev) => {
      if (!map[ev.date]) map[ev.date] = []
      map[ev.date].push(ev)
    })
    return map
  }, [rawEvents])

  // Generator for 35 or 42 grid cells starting Sunday
  const getMonthGrid = (y: number, m: number) => {
    const firstDayIndex = new Date(y, m, 1).getDay() // 0 = Sun, 1 = Mon ...
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    const daysInPrevMonth = new Date(y, m, 0).getDate()

    const days: { dayNumber: number; isCurrentMonth: boolean; dateString: string }[] = []

    // Previous month filler
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i
      const prevM = m === 0 ? 12 : m
      const prevY = m === 0 ? y - 1 : y
      const dateString = `${prevY}-${String(prevM).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      days.push({ dayNumber: d, isCurrentMonth: false, dateString })
    }

    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
      const dateString = `${y}-${String(m + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      days.push({ dayNumber: i, isCurrentMonth: true, dateString })
    }

    // Next month filler
    const total = days.length <= 35 ? 35 : 42
    const remaining = total - days.length
    for (let i = 1; i <= remaining; i++) {
      const nextM = m === 11 ? 1 : m + 2
      const nextY = m === 11 ? y + 1 : y
      const dateString = `${nextY}-${String(nextM).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      days.push({ dayNumber: i, isCurrentMonth: false, dateString })
    }

    return days
  }

  const month1Days = useMemo(() => getMonthGrid(year1, month1), [year1, month1])
  const month2Days = useMemo(() => getMonthGrid(year2, month2), [year2, month2])

  const calendarContent = (
    <div className={`rounded-2xl border border-border-default bg-[#0b1220]/95 p-6 shadow-2xl backdrop-blur-md ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-subtle/70 pb-4">
        <div className="flex items-center gap-2.5 text-text-primary">
          <CalendarIcon size={18} className="text-accent-light" />
          <h2 id="calendar-title" className="text-base font-bold tracking-wide text-white">
            {title}
          </h2>
        </div>

        {!hideViewAll && (
          <a
            href="#calendar"
            className="text-xs font-semibold text-accent-light hover:underline flex items-center gap-1"
          >
            <span>View All Events</span>
            <ArrowRight size={13} />
          </a>
        )}
      </div>

      {/* Dual Month Calendar Grids */}
      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        {/* MONTH 1 */}
        <MonthBlock
          year={year1}
          month={month1}
          days={month1Days}
          eventsByDate={eventsByDate}
          onPrev={prevMonth}
          onNext={nextMonth}
          onSelectEvent={(ev) => setActiveModalEvent(ev)}
        />

        {/* MONTH 2 */}
        <MonthBlock
          year={year2}
          month={month2}
          days={month2Days}
          eventsByDate={eventsByDate}
          onPrev={prevMonth}
          onNext={nextMonth}
          onSelectEvent={(ev) => setActiveModalEvent(ev)}
        />
      </div>

      {/* Bottom Legend */}
      <div className="mt-8 flex flex-wrap items-center gap-6 border-t border-border-subtle/70 pt-5 text-xs text-text-muted">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-nominal" />
          <span>Pass Window</span>
        </span>

        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-orange-400" />
          <span>Maneuver</span>
        </span>

        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-accent" />
          <span>Maintenance Window</span>
        </span>

        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-purple-500" />
          <span>Special Activity</span>
        </span>

        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-text-dim" />
          <span>Other Event</span>
        </span>
      </div>
    </div>
  )

  if (isEmbedded) {
    return (
      <div className="space-y-4">
        {calendarContent}
        {activeModalEvent && (
          <EventDetailsModal
            event={activeModalEvent}
            onClose={() => setActiveModalEvent(null)}
          />
        )}
      </div>
    )
  }

  return (
    <section id="calendar" className="border-b border-border-subtle bg-page py-12 sm:py-16" aria-labelledby="calendar-title">
      <div className="shell">
        {calendarContent}
      </div>

      {/* Details Modal on Click or Hover */}
      {activeModalEvent && (
        <EventDetailsModal
          event={activeModalEvent}
          onClose={() => setActiveModalEvent(null)}
        />
      )}
    </section>
  )
}

function MonthBlock({
  year,
  month,
  days,
  eventsByDate,
  onPrev,
  onNext,
  onSelectEvent,
}: {
  year: number
  month: number
  days: { dayNumber: number; isCurrentMonth: boolean; dateString: string }[]
  eventsByDate: Record<string, MissionEvent[]>
  onPrev: () => void
  onNext: () => void
  onSelectEvent: (ev: MissionEvent) => void
}) {
  return (
    <div className="rounded-xl border border-border-subtle/80 bg-[#0d1629] p-4">
      {/* Month Title & Nav */}
      <div className="flex items-center justify-between pb-3">
        <button
          type="button"
          onClick={onPrev}
          aria-label="Previous month"
          className="rounded-lg border border-border-subtle bg-surface p-1 text-text-muted hover:text-text-primary transition-colors"
        >
          <ChevronLeft size={16} />
        </button>

        <h3 className="text-sm font-bold text-text-primary tracking-wider">
          {MONTH_NAMES[month]} {year}
        </h3>

        <button
          type="button"
          onClick={onNext}
          aria-label="Next month"
          className="rounded-lg border border-border-subtle bg-surface p-1 text-text-muted hover:text-text-primary transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Weekday Row */}
      <div className="grid grid-cols-7 text-center text-[10px] font-bold text-text-dim py-2">
        {DAYS_OF_WEEK.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      {/* Day Cells Grid */}
      <div className="grid grid-cols-7 gap-y-2.5 text-center text-xs">
        {days.map((cd, idx) => {
          const dayEvents = eventsByDate[cd.dateString] || []
          const hasEvents = dayEvents.length > 0

          // Check if there's a primary filled badge event (e.g. Maintenance -> Blue, Special -> Purple)
          const isMaintenance = dayEvents.some((e) => e.category === 'MAINTENANCE')
          const isSpecial = dayEvents.some((e) => e.category === 'SPECIAL')

          return (
            <div
              key={`${cd.dateString}-${idx}`}
              className="flex flex-col items-center justify-center py-1 relative group cursor-pointer"
              onClick={() => {
                if (hasEvents) onSelectEvent(dayEvents[0])
              }}
            >
              {/* Day Number / Circle */}
              <span
                className={`num flex h-7 w-7 items-center justify-center text-xs font-semibold transition-all ${
                  !cd.isCurrentMonth
                    ? 'text-text-dim/40'
                    : isSpecial
                    ? 'rounded-full bg-purple-600 text-white font-bold shadow-md shadow-purple-600/30'
                    : isMaintenance
                    ? 'rounded-full bg-accent text-white font-bold shadow-md shadow-accent/30'
                    : hasEvents
                    ? 'text-text-primary font-bold group-hover:text-accent-light'
                    : 'text-text-secondary group-hover:text-text-primary'
                }`}
              >
                {cd.dayNumber}
              </span>

              {/* Indicator Dots Below Day */}
              {cd.isCurrentMonth && hasEvents && !isMaintenance && !isSpecial && (
                <div className="mt-1 flex items-center justify-center gap-1">
                  {dayEvents.map((ev, i) => (
                    <span
                      key={i}
                      className={`h-1.5 w-1.5 rounded-full ${
                        ev.category === 'PASS'
                          ? 'bg-nominal'
                          : ev.category === 'MANEUVER'
                          ? 'bg-orange-400'
                          : ev.category === 'MAINTENANCE'
                          ? 'bg-accent'
                          : ev.category === 'SPECIAL'
                          ? 'bg-purple-500'
                          : 'bg-text-muted'
                      }`}
                    />
                  ))}
                </div>
              )}

              {/* Hover Tooltip Preview */}
              {hasEvents && (
                <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden w-48 rounded-lg border border-border-default bg-card p-2.5 text-left text-xs shadow-2xl z-30 group-hover:block animate-rise">
                  <p className="font-bold text-text-primary text-[11px] truncate">
                    {dayEvents[0].title}
                  </p>
                  <p className="num text-[10px] text-accent-light mt-0.5">{dayEvents[0].time}</p>
                  {dayEvents[0].station && (
                    <p className="num text-[9px] text-text-dim mt-0.5">📍 {dayEvents[0].station}</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EventDetailsModal({
  event,
  onClose,
}: {
  event: MissionEvent
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-page/85 backdrop-blur-sm animate-rise">
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border-default bg-[#0d1629] shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle bg-[#111c34] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 border border-accent/30 text-accent-light">
              <CalendarIcon size={18} />
            </div>
            <div>
              <span className="eyebrow text-accent-light block text-[10px]">
                {event.category} EVENT
              </span>
              <h3 className="text-sm font-bold text-text-primary leading-snug">
                {event.title}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-text-dim hover:bg-card-hover hover:text-text-primary transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {event.subtitle && (
            <p className="text-xs font-semibold text-text-secondary">
              {event.subtitle}
            </p>
          )}

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-border-subtle bg-surface/80 p-4 text-xs">
            <div className="flex items-center gap-2">
              <Clock size={15} className="text-accent-light shrink-0" />
              <div>
                <span className="eyebrow block text-[9px] text-text-dim">Date & Time</span>
                <span className="num font-semibold text-text-primary">
                  {event.date} · {event.time}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <MapPin size={15} className="text-nominal shrink-0" />
              <div>
                <span className="eyebrow block text-[9px] text-text-dim">Station / Venue</span>
                <span className="num font-semibold text-text-primary">
                  {event.station || 'ISTRAC Ground Complex'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Building size={15} className="text-warning shrink-0" />
              <div>
                <span className="eyebrow block text-[9px] text-text-dim">Division</span>
                <span className="num font-semibold text-text-primary">
                  {event.department || 'Operations Team'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Radio size={15} className="text-accent-light shrink-0" />
              <div>
                <span className="eyebrow block text-[9px] text-text-dim">Status</span>
                <span className="num font-semibold text-nominal">● CONFIRMED SCHEDULE</span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <h4 className="eyebrow text-text-dim">Event Agenda & Notes</h4>
            <p className="mt-1.5 text-xs leading-relaxed text-text-secondary rounded-lg border border-border-subtle bg-surface/50 p-3">
              {event.description ||
                'Standard mission operations event scheduled as per ISTRAC master tracking protocol.'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border-subtle bg-[#111c34] px-6 py-3 text-[11px] text-text-dim">
          <span className="num">ISTRAC OPERATIONS MASTER SCHEDULE</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border-default bg-card px-3 py-1 text-xs font-semibold text-text-secondary hover:text-text-primary hover:border-border-bright transition-colors"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  )
}
