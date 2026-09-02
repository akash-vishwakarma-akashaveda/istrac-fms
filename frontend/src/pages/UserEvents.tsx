import { useState, useEffect, useMemo } from "react"
import {
  Calendar as CalendarIcon,
  Clock,
  Radio,
  Building2,
  Flame,
  AlertTriangle,
  Sparkles,
  MapPin,
  Search,
  CheckCircle2,
  Bell,
  LayoutGrid,
  CalendarDays,
  History,
  Zap,
  Globe,
} from "lucide-react"
import { Link, useSearchParams } from "react-router-dom"
import { eventsApi, type MissionEventItem } from "../api/events.api"
import { satellitesApi, type Satellite } from "../api/satellites.api"
import { PageHeader } from "../components"
import { MissionCalendar } from "../components/MissionCalendar"

const EVENT_TYPE_MAP: Record<string, { label: string; icon: any; color: string; badge: string }> = {
  MISSION_PASS: {
    label: "Spacecraft Tracking Pass",
    icon: Radio,
    color: "text-accent-light bg-accent/15 border-accent/30",
    badge: "PASS",
  },
  LAUNCH: {
    label: "Rocket Launch Window",
    icon: Flame,
    color: "text-[#FF6B00] bg-[#FF6B00]/15 border-[#FF6B00]/30",
    badge: "LAUNCH",
  },
  ORBIT_MANEUVER: {
    label: "Orbit Correction Maneuver",
    icon: Sparkles,
    color: "text-purple-400 bg-purple-400/15 border-purple-400/30",
    badge: "MANEUVER",
  },
  MAINTENANCE: {
    label: "Ground Station Maintenance",
    icon: AlertTriangle,
    color: "text-yellow-400 bg-yellow-400/15 border-yellow-400/30",
    badge: "MAINTENANCE",
  },
  SEMINAR: {
    label: "Operational Review",
    icon: Building2,
    color: "text-nominal bg-nominal/15 border-nominal/30",
    badge: "REVIEW",
  },
  ANOMALY: {
    label: "Telemetry Anomaly Review",
    icon: AlertTriangle,
    color: "text-red-400 bg-red-400/15 border-red-400/30",
    badge: "ANOMALY",
  },
}

export type TimelineTab = "ACTIVE_UPCOMING" | "PAST"
export type TimeFormatMode = "BOTH" | "IST" | "UTC"

export function UserEvents() {
  const [searchParams] = useSearchParams()
  const targetEventId = searchParams.get("eventId")

  const [events, setEvents] = useState<MissionEventItem[]>([])
  const [satellites, setSatellites] = useState<Satellite[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [timelineTab, setTimelineTab] = useState<TimelineTab>("ACTIVE_UPCOMING")
  const [typeFilter, setTypeFilter] = useState("ALL")
  const [satelliteFilter, setSatelliteFilter] = useState("ALL")
  const [viewMode, setViewMode] = useState<"calendar" | "cards" | "both">("both")
  const [timeMode, setTimeMode] = useState<TimeFormatMode>("BOTH")

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const [evData, satData] = await Promise.all([
          eventsApi.getEvents(),
          satellitesApi.getActiveSatellites().catch(() => []),
        ])
        setEvents(evData || [])
        setSatellites(satData || [])
      } catch (err) {
        console.error("Failed to fetch events:", err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  useEffect(() => {
    if (targetEventId && !loading && events.length > 0) {
      setTimeout(() => {
        const el = document.getElementById(`event-card-${targetEventId}`)
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" })
        }
      }, 200)
    }
  }, [targetEventId, loading, events])

  const { activeUpcomingEvents, pastEvents } = useMemo(() => {
    const now = new Date()
    const active: MissionEventItem[] = []
    const past: MissionEventItem[] = []

    events.forEach((ev) => {
      const evDate = new Date(ev.eventDate)
      const endDate = ev.endDate ? new Date(ev.endDate) : null
      const status = ev.status as string

      const isTerminal =
        status === "COMPLETED" ||
        status === "CANCELLED" ||
        status === "TIMED_OUT"

      const isDateExpired = endDate ? endDate < now : evDate < now

      if (isTerminal || (status !== "IN_PROGRESS" && isDateExpired)) {
        past.push(ev)
      } else {
        active.push(ev)
      }
    })

    active.sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())
    past.sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime())

    return { activeUpcomingEvents: active, pastEvents: past }
  }, [events])

  const currentTabEvents = timelineTab === "ACTIVE_UPCOMING" ? activeUpcomingEvents : pastEvents

  const filteredEvents = useMemo(() => {
    return currentTabEvents.filter((e) => {
      if (typeFilter !== "ALL" && e.eventType !== typeFilter) return false
      if (satelliteFilter !== "ALL" && e.satelliteId !== satelliteFilter) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const matchTitle = e.title.toLowerCase().includes(q)
        const matchDesc = (e.description || "").toLowerCase().includes(q)
        const matchLoc = (e.location || "").toLowerCase().includes(q)
        const matchSat = (e.satellite?.name || "").toLowerCase().includes(q)
        if (!matchTitle && !matchDesc && !matchLoc && !matchSat) return false
      }
      return true
    })
  }, [currentTabEvents, typeFilter, satelliteFilter, search])

  const nextEvent = activeUpcomingEvents[0]

  return (
    <div className="w-full space-y-6 pb-20 text-text-primary">
      <PageHeader
        eyebrow="Mission Operations"
        title="Tracking Passes & Flight Events"
        meta={
          <span className="num text-xs text-text-dim font-mono">
            {activeUpcomingEvents.length} Active / Upcoming · {pastEvents.length} Past Archived
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Dual Time Toggle */}
            <div className="flex items-center rounded-lg border border-border-default bg-[#060c18] p-0.5">
              <button
                type="button"
                onClick={() => setTimeMode("BOTH")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  timeMode === "BOTH"
                    ? "bg-accent/20 text-accent-light border border-accent/40"
                    : "text-text-secondary hover:text-white"
                }`}
                title="Show both IST and UTC"
              >
                <Globe size={12} />
                <span>IST + UTC</span>
              </button>

              <button
                type="button"
                onClick={() => setTimeMode("IST")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  timeMode === "IST"
                    ? "bg-accent/20 text-accent-light border border-accent/40"
                    : "text-text-secondary hover:text-white"
                }`}
              >
                <span>IST Only</span>
              </button>

              <button
                type="button"
                onClick={() => setTimeMode("UTC")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  timeMode === "UTC"
                    ? "bg-accent/20 text-accent-light border border-accent/40"
                    : "text-text-secondary hover:text-white"
                }`}
              >
                <span>UTC (Z)</span>
              </button>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center rounded-lg border border-border-default bg-[#060c18] p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("both")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  viewMode === "both"
                    ? "bg-accent text-white shadow-sm"
                    : "text-text-secondary hover:text-white"
                }`}
              >
                <span>Dashboard</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode("calendar")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  viewMode === "calendar"
                    ? "bg-accent text-white shadow-sm"
                    : "text-text-secondary hover:text-white"
                }`}
              >
                <CalendarDays size={13} />
                <span>Calendar</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  viewMode === "cards"
                    ? "bg-accent text-white shadow-sm"
                    : "text-text-secondary hover:text-white"
                }`}
              >
                <LayoutGrid size={13} />
                <span>Passes</span>
              </button>
            </div>

            <Link
              to="/notifications"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-card px-3 py-1.5 text-xs font-bold text-accent-light hover:border-accent transition-all"
            >
              <Bell size={14} />
              <span>Broadcast Alerts</span>
            </Link>
          </div>
        }
      />

      {/* NEXT UPCOMING HERO HIGHLIGHT */}
      {nextEvent && (
        <div className="rounded-xl border border-accent/40 bg-gradient-to-r from-accent/20 via-[#0b1730] to-accent/10 p-5 shadow-lg relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-accent/25 border border-accent/40 px-2.5 py-0.5 text-[10px] font-bold text-accent-light uppercase flex items-center gap-1.5 animate-pulse">
                  <Radio size={12} />
                  <span>Next Operational Event</span>
                </span>
                <span
                  className={`rounded px-2 py-0.5 text-[10px] font-mono font-bold ${
                    (nextEvent.status as string) === "IN_PROGRESS"
                      ? "bg-nominal/20 text-nominal border border-nominal/40 animate-pulse"
                      : (nextEvent.status as string) === "TIMED_OUT"
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                      : "bg-surface border border-border-subtle text-text-dim"
                  }`}
                >
                  {nextEvent.status}
                </span>
              </div>

              <h2 className="text-lg sm:text-xl font-black text-white">
                {nextEvent.title}
              </h2>

              {nextEvent.description && (
                <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
                  {nextEvent.description}
                </p>
              )}

              {/* Hero Time Display */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-text-dim pt-1 font-mono">
                {(timeMode === "BOTH" || timeMode === "IST") && (
                  <span className="flex items-center gap-1 text-white font-bold">
                    <Clock size={13} className="text-accent-light" />
                    {new Date(nextEvent.eventDate).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}{" "}
                    <span className="text-accent-light">IST</span>
                  </span>
                )}

                {(timeMode === "BOTH" || timeMode === "UTC") && (
                  <span className="flex items-center gap-1 text-text-dim bg-surface/70 border border-border-subtle px-2 py-0.5 rounded">
                    <Globe size={12} className="text-text-dim" />
                    {new Date(nextEvent.eventDate).toLocaleString("en-US", {
                      timeZone: "UTC",
                      dateStyle: "medium",
                      timeStyle: "short",
                      hour12: false,
                    })}{" "}
                    UTC
                  </span>
                )}

                {nextEvent.location && (
                  <span className="flex items-center gap-1">
                    <MapPin size={13} className="text-text-dim" />
                    {nextEvent.location}
                  </span>
                )}
                {nextEvent.satellite && (
                  <span className="flex items-center gap-1 text-accent-light font-bold">
                    <Radio size={13} />
                    {nextEvent.satellite.name}
                  </span>
                )}
              </div>
            </div>

            <div className="shrink-0 flex flex-col items-start md:items-end justify-center">
              <span className="text-[11px] font-bold text-text-dim uppercase">Ground Clearance</span>
              <span className="text-xs font-bold text-nominal flex items-center gap-1 mt-0.5">
                <CheckCircle2 size={13} />
                <span>Station Ready</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* DUAL-MONTH INTERACTIVE MISSION CALENDAR VIEW */}
      {(viewMode === "calendar" || viewMode === "both") && (
        <div className="animate-in fade-in-50 duration-200">
          <MissionCalendar
            isEmbedded={true}
            title="Operational Passes & Events Calendar"
            hideViewAll={true}
          />
        </div>
      )}

      {/* PASSES FILTER & EVENT CARDS GRID */}
      {(viewMode === "cards" || viewMode === "both") && (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          {/* Timeline Tabs */}
          <div className="flex items-center justify-between border-b border-border-subtle gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTimelineTab("ACTIVE_UPCOMING")}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  timelineTab === "ACTIVE_UPCOMING"
                    ? "border-accent text-accent-light bg-accent/10 rounded-t-lg"
                    : "border-transparent text-text-dim hover:text-white"
                }`}
              >
                <Zap size={14} className={timelineTab === "ACTIVE_UPCOMING" ? "animate-pulse text-accent-light" : ""} />
                <span>Live & Future Events</span>
                <span className="num rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent-light">
                  {activeUpcomingEvents.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setTimelineTab("PAST")}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  timelineTab === "PAST"
                    ? "border-accent text-accent-light bg-accent/10 rounded-t-lg"
                    : "border-transparent text-text-dim hover:text-white"
                }`}
              >
                <History size={14} />
                <span>Past & Completed Events</span>
                <span className="num rounded-full bg-surface px-2 py-0.5 text-[10px] font-bold text-text-dim">
                  {pastEvents.length}
                </span>
              </button>
            </div>

            <span className="text-[11px] text-text-dim hidden sm:block">
              {timelineTab === "ACTIVE_UPCOMING" ? "Showing real-time live and upcoming passes" : "Historical operations archive"}
            </span>
          </div>

          {/* Filter Controls */}
          <div className="rounded-xl border border-border-default bg-card p-4 shadow-sm space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-text-dim uppercase mb-1">Event Type</label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full rounded-lg border border-border-default bg-[#060c18] px-3 py-2 text-xs text-white outline-none focus:border-accent cursor-pointer"
                >
                  <option value="ALL">All Event Types</option>
                  {Object.entries(EVENT_TYPE_MAP).map(([key, val]) => (
                    <option key={key} value={key}>
                      {val.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-text-dim uppercase mb-1">Spacecraft</label>
                <select
                  value={satelliteFilter}
                  onChange={(e) => setSatelliteFilter(e.target.value)}
                  className="w-full rounded-lg border border-border-default bg-[#060c18] px-3 py-2 text-xs text-white outline-none focus:border-accent cursor-pointer"
                >
                  <option value="ALL">All Spacecraft</option>
                  {satellites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-text-dim uppercase mb-1">Search Events</label>
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
                  <input
                    type="text"
                    placeholder="Keywords, station, satellite…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-lg border border-border-default bg-[#060c18] pl-8 pr-3 py-2 text-xs text-white placeholder:text-text-dim outline-none focus:border-accent"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Event Schedule Grid */}
          {loading ? (
            <div className="p-16 text-center text-xs text-text-dim">
              Loading mission events schedule…
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="rounded-xl border border-border-subtle bg-card p-12 text-center space-y-2">
              <CalendarIcon size={32} className="mx-auto text-text-dim opacity-50" />
              <p className="text-sm font-bold text-white">
                {timelineTab === "ACTIVE_UPCOMING" ? "No Active or Future Events Found" : "No Past Archived Events Found"}
              </p>
              <p className="text-xs text-text-dim">Try adjusting your filters or keyword search above.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredEvents.map((ev) => {
                const meta = EVENT_TYPE_MAP[ev.eventType] || EVENT_TYPE_MAP.MISSION_PASS
                const Icon = meta.icon
                const isCritical = ev.urgency === "CRITICAL"
                const isImportant = ev.urgency === "IMPORTANT"
                const isTarget = targetEventId === ev.id
                const isPast = timelineTab === "PAST"
                const status = ev.status as string

                const d = new Date(ev.eventDate)
                const dateStrIST = d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", month: "short", day: "numeric" })
                const timeStrIST = d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })
                const timeStrUTC = d.toLocaleTimeString("en-US", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hour12: false })

                return (
                  <div
                    key={ev.id}
                    id={`event-card-${ev.id}`}
                    className={`rounded-xl border p-5 shadow-sm transition-all flex flex-col justify-between space-y-3 group ${
                      isTarget
                        ? "border-accent ring-2 ring-accent/60 bg-[#0a1738] shadow-lg shadow-accent/10 scale-[1.01]"
                        : isPast
                        ? "border-border-subtle bg-[#080e1a] opacity-80 hover:opacity-100 hover:border-border-default"
                        : "border-border-default bg-card hover:border-accent/40"
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase border ${meta.color}`}>
                            {meta.badge}
                          </span>
                          {isCritical && (
                            <span className="rounded bg-red-500/15 border border-red-500/30 px-1.5 py-0.5 text-[9px] font-bold text-red-400 uppercase">
                              CRITICAL
                            </span>
                          )}
                          {isImportant && (
                            <span className="rounded bg-yellow-500/15 border border-yellow-500/30 px-1.5 py-0.5 text-[9px] font-bold text-yellow-400 uppercase">
                              PRIORITY
                            </span>
                          )}
                        </div>

                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold font-mono ${
                            status === "UPCOMING"
                              ? "bg-accent/15 text-accent-light border border-accent/30"
                              : status === "IN_PROGRESS"
                              ? "bg-nominal/15 text-nominal border border-nominal/30 animate-pulse"
                              : status === "TIMED_OUT"
                              ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                              : "bg-surface text-text-dim border border-border-subtle"
                          }`}
                        >
                          {status}
                        </span>
                      </div>

                      <div className="flex items-start gap-2.5 pt-1">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface border border-border-subtle text-accent-light group-hover:border-accent/40 transition-colors">
                          <Icon size={16} />
                        </div>

                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-white group-hover:text-accent-light transition-colors line-clamp-1">
                            {ev.title}
                          </h4>
                          {ev.description && (
                            <p className="text-xs text-text-secondary mt-1 line-clamp-2 leading-relaxed">
                              {ev.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card Time Display: Both IST and UTC */}
                    <div className="pt-2.5 border-t border-border-subtle flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                      <div className="flex items-center gap-2">
                        {(timeMode === "BOTH" || timeMode === "IST") && (
                          <span className="flex items-center gap-1 text-white font-semibold">
                            <Clock size={12} className="text-accent-light" />
                            {dateStrIST}, {timeStrIST} <span className="text-accent-light font-bold">IST</span>
                          </span>
                        )}

                        {(timeMode === "BOTH" || timeMode === "UTC") && (
                          <span className="text-[10px] font-bold text-text-dim bg-surface px-1.5 py-0.5 rounded border border-border-subtle">
                            {timeStrUTC} UTC
                          </span>
                        )}
                      </div>

                      {ev.location && (
                        <span className="flex items-center gap-1 text-[11px] text-text-dim">
                          <MapPin size={11} />
                          {ev.location}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}