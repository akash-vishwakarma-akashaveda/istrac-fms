import { useState, useMemo, useEffect } from "react"
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  MapPin,
  X,
  ArrowRight,
  Activity,
  Layers,
} from "lucide-react"
import { Link } from "react-router-dom"
import { useCms } from "../context/cmsContext"
import { eventsApi } from "../api/events.api"

export interface MissionEvent {
  id: string
  title: string
  subtitle?: string
  date: string // YYYY-MM-DD
  time: string
  category: "PASS" | "MANEUVER" | "MAINTENANCE" | "SPECIAL" | "OTHER"
  department?: string
  station?: string
  description?: string
  urgency?: "NORMAL" | "IMPORTANT" | "CRITICAL"
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
]

const DAYS_OF_WEEK = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]

export interface MissionCalendarProps {
  isEmbedded?: boolean
  title?: string
  hideViewAll?: boolean
  className?: string
}

export function MissionCalendar({
  isEmbedded = false,
  title: propTitle,
  hideViewAll = false,
  className = "",
}: MissionCalendarProps = {}) {
  const { cmsBlocks } = useCms()
  const calConfig = cmsBlocks["calendar_events"] as
    | {
        title?: string
        subtitle?: string
        layoutMode?: "dual_month" | "month_agenda" | "timeline_list"
        showLegend?: boolean
        showQuickStats?: boolean
      }
    | undefined

  const sectionTitle = propTitle || calConfig?.title || "Upcoming Events & Mission Calendar"
  const sectionSubtitle = calConfig?.subtitle || "Live tracking passes, orbit maneuvers, and ground station maintenance."
  const layoutMode = calConfig?.layoutMode || "dual_month"
  const showLegend = calConfig?.showLegend !== false
  const showQuickStats = calConfig?.showQuickStats !== false

  const [serverEvents, setServerEvents] = useState<MissionEvent[]>([])

  // Fetch real events directly from backend API
  useEffect(() => {
    eventsApi
      .getEvents()
      .then((data) => {
        if (data && data.length > 0) {
          const mapped: MissionEvent[] = data.map((ev) => {
            const dateObj = new Date(ev.eventDate)
            const dateStr = dateObj.toISOString().split("T")[0]
            const timeStr =
              dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }) +
              " IST"

            let cat: MissionEvent["category"] = "PASS"
            if (ev.eventType === "ORBIT_MANEUVER") cat = "MANEUVER"
            else if (ev.eventType === "MAINTENANCE") cat = "MAINTENANCE"
            else if (ev.eventType === "SEMINAR" || ev.eventType === "LAUNCH") cat = "SPECIAL"

            return {
              id: ev.id,
              title: ev.title,
              subtitle: ev.satellite?.name ? `${ev.satellite.name} Operations` : ev.location || "ISTRAC MOX",
              date: dateStr,
              time: timeStr,
              category: cat,
              department: ev.department?.code || ev.department?.name || "Operations",
              station: ev.location || "ISTRAC Bengaluru",
              description: ev.description || undefined,
              urgency: ev.urgency,
            }
          })
          setServerEvents(mapped)
        } else {
          setServerEvents([])
        }
      })
      .catch(() => {
        setServerEvents([])
      })
  }, [])

  // Dual-month navigation
  const [baseDate, setBaseDate] = useState(() => new Date())
  const [selectedDateEvents, setSelectedDateEvents] = useState<{ date: string; events: MissionEvent[] } | null>(null)

  const year1 = baseDate.getFullYear()
  const month1 = baseDate.getMonth()

  const date2 = new Date(year1, month1 + 1, 1)
  const year2 = date2.getFullYear()
  const month2 = date2.getMonth()

  const prevMonth = () => setBaseDate(new Date(year1, month1 - 1, 1))
  const nextMonth = () => setBaseDate(new Date(year1, month1 + 1, 1))

  // Map events by date
  const eventsByDate = useMemo(() => {
    const map: Record<string, MissionEvent[]> = {}
    serverEvents.forEach((ev) => {
      if (!map[ev.date]) map[ev.date] = []
      map[ev.date].push(ev)
    })
    return map
  }, [serverEvents])

  // Month grid generator
  const getMonthGrid = (y: number, m: number) => {
    const firstDayIndex = new Date(y, m, 1).getDay()
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    const daysInPrevMonth = new Date(y, m, 0).getDate()
    const days: { dayNumber: number; isCurrentMonth: boolean; dateString: string }[] = []

    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i
      const prevM = m === 0 ? 12 : m
      const prevY = m === 0 ? y - 1 : y
      const dateString = `${prevY}-${String(prevM).padStart(2, "0")}-${String(d).padStart(2, "0")}`
      days.push({ dayNumber: d, isCurrentMonth: false, dateString })
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const dateString = `${y}-${String(m + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`
      days.push({ dayNumber: i, isCurrentMonth: true, dateString })
    }

    const total = days.length <= 35 ? 35 : 42
    const remaining = total - days.length
    for (let i = 1; i <= remaining; i++) {
      const nextM = m === 11 ? 1 : m + 2
      const nextY = m === 11 ? y + 1 : y
      const dateString = `${nextY}-${String(nextM).padStart(2, "0")}-${String(i).padStart(2, "0")}`
      days.push({ dayNumber: i, isCurrentMonth: false, dateString })
    }

    return days
  }

  const month1Days = useMemo(() => getMonthGrid(year1, month1), [year1, month1])
  const month2Days = useMemo(() => getMonthGrid(year2, month2), [year2, month2])

  // Sorted upcoming events for agenda and timeline
  const upcomingEvents = useMemo(() => {
    return [...serverEvents].sort((a, b) => a.date.localeCompare(b.date))
  }, [serverEvents])

  const calendarContent = (
    <div className={`rounded-2xl border border-border-default bg-[#0b1220]/95 p-6 shadow-2xl backdrop-blur-md ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border-subtle/70 pb-4 gap-2">
        <div className="flex items-center gap-2.5 text-text-primary">
          <CalendarIcon size={18} className="text-accent-light" />
          <div>
            <h2 id="calendar-title" className="text-base font-bold tracking-wide text-white">
              {sectionTitle}
            </h2>
            <p className="text-xs text-text-muted mt-0.5">{sectionSubtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {showQuickStats && serverEvents.length > 0 && (
            <span className="num hidden sm:inline-flex items-center gap-1 rounded-full bg-accent/15 border border-accent/30 px-2.5 py-1 text-[11px] font-bold text-accent-light">
              <Activity size={12} />
              {serverEvents.length} Active Events
            </span>
          )}

          {!hideViewAll && (
            <Link
              to="/admin/events"
              className="text-xs font-semibold text-accent-light hover:underline flex items-center gap-1 shrink-0"
            >
              <span>Manage Events</span>
              <ArrowRight size={13} />
            </Link>
          )}
        </div>
      </div>

      {/* ── LAYOUT 1: DUAL MONTH CALENDAR ── */}
      {layoutMode === "dual_month" && (
        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          <MonthBlock
            year={year1}
            month={month1}
            days={month1Days}
            eventsByDate={eventsByDate}
            onPrev={prevMonth}
            onNext={nextMonth}
            onSelectDate={(date, evs) => setSelectedDateEvents({ date, events: evs })}
          />
          <MonthBlock
            year={year2}
            month={month2}
            days={month2Days}
            eventsByDate={eventsByDate}
            onPrev={prevMonth}
            onNext={nextMonth}
            onSelectDate={(date, evs) => setSelectedDateEvents({ date, events: evs })}
          />
        </div>
      )}

      {/* ── LAYOUT 2: MONTH + AGENDA LIST ── */}
      {layoutMode === "month_agenda" && (
        <div className="mt-6 grid gap-6 lg:grid-cols-12 items-start">
          <div className="lg:col-span-7">
            <MonthBlock
              year={year1}
              month={month1}
              days={month1Days}
              eventsByDate={eventsByDate}
              onPrev={prevMonth}
              onNext={nextMonth}
              onSelectDate={(date, evs) => setSelectedDateEvents({ date, events: evs })}
            />
          </div>
          <div className="lg:col-span-5 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-dim px-1 flex items-center justify-between">
              <span>Upcoming Agenda Feed</span>
              <span className="num text-[10px] text-accent-light">{upcomingEvents.length} events</span>
            </h4>
            <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1 scrollbar-none">
              {upcomingEvents.length === 0 ? (
                <div className="py-12 text-center text-xs text-text-dim border border-dashed border-border-subtle rounded-xl">
                  No upcoming events scheduled in database.
                </div>
              ) : (
                upcomingEvents.map((ev) => (
                  <div
                    key={ev.id}
                    onClick={() => setSelectedDateEvents({ date: ev.date, events: [ev] })}
                    className="p-3 rounded-xl border border-border-subtle bg-[#0d1629] hover:border-accent/40 hover:bg-[#111c34] cursor-pointer transition-all space-y-1.5 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-accent/20 text-accent-light">
                        {ev.category}
                      </span>
                      <span className="num text-[10px] text-text-dim">{ev.date} · {ev.time}</span>
                    </div>
                    <div className="text-xs font-semibold text-white truncate">{ev.title}</div>
                    <div className="flex items-center gap-2 text-[10px] text-text-dim num">
                      <span>📍 {ev.station}</span>
                      <span>·</span>
                      <span className="text-accent-light font-semibold">{ev.department}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── LAYOUT 3: TIMELINE & OPERATIONAL PASSES ── */}
      {layoutMode === "timeline_list" && (
        <div className="mt-6 space-y-3">
          {upcomingEvents.length === 0 ? (
            <div className="py-16 text-center text-xs text-text-dim border border-dashed border-border-subtle rounded-2xl">
              No mission events found. Add events in the Events & Calendar section.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {upcomingEvents.map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => setSelectedDateEvents({ date: ev.date, events: [ev] })}
                  className="p-4 rounded-xl border border-border-default bg-[#0d1629] hover:border-accent/50 hover:bg-[#101c36] cursor-pointer transition-all flex flex-col justify-between space-y-3 shadow-md"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                      <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase num ${
                        ev.category === "PASS" ? "bg-nominal/20 text-nominal border border-nominal/30" :
                        ev.category === "MANEUVER" ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" :
                        ev.category === "MAINTENANCE" ? "bg-accent/20 text-accent-light border border-accent/30" :
                        "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                      }`}>
                        {ev.category}
                      </span>
                      <span className="num text-[11px] text-text-dim font-semibold">{ev.date}</span>
                    </div>
                    <h3 className="text-xs font-bold text-white leading-snug line-clamp-2">{ev.title}</h3>
                    {ev.description && (
                      <p className="text-[11px] text-text-secondary line-clamp-2 leading-relaxed">{ev.description}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-text-dim pt-2 border-t border-border-subtle/60 num">
                    <span>🕒 {ev.time}</span>
                    <span className="text-accent-light font-semibold">{ev.department}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bottom Legend */}
      {showLegend && (
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
            <span>Special Activity / Launch</span>
          </span>
        </div>
      )}
    </div>
  )

  if (isEmbedded) {
    return (
      <div className="space-y-4">
        {calendarContent}
        {selectedDateEvents && (
          <MultiEventModal
            date={selectedDateEvents.date}
            events={selectedDateEvents.events}
            onClose={() => setSelectedDateEvents(null)}
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

      {selectedDateEvents && (
        <MultiEventModal
          date={selectedDateEvents.date}
          events={selectedDateEvents.events}
          onClose={() => setSelectedDateEvents(null)}
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
  onSelectDate,
}: {
  year: number
  month: number
  days: { dayNumber: number; isCurrentMonth: boolean; dateString: string }[]
  eventsByDate: Record<string, MissionEvent[]>
  onPrev: () => void
  onNext: () => void
  onSelectDate: (date: string, evs: MissionEvent[]) => void
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
      <div className="grid grid-cols-7 gap-y-2 text-center text-xs">
        {days.map((cd, idx) => {
          const dayEvents = eventsByDate[cd.dateString] || []
          const hasEvents = dayEvents.length > 0

          const isMaintenance = dayEvents.some((e) => e.category === "MAINTENANCE")
          const isSpecial = dayEvents.some((e) => e.category === "SPECIAL")

          return (
            <div
              key={`${cd.dateString}-${idx}`}
              className="flex flex-col items-center justify-start min-h-[44px] py-1 relative group cursor-pointer"
              onClick={() => {
                if (hasEvents) onSelectDate(cd.dateString, dayEvents)
              }}
            >
              <div className="relative">
                <span
                  className={`num flex h-7 w-7 items-center justify-center text-xs font-semibold transition-all ${
                    !cd.isCurrentMonth
                      ? "text-text-dim/40"
                      : isSpecial
                      ? "rounded-full bg-purple-600 text-white font-bold shadow-md shadow-purple-600/30"
                      : isMaintenance
                      ? "rounded-full bg-accent text-white font-bold shadow-md shadow-accent/30"
                      : hasEvents
                      ? "text-text-primary font-bold group-hover:text-accent-light"
                      : "text-text-secondary group-hover:text-text-primary"
                  }`}
                >
                  {cd.dayNumber}
                </span>

                {/* Multiple Event Count Badge on Date (e.g. +3) */}
                {cd.isCurrentMonth && dayEvents.length > 1 && (
                  <span className="absolute -top-1 -right-2 h-4 min-w-4 px-1 rounded-full bg-accent text-white text-[9px] font-extrabold flex items-center justify-center border border-[#0d1629] shadow-sm">
                    {dayEvents.length}
                  </span>
                )}
              </div>

              {/* Indicator Dots Below Day */}
              {cd.isCurrentMonth && hasEvents && !isMaintenance && !isSpecial && (
                <div className="mt-1 flex items-center justify-center gap-1 flex-wrap max-w-[32px]">
                  {dayEvents.slice(0, 4).map((ev, i) => (
                    <span
                      key={i}
                      className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                        ev.category === "PASS"
                          ? "bg-nominal"
                          : ev.category === "MANEUVER"
                          ? "bg-orange-400"
                          : ev.category === "MAINTENANCE"
                          ? "bg-accent"
                          : ev.category === "SPECIAL"
                          ? "bg-purple-500"
                          : "bg-text-muted"
                      }`}
                    />
                  ))}
                </div>
              )}

              {/* Hover Tooltip Preview — Shows ALL events for that day */}
              {hasEvents && (
                <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden w-56 rounded-xl border border-border-default bg-[#0c1426] p-3 text-left text-xs shadow-2xl z-30 group-hover:block animate-rise">
                  <div className="flex items-center justify-between border-b border-border-subtle pb-1.5 mb-2">
                    <span className="text-[10px] uppercase font-bold text-accent-light">{cd.dateString}</span>
                    <span className="num text-[10px] text-text-dim">{dayEvents.length} event{dayEvents.length > 1 ? "s" : ""}</span>
                  </div>
                  <div className="space-y-1.5 max-h-36 overflow-hidden">
                    {dayEvents.map((ev, i) => (
                      <div key={i} className="space-y-0.5 border-l-2 border-accent pl-1.5">
                        <p className="font-bold text-white text-[11px] truncate">{ev.title}</p>
                        <p className="num text-[9px] text-text-dim">{ev.time} · {ev.station || ev.department}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-[9px] text-center text-text-dim border-t border-border-subtle pt-1">
                    Click date to view all {dayEvents.length} events
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MultiEventModal({
  date,
  events,
  onClose,
}: {
  date: string
  events: MissionEvent[]
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-page/85 backdrop-blur-sm animate-rise">
      <div
        className="relative w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden rounded-2xl border border-border-default bg-[#0d1629] shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle bg-[#111c34] px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 border border-accent/30 text-accent-light shrink-0">
              <CalendarIcon size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white leading-snug">
                  Mission Events on {date}
                </h3>
                <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent-light">
                  {events.length} Event{events.length > 1 ? "s" : ""}
                </span>
              </div>
              <p className="text-xs text-text-dim mt-0.5">
                Detailed telemetry passes, maintenance, and flight operations scheduled for this date.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-text-muted hover:bg-card-hover hover:text-text-primary transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Events List for this date */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 scrollbar-none">
          {events.map((ev, index) => (
            <div
              key={ev.id || index}
              className="rounded-xl border border-border-subtle bg-[#060c18] p-4 space-y-3 hover:border-accent/40 transition-colors"
            >
              <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase num ${
                    ev.category === "PASS" ? "bg-nominal/20 text-nominal border border-nominal/30" :
                    ev.category === "MANEUVER" ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" :
                    ev.category === "MAINTENANCE" ? "bg-accent/20 text-accent-light border border-accent/30" :
                    "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                  }`}>
                    {ev.category}
                  </span>
                  <h4 className="text-sm font-bold text-white truncate max-w-sm">
                    {ev.title}
                  </h4>
                </div>
                <span className="num text-xs font-semibold text-accent-light shrink-0">
                  {ev.time}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="flex items-center gap-2 text-text-secondary">
                  <MapPin size={14} className="text-accent-light shrink-0" />
                  <span className="truncate">{ev.station || "ISTRAC Bengaluru"}</span>
                </div>
                <div className="flex items-center gap-2 text-text-secondary">
                  <Layers size={14} className="text-accent-light shrink-0" />
                  <span>Division: <strong className="text-white">{ev.department}</strong></span>
                </div>
              </div>

              {ev.description && (
                <p className="text-xs text-text-secondary leading-relaxed bg-[#0b1220] p-2.5 rounded-lg border border-border-subtle/50">
                  {ev.description}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-border-subtle bg-[#111c34] shrink-0 text-xs text-text-dim">
          <span>Tracking Network: <strong>ISTRAC Global Telemetry Network</strong></span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-border-default bg-surface text-xs font-semibold text-white hover:bg-card-hover"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
