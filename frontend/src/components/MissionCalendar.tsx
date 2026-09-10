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
  Clock,
  Ban,
  AlertTriangle,
  Satellite,
} from "lucide-react"
import { Link } from "react-router-dom"
import { useCms } from "../context/cmsContext"
import { eventsApi } from "../api/events.api"
import { useAuthStore } from "../store/authStore"
import { useToastStore } from "../store/toastStore"

export interface CategoryMeta {
  id: string
  label: string
  dotClass: string
  textClass: string
  badgeClass: string
  borderClass: string
  calendarDateClass: string
  priority: number
}

export const DEFAULT_CATEGORY_METAS: Record<string, CategoryMeta> = {
  MISSION_PASS: {
    id: "MISSION_PASS",
    label: "Spacecraft Tracking Pass",
    dotClass: "bg-nominal shadow-sm shadow-nominal/40",
    textClass: "text-nominal",
    badgeClass: "bg-nominal/20 text-nominal border border-nominal/30",
    borderClass: "border-nominal",
    calendarDateClass: "rounded-full bg-nominal/30 text-white font-bold",
    priority: 1,
  },
  ORBIT_MANEUVER: {
    id: "ORBIT_MANEUVER",
    label: "Orbital Maneuver / Station Keeping",
    dotClass: "bg-orange-400 shadow-sm shadow-orange-400/40",
    textClass: "text-orange-400",
    badgeClass: "bg-orange-500/20 text-orange-400 border border-orange-500/30",
    borderClass: "border-orange-400",
    calendarDateClass: "rounded-full bg-orange-500 text-white font-bold shadow-md shadow-orange-500/30",
    priority: 3,
  },
  MAINTENANCE: {
    id: "MAINTENANCE",
    label: "Ground Station Maintenance",
    dotClass: "bg-accent shadow-sm shadow-accent/40",
    textClass: "text-accent-light",
    badgeClass: "bg-accent/20 text-accent-light border border-accent/30",
    borderClass: "border-accent",
    calendarDateClass: "rounded-full bg-accent text-white font-bold shadow-md shadow-accent/30",
    priority: 4,
  },
  LAUNCH: {
    id: "LAUNCH",
    label: "Mission Launch Activity",
    dotClass: "bg-purple-500 shadow-sm shadow-purple-500/40",
    textClass: "text-purple-400",
    badgeClass: "bg-purple-500/20 text-purple-400 border border-purple-500/30",
    borderClass: "border-purple-500",
    calendarDateClass: "rounded-full bg-purple-600 text-white font-bold shadow-md shadow-purple-600/30",
    priority: 5,
  },
  SEMINAR: {
    id: "SEMINAR",
    label: "Operational Review",
    dotClass: "bg-emerald-400 shadow-sm shadow-emerald-400/40",
    textClass: "text-emerald-400",
    badgeClass: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
    borderClass: "border-emerald-400",
    calendarDateClass: "rounded-full bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/30",
    priority: 2,
  },
  ANOMALY: {
    id: "ANOMALY",
    label: "Telemetry Anomaly Review",
    dotClass: "bg-red-500 shadow-sm shadow-red-500/40",
    textClass: "text-red-400",
    badgeClass: "bg-red-500/20 text-red-400 border border-red-500/30",
    borderClass: "border-red-500",
    calendarDateClass: "rounded-full bg-red-600 text-white font-bold shadow-md shadow-red-600/30",
    priority: 6,
  },
}

export const CUSTOM_PALETTES = [
  {
    dotClass: "bg-cyan-400 shadow-sm shadow-cyan-400/50",
    textClass: "text-cyan-300",
    badgeClass: "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30",
    borderClass: "border-cyan-400",
    calendarDateClass: "rounded-full bg-cyan-400 text-black font-bold shadow-md shadow-cyan-400/40",
  },
  {
    dotClass: "bg-pink-400 shadow-sm shadow-pink-400/50",
    textClass: "text-pink-300",
    badgeClass: "bg-pink-500/20 text-pink-400 border border-pink-500/30",
    borderClass: "border-pink-400",
    calendarDateClass: "rounded-full bg-pink-400 text-black font-bold shadow-md shadow-pink-400/40",
  },
  {
    dotClass: "bg-amber-400 shadow-sm shadow-amber-400/50",
    textClass: "text-amber-300",
    badgeClass: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
    borderClass: "border-amber-400",
    calendarDateClass: "rounded-full bg-amber-400 text-black font-bold shadow-md shadow-amber-400/40",
  },
  {
    dotClass: "bg-indigo-400 shadow-sm shadow-indigo-400/50",
    textClass: "text-indigo-300",
    badgeClass: "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30",
    borderClass: "border-indigo-400",
    calendarDateClass: "rounded-full bg-indigo-500 text-white font-bold shadow-md shadow-indigo-500/40",
  },
  {
    dotClass: "bg-lime-400 shadow-sm shadow-lime-400/50",
    textClass: "text-lime-300",
    badgeClass: "bg-lime-500/20 text-lime-400 border border-lime-500/30",
    borderClass: "border-lime-400",
    calendarDateClass: "rounded-full bg-lime-400 text-black font-bold shadow-md shadow-lime-400/40",
  },
  {
    dotClass: "bg-fuchsia-400 shadow-sm shadow-fuchsia-400/50",
    textClass: "text-fuchsia-300",
    badgeClass: "bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30",
    borderClass: "border-fuchsia-400",
    calendarDateClass: "rounded-full bg-fuchsia-500 text-white font-bold shadow-md shadow-fuchsia-500/40",
  },
]

export function resolveCategoryMeta(
  id: string,
  label?: string,
  customIdx = 0
): CategoryMeta {
  if (DEFAULT_CATEGORY_METAS[id]) {
    return {
      ...DEFAULT_CATEGORY_METAS[id],
      label: label || DEFAULT_CATEGORY_METAS[id].label,
    }
  }
  const palette = CUSTOM_PALETTES[customIdx % CUSTOM_PALETTES.length]
  return {
    id,
    label: label || id.replace(/_/g, " "),
    dotClass: palette.dotClass,
    textClass: palette.textClass,
    badgeClass: palette.badgeClass,
    borderClass: palette.borderClass,
    calendarDateClass: palette.calendarDateClass,
    priority: 4,
  }
}

export interface MissionEvent {
  id: string
  title: string
  subtitle?: string
  date: string // YYYY-MM-DD
  time: string
  category: "PASS" | "MANEUVER" | "MAINTENANCE" | "SPECIAL" | "CUSTOM" | "OTHER"
  categoryLabel?: string
  rawEventType?: string
  department?: string
  departmentName?: string | null
  departmentCode?: string | null
  station?: string | null
  satelliteName?: string | null
  satelliteCode?: string | null
  description?: string
  urgency?: "NORMAL" | "IMPORTANT" | "CRITICAL"
  status?: "UPCOMING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "TIMED_OUT" | string
  meta?: CategoryMeta
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
  const [allCategories, setAllCategories] = useState<Array<{ id: string; label: string }>>([])

  // Fetch real events and event categories directly from backend API
  useEffect(() => {
    Promise.all([
      eventsApi.getEvents().catch(() => []),
      eventsApi.getEventConfig().catch(() => ({ locations: [], categories: [] })),
    ])
      .then(([data, config]) => {
        const configCats: Array<{ id: string; label: string }> =
          config?.categories && config.categories.length > 0
            ? config.categories
            : [
                { id: "MISSION_PASS", label: "Spacecraft Tracking Pass" },
                { id: "LAUNCH", label: "Mission Launch Activity" },
                { id: "ORBIT_MANEUVER", label: "Orbital Maneuver / Station Keeping" },
                { id: "MAINTENANCE", label: "Ground Station Maintenance" },
                { id: "SEMINAR", label: "Operational Review" },
                { id: "ANOMALY", label: "Telemetry Anomaly Review" },
              ]
        setAllCategories(configCats)

        const customCats = configCats.filter((c) => !DEFAULT_CATEGORY_METAS[c.id])

        if (data && data.length > 0) {
          const mapped: MissionEvent[] = data.map((ev) => {
            const dateObj = new Date(ev.eventDate)
            const dateStr = dateObj.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
            const startTimeStr = dateObj.toLocaleTimeString("en-IN", {
              timeZone: "Asia/Kolkata",
              hour: "2-digit",
              minute: "2-digit",
            })

            let timeStr = `${startTimeStr} IST`
            if (ev.endDate) {
              const endObj = new Date(ev.endDate)
              const endTimeStr = endObj.toLocaleTimeString("en-IN", {
                timeZone: "Asia/Kolkata",
                hour: "2-digit",
                minute: "2-digit",
              })
              const endDateStr = endObj.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
              if (endDateStr !== dateStr) {
                const startMonthDay = dateObj.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", month: "short", day: "numeric" })
                const endMonthDay = endObj.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", month: "short", day: "numeric" })
                timeStr = `${startMonthDay} ${startTimeStr} - ${endMonthDay} ${endTimeStr} IST`
              } else {
                timeStr = `${startTimeStr} - ${endTimeStr} IST`
              }
            }

            const customIdx = customCats.findIndex((c) => c.id === ev.eventType)
            const catLabel = configCats.find((c) => c.id === ev.eventType)?.label || ev.eventType.replace(/_/g, " ")
            const meta = resolveCategoryMeta(ev.eventType, catLabel, customIdx >= 0 ? customIdx : 0)

            let cat: MissionEvent["category"] = "PASS"
            if (ev.eventType === "ORBIT_MANEUVER") cat = "MANEUVER"
            else if (ev.eventType === "MAINTENANCE") cat = "MAINTENANCE"
            else if (ev.eventType === "SEMINAR" || ev.eventType === "LAUNCH" || ev.eventType === "ANOMALY") cat = "SPECIAL"
            else if (ev.eventType === "MISSION_PASS") cat = "PASS"
            else cat = "CUSTOM"

            return {
              id: ev.id,
              title: ev.title,
              subtitle: ev.satellite?.name ? `${ev.satellite.name} Operations` : ev.location || "ISTRAC MOX",
              date: dateStr,
              time: timeStr,
              category: cat,
              categoryLabel: catLabel,
              rawEventType: ev.eventType,
              department: ev.department?.code || ev.department?.name || "Operations",
              departmentName: ev.department?.name,
              departmentCode: ev.department?.code,
              station: ev.location || "ISTRAC Bengaluru",
              satelliteName: ev.satellite?.name,
              satelliteCode: ev.satellite?.code,
              description: ev.description || undefined,
              urgency: ev.urgency,
              status: ev.status,
              meta,
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

  const user = useAuthStore((s) => s.user)
  const addToast = useToastStore((s) => s.addToast)
  const isAdmin = user?.role === "ADMIN"

  const [cancellingEvent, setCancellingEvent] = useState<MissionEvent | null>(null)
  const [cancelLoading, setCancelLoading] = useState(false)

  const handleConfirmCancel = async () => {
    if (!cancellingEvent) return
    try {
      setCancelLoading(true)
      await eventsApi.cancelEvent(cancellingEvent.id)
      addToast({
        title: "Event Cancelled",
        message: `"${cancellingEvent.title}" has been cancelled.`,
        variant: "success",
      })

      // Update local state
      setServerEvents((prev) =>
        prev.map((e) => (e.id === cancellingEvent.id ? { ...e, status: "CANCELLED" } : e))
      )
      setSelectedDateEvents((prev) =>
        prev
          ? {
              ...prev,
              events: prev.events.map((e) =>
                e.id === cancellingEvent.id ? { ...e, status: "CANCELLED" } : e
              ),
            }
          : null
      )
      setCancellingEvent(null)
    } catch (err: any) {
      addToast({
        title: "Cancellation Failed",
        message: err.response?.data?.error?.message || "Could not cancel mission event",
        variant: "error",
      })
    } finally {
      setCancelLoading(false)
    }
  }

  const legendCategories: CategoryMeta[] = useMemo(() => {
    let customCounter = 0
    return allCategories.map((c) => {
      const isDefault = Boolean(DEFAULT_CATEGORY_METAS[c.id])
      const meta = resolveCategoryMeta(c.id, c.label, isDefault ? 0 : customCounter)
      if (!isDefault) customCounter++
      return meta
    })
  }, [allCategories])

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

  const todayStr = useMemo(() => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }), [])
  const todayEvents = useMemo(() => eventsByDate[todayStr] || [], [eventsByDate, todayStr])

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

        <div className="flex items-center gap-2.5 flex-wrap">
          {todayEvents.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedDateEvents({ date: todayStr, events: todayEvents })}
              className="num inline-flex items-center gap-1.5 rounded-full bg-nominal/15 border border-nominal/40 px-2.5 py-1 text-[11px] font-bold text-nominal hover:bg-nominal/25 transition-colors cursor-pointer shadow-xs animate-pulse"
              title="View Today's Scheduled Events"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-nominal" />
              <span>Today: {todayEvents.length} Event{todayEvents.length > 1 ? "s" : ""}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setBaseDate(new Date())
              if (todayEvents.length > 0) {
                setSelectedDateEvents({ date: todayStr, events: todayEvents })
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-surface/80 hover:bg-card-hover px-2.5 py-1 text-xs font-semibold text-text-primary hover:text-white transition-all cursor-pointer shadow-xs"
            title="Jump to Current Date (IST)"
          >
            <Clock size={12} className="text-accent-light" />
            <span>Today</span>
          </button>

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
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border ${
                          ev.meta?.badgeClass || "bg-accent/20 text-accent-light border-accent/30"
                        }`}>
                          {ev.meta?.label || ev.categoryLabel || ev.category}
                        </span>
                        {ev.satelliteName && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                            🛰️ {ev.satelliteName}
                          </span>
                        )}
                        {ev.urgency === "CRITICAL" && (
                          <span className="text-[9px] font-bold uppercase px-1 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                            CRITICAL
                          </span>
                        )}
                        {ev.status === "CANCELLED" && (
                          <span className="text-[9px] font-bold uppercase px-1 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                            CANCELLED
                          </span>
                        )}
                      </div>
                      <span className="num text-[10px] text-text-dim">{ev.date} · {ev.time}</span>
                    </div>
                    <div className={`text-xs font-semibold truncate ${
                      ev.status === "CANCELLED" ? "text-text-muted line-through" : "text-white"
                    }`}>{ev.title}</div>
                    <div className="flex items-center gap-2 text-[10px] text-text-dim num flex-wrap">
                      <span>📍 {ev.station || "ISTRAC Bengaluru"}</span>
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
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase num border ${
                          ev.meta?.badgeClass || "bg-accent/20 text-accent-light border-accent/30"
                        }`}>
                          {ev.meta?.label || ev.categoryLabel || ev.category}
                        </span>
                        {ev.satelliteName && (
                          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                            🛰️ {ev.satelliteName}
                          </span>
                        )}
                        {ev.urgency === "CRITICAL" && (
                          <span className="text-[9px] font-bold uppercase px-1 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                            CRITICAL
                          </span>
                        )}
                        {ev.status === "CANCELLED" && (
                          <span className="text-[9px] font-bold uppercase px-1 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                            CANCELLED
                          </span>
                        )}
                      </div>
                      <span className="num text-[11px] text-text-dim font-semibold">{ev.date}</span>
                    </div>
                    <h3 className={`text-xs font-bold leading-snug line-clamp-2 ${
                      ev.status === "CANCELLED" ? "text-text-muted line-through" : "text-white"
                    }`}>{ev.title}</h3>
                    {ev.description && (
                      <p className="text-[11px] text-text-secondary line-clamp-2 leading-relaxed">{ev.description}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-text-dim pt-2 border-t border-border-subtle/60 num flex-wrap gap-1">
                    <span>🕒 {ev.time}</span>
                    <span>📍 {ev.station || "ISTRAC Bengaluru"}</span>
                    <span className="text-accent-light font-semibold">{ev.department}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bottom Legend: Shows all dropdown items of the category event type */}
      {showLegend && (
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border-subtle/70 pt-5 text-xs text-text-muted">
          {legendCategories.map((cat) => (
            <span key={cat.id} className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${cat.dotClass}`} />
              <span className={cat.textClass || "text-text-secondary"}>{cat.label}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )

  const cancelConfirmationModal = cancellingEvent && (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in-50 duration-150">
      <div className="w-full max-w-sm rounded-2xl border border-red-500/40 bg-[#0d1629] p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 shrink-0">
            <AlertTriangle size={18} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white">Cancel Mission Event</h3>
            <p className="text-xs text-text-muted mt-1 leading-relaxed">
              Are you sure you want to cancel <strong className="text-white">"{cancellingEvent.title}"</strong>?
            </p>
            <p className="text-[11px] text-red-400/90 mt-1 font-mono">
              Action: Status → CANCELLED (Admin Only)
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
          <button
            type="button"
            disabled={cancelLoading}
            onClick={() => setCancellingEvent(null)}
            className="px-3 py-1.5 rounded-lg border border-border-default bg-surface text-xs font-semibold text-text-primary hover:bg-card-hover cursor-pointer"
          >
            Keep Active
          </button>
          <button
            type="button"
            disabled={cancelLoading}
            onClick={handleConfirmCancel}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-red-600 text-xs font-bold text-white hover:bg-red-500 shadow-md shadow-red-600/30 cursor-pointer disabled:opacity-50"
          >
            {cancelLoading ? "Cancelling…" : "Yes, Cancel Event"}
          </button>
        </div>
      </div>
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
            isAdmin={isAdmin}
            onCancelEvent={(ev) => setCancellingEvent(ev)}
          />
        )}
        {cancelConfirmationModal}
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
          isAdmin={isAdmin}
          onCancelEvent={(ev) => setCancellingEvent(ev)}
        />
      )}
      {cancelConfirmationModal}
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
          const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
          const isToday = cd.dateString === todayStr

          const topEvent = hasEvents
            ? [...dayEvents].sort((a, b) => (b.meta?.priority || 0) - (a.meta?.priority || 0))[0]
            : null

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
                  className={`num flex h-7 w-7 items-center justify-center text-xs font-semibold transition-all relative ${
                    !cd.isCurrentMonth
                      ? "text-text-dim/40"
                      : isToday
                      ? "rounded-full bg-accent text-white font-bold ring-2 ring-accent-light ring-offset-2 ring-offset-[#0d1629] shadow-md shadow-accent/40"
                      : topEvent?.meta?.calendarDateClass
                      ? topEvent.meta.calendarDateClass
                      : hasEvents
                      ? "text-text-primary font-bold group-hover:text-accent-light"
                      : "text-text-secondary group-hover:text-text-primary"
                  }`}
                  title={isToday ? "Today (Current Date)" : undefined}
                >
                  {cd.dayNumber}
                  {isToday && (
                    <span className="absolute -bottom-1 h-1.5 w-1.5 rounded-full bg-accent-light animate-ping" />
                  )}
                </span>

                {/* Multiple Event Count Badge on Date (e.g. +3) */}
                {cd.isCurrentMonth && dayEvents.length > 1 && (
                  <span className="absolute -top-1 -right-2 h-4 min-w-4 px-1 rounded-full bg-accent text-white text-[9px] font-extrabold flex items-center justify-center border border-[#0d1629] shadow-sm">
                    {dayEvents.length}
                  </span>
                )}
              </div>

              {/* Indicator Dots Below Day */}
              {cd.isCurrentMonth && hasEvents && (
                <div className="mt-1 flex items-center justify-center gap-1 flex-wrap max-w-[32px]">
                  {dayEvents.slice(0, 4).map((ev, i) => (
                    <span
                      key={i}
                      className={`h-1.5 w-1.5 rounded-full shrink-0 ${ev.meta?.dotClass || "bg-accent"}`}
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
                      <div
                        key={i}
                        className={`space-y-0.5 border-l-2 pl-1.5 ${ev.meta?.borderClass || "border-accent"}`}
                      >
                        <p className={`font-bold text-[11px] truncate ${ev.status === "CANCELLED" ? "text-text-muted line-through" : "text-white"}`}>
                          {ev.title}
                        </p>
                        <p className="num text-[9px] text-text-dim">{ev.time} · {ev.meta?.label || ev.categoryLabel || ev.station || ev.department}</p>
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
  isAdmin = false,
  onCancelEvent,
}: {
  date: string
  events: MissionEvent[]
  onClose: () => void
  isAdmin?: boolean
  onCancelEvent?: (ev: MissionEvent) => void
}) {
  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-page/85 backdrop-blur-sm animate-rise">
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
            className="rounded-lg p-1.5 text-text-muted hover:bg-card-hover hover:text-text-primary transition-colors cursor-pointer"
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
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border-subtle pb-2.5 gap-2">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase num ${
                      ev.meta?.badgeClass || "bg-accent/20 text-accent-light border border-accent/30"
                    }`}>
                      {ev.meta?.label || ev.categoryLabel || ev.category}
                    </span>

                    {ev.satelliteName && (
                      <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                        <Satellite size={11} className="text-cyan-400" />
                        <span>{ev.satelliteName}</span>
                      </span>
                    )}

                    {ev.urgency === "CRITICAL" && (
                      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
                        CRITICAL
                      </span>
                    )}

                    {ev.urgency === "IMPORTANT" && (
                      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        PRIORITY
                      </span>
                    )}

                    {ev.status === "CANCELLED" && (
                      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase bg-red-500/20 text-red-400 border border-red-500/30">
                        CANCELLED
                      </span>
                    )}
                  </div>

                  <h4 className={`text-base font-bold leading-snug pt-0.5 ${
                    ev.status === "CANCELLED" ? "text-text-muted line-through" : "text-white"
                  }`}>
                    {ev.title}
                  </h4>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-center">
                  <span className="num text-xs font-semibold text-accent-light bg-surface px-2.5 py-1 rounded-md border border-border-subtle">
                    {ev.time}
                  </span>

                  {isAdmin && ev.status !== "CANCELLED" && ev.status !== "COMPLETED" && onCancelEvent && (
                    <button
                      type="button"
                      onClick={() => onCancelEvent(ev)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 text-xs font-semibold transition-colors cursor-pointer"
                      title="Cancel this mission event (Admin Only)"
                    >
                      <Ban size={12} />
                      <span>Cancel Event</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-[#0b1426] p-3 rounded-lg border border-border-subtle/70">
                <div className="flex items-center gap-2 text-text-secondary min-w-0">
                  <MapPin size={14} className="text-accent-light shrink-0" />
                  <div className="truncate">
                    <span className="text-[10px] uppercase text-text-dim block leading-tight">Ground Station / Location</span>
                    <span className="font-semibold text-white">{ev.station || "ISTRAC Bengaluru"}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-text-secondary min-w-0">
                  <Layers size={14} className="text-accent-light shrink-0" />
                  <div className="truncate">
                    <span className="text-[10px] uppercase text-text-dim block leading-tight">Operational Division</span>
                    <span className="font-semibold text-white">
                      {ev.departmentName ? `${ev.departmentName} (${ev.departmentCode || ev.department})` : ev.department || "Operations"}
                    </span>
                  </div>
                </div>
              </div>

              {ev.description && (
                <div className="bg-[#0b1220] p-3 rounded-lg border border-border-subtle/50 space-y-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-text-dim block">Operation Details & Notes</span>
                  <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">
                    {ev.description}
                  </p>
                </div>
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
            className="px-4 py-1.5 rounded-lg border border-border-default bg-surface text-xs font-semibold text-white hover:bg-card-hover cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
