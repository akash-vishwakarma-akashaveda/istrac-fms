import { useState, useEffect, useMemo } from "react"
import {
  Calendar,
  Plus,
  Search,
  Clock,
  Radio,
  Building2,
  Flame,
  AlertTriangle,
  Trash2,
  Edit2,
  Sparkles,
  MapPin,
  History,
  Zap,
  Globe,
} from "lucide-react"
import { eventsApi, type MissionEventItem } from "../api/events.api"
import { satellitesApi, type Satellite } from "../api/satellites.api"
import { useDepartments } from "../hooks/useDepartments"
import { useToastStore } from "../store/toastStore"
import { PageHeader, Button, Modal, Textarea } from "../components"
import { schedulerApi } from "../api/schedule.api"

const EVENT_TYPES = [
  { id: "MISSION_PASS", label: "Spacecraft Tracking Pass", icon: Radio, color: "text-accent-light bg-accent/10 border-accent/30" },
  { id: "LAUNCH", label: "Rocket Launch Window", icon: Flame, color: "text-[#FF6B00] bg-[#FF6B00]/10 border-[#FF6B00]/30" },
  { id: "ORBIT_MANEUVER", label: "Orbit Correction Maneuver", icon: Sparkles, color: "text-purple-400 bg-purple-400/10 border-purple-400/30" },
  { id: "MAINTENANCE", label: "Ground Station / RAID Maintenance", icon: AlertTriangle, color: "text-warning bg-warning/10 border-warning/30" },
  { id: "SEMINAR", label: "Operational Review / Seminar", icon: Building2, color: "text-nominal bg-nominal/10 border-nominal/30" },
  { id: "ANOMALY", label: "Spacecraft Anomaly Investigation", icon: Flame, color: "text-critical bg-critical/10 border-critical/30" },
]

export type EventTabMode = "LIVE_FUTURE" | "PAST"
type InputTz = "IST" | "UTC"

/** Pads number to 2 digits */
const pad = (n: number) => String(n).padStart(2, "0")

/** Formats a Date object into YYYY-MM-DDTHH:mm based on target timezone */
const formatForInput = (d: Date, tz: InputTz): string => {
  if (tz === "UTC") {
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
  }
  // Local/IST
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Parses the input value based on selected input timezone and returns ISO UTC string */
const parseInputToUTC = (inputStr: string, tz: InputTz): string => {
  if (!inputStr) return ""
  if (tz === "UTC") {
    return new Date(`${inputStr}:00.000Z`).toISOString()
  }
  return new Date(inputStr).toISOString()
}

export function EventManager() {
  const addToast = useToastStore((s) => s.addToast)
  const { data: departments } = useDepartments()

  const [events, setEvents] = useState<MissionEventItem[]>([])
  const [satellites, setSatellites] = useState<Satellite[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [tabMode, setTabMode] = useState<EventTabMode>("LIVE_FUTURE")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [typeFilter, setTypeFilter] = useState("ALL")

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<MissionEventItem | null>(null)
  const [inputTz, setInputTz] = useState<InputTz>("IST")
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    eventType: "MISSION_PASS" as any,
    satelliteId: "",
    departmentId: "",
    eventDate: "",
    endDate: "",
    location: "ISTRAC MOX Bengaluru",
    urgency: "NORMAL" as any,
    status: "UPCOMING" as any,
    showOnBanner: true,
  })
  const [submitting, setSubmitting] = useState(false)

  // Delete Modal
  const [deletingEvent, setDeletingEvent] = useState<MissionEventItem | null>(null)
  const [schedulerInterval, setSchedulerInterval] = useState(10)
  const [schedulerSaving, setSchedulerSaving] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const [eventsData, satsData, schedulerData] = await Promise.all([
        eventsApi.getEvents(),
        satellitesApi.getAllAdminSatellites().catch(() => []),
        schedulerApi.getMissionEventScheduler().catch(() => null),
      ])
      setEvents(eventsData || [])
      setSatellites(satsData || [])
      if (schedulerData) {
        setSchedulerInterval(schedulerData.interval)
      }
    } catch {
      addToast({ title: "Error", message: "Failed to load mission events", variant: "error" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSchedulerChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const interval = Number(e.target.value)
    setSchedulerSaving(true)

    try {
      const updated = await schedulerApi.updateMissionEventScheduler({ interval })
      setSchedulerInterval(updated.interval)
      addToast({
        title: "Scheduler Updated",
        message: `Event status checks will now run every ${updated.interval} minutes.`,
        variant: "success",
      })
    } catch (err: any) {
      addToast({
        title: "Update Failed",
        message: err.response?.data?.error?.message || "Could not update scheduler interval",
        variant: "error",
      })
    } finally {
      setSchedulerSaving(false)
    }
  }

  const { liveFutureEvents, pastEvents } = useMemo(() => {
    const now = new Date()
    const live: MissionEventItem[] = []
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
        live.push(ev)
      }
    })

    live.sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())
    past.sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime())

    return { liveFutureEvents: live, pastEvents: past }
  }, [events])

  const currentTabList = tabMode === "LIVE_FUTURE" ? liveFutureEvents : pastEvents

  const filteredEvents = useMemo(() => {
    return currentTabList.filter((ev) => {
      const matchesSearch =
        ev.title.toLowerCase().includes(search.toLowerCase()) ||
        ev.location?.toLowerCase().includes(search.toLowerCase()) ||
        ev.satellite?.name.toLowerCase().includes(search.toLowerCase()) ||
        ev.department?.name.toLowerCase().includes(search.toLowerCase())

      const matchesStatus = statusFilter === "ALL" || ev.status === statusFilter
      const matchesType = typeFilter === "ALL" || ev.eventType === typeFilter

      return matchesSearch && matchesStatus && matchesType
    })
  }, [currentTabList, search, statusFilter, typeFilter])

  const openCreateModal = () => {
    setEditingEvent(null)
    setInputTz("IST")
    setFormData({
      title: "",
      description: "",
      eventType: "MISSION_PASS",
      satelliteId: satellites[0]?.id || "",
      departmentId: departments?.[0]?.id || "",
      eventDate: formatForInput(new Date(), "IST"),
      endDate: "",
      location: "ISTRAC MOX Bengaluru",
      urgency: "NORMAL",
      status: "UPCOMING",
      showOnBanner: true,
    })
    setIsModalOpen(true)
  }

  const openEditModal = (ev: MissionEventItem) => {
    setEditingEvent(ev)
    setInputTz("IST")
    setFormData({
      title: ev.title,
      description: ev.description || "",
      eventType: ev.eventType,
      satelliteId: ev.satelliteId || "",
      departmentId: ev.departmentId || "",
      eventDate: ev.eventDate ? formatForInput(new Date(ev.eventDate), "IST") : "",
      endDate: ev.endDate ? formatForInput(new Date(ev.endDate), "IST") : "",
      location: ev.location || "ISTRAC MOX Bengaluru",
      urgency: ev.urgency,
      status: ev.status,
      showOnBanner: ev.showOnBanner,
    })
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim() || !formData.eventDate) {
      addToast({ title: "Validation Error", message: "Title and Event Date are required", variant: "warning" })
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        ...formData,
        eventDate: parseInputToUTC(formData.eventDate, inputTz),
        endDate: formData.endDate ? parseInputToUTC(formData.endDate, inputTz) : null,
      }

      if (editingEvent) {
        await eventsApi.updateEvent(editingEvent.id, payload)
        addToast({ title: "Event Updated", message: `Updated "${formData.title}"`, variant: "success" })
      } else {
        await eventsApi.createEvent(payload)
        addToast({ title: "Event Scheduled", message: `Scheduled "${formData.title}"`, variant: "success" })
      }
      setIsModalOpen(false)
      loadData()
    } catch (err: any) {
      addToast({
        title: "Save Failed",
        message: err.response?.data?.error?.message || "Could not save event",
        variant: "error",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingEvent) return
    try {
      await eventsApi.deleteEvent(deletingEvent.id)
      addToast({ title: "Event Deleted", message: `Removed "${deletingEvent.title}"`, variant: "info" })
      setDeletingEvent(null)
      loadData()
    } catch {
      addToast({ title: "Error", message: "Failed to delete event", variant: "error" })
    }
  }

  return (
    <div className="w-full space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border-subtle pb-5">
        <PageHeader
          eyebrow="Mission Command & Control"
          title="Mission Events & Operations Calendar"
          description="Schedule spacecraft telemetry passes, rocket launch windows, orbit determination maneuvers, and station maintenance windows."
        />

        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={openCreateModal}
          className="shadow-md shadow-accent/25 shrink-0"
        >
          <Plus size={14} />
          <span>Schedule Mission Event</span>
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-border-subtle gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTabMode("LIVE_FUTURE")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              tabMode === "LIVE_FUTURE"
                ? "border-accent text-accent-light bg-accent/10 rounded-t-lg"
                : "border-transparent text-text-dim hover:text-white"
            }`}
          >
            <Zap size={14} className={tabMode === "LIVE_FUTURE" ? "animate-pulse text-accent-light" : ""} />
            <span>Live & Future Events</span>
            <span className="num rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent-light">
              {liveFutureEvents.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTabMode("PAST")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              tabMode === "PAST"
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

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Clock size={13} className="text-accent-light" />
            <span className="text-[11px] font-semibold text-text-dim whitespace-nowrap">
              Status Check
            </span>
            <select
              value={schedulerInterval}
              onChange={handleSchedulerChange}
              disabled={schedulerSaving}
              className="rounded-lg border border-border-default bg-[#060c18] px-2.5 py-2 text-[11px] font-semibold text-white outline-none focus:border-accent cursor-pointer disabled:opacity-50"
            >
              <option value={1}>Every 1 min</option>
              <option value={5}>Every 5 min</option>
              <option value={10}>Every 10 min</option>
              <option value={15}>Every 15 min</option>
              <option value={30}>Every 30 min</option>
              <option value={60}>Every 1 hour</option>
            </select>
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl border border-border-default bg-card shadow-sm">
        <div className="relative sm:col-span-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            type="text"
            placeholder="Search events, spacecraft, locations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border-default bg-[#060c18] pl-9 pr-3 py-2 text-xs text-white placeholder:text-text-dim outline-none focus:border-accent"
          />
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full rounded-lg border border-border-default bg-[#060c18] px-3 py-2 text-xs text-text-primary outline-none focus:border-accent cursor-pointer"
          >
            <option value="ALL">All Event Statuses</option>
            <option value="UPCOMING">Upcoming Schedule</option>
            <option value="IN_PROGRESS">In Progress (Active Now)</option>
            <option value="COMPLETED">Completed Passes</option>
            <option value="TIMED_OUT">Timed Out</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        <div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full rounded-lg border border-border-default bg-[#060c18] px-3 py-2 text-xs text-text-primary outline-none focus:border-accent cursor-pointer"
          >
            <option value="ALL">All Event Categories</option>
            {EVENT_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Events Grid */}
      {loading ? (
        <div className="h-64 rounded-xl border border-border-subtle bg-card p-10 flex items-center justify-center text-xs text-text-dim">
          Scanning operational calendar…
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="rounded-xl border border-border-subtle bg-card p-12 text-center space-y-3">
          <Calendar size={32} className="mx-auto text-text-dim" />
          <p className="text-sm font-bold text-white">
            {tabMode === "LIVE_FUTURE" ? "No Active or Future Events Found" : "No Past Archived Events Found"}
          </p>
          <p className="text-xs text-text-dim">Schedule a new mission event or adjust your active search filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEvents.map((ev) => {
            const meta = EVENT_TYPES.find((t) => t.id === ev.eventType) || EVENT_TYPES[0]
            const Icon = meta.icon
            const isPast = tabMode === "PAST"
            const status = ev.status as string

            const d = new Date(ev.eventDate)
            const dateStrIST = d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", month: "short", day: "numeric" })
            const timeStrIST = d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })
            const timeStrUTC = d.toLocaleTimeString("en-US", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hour12: false })

            return (
              <div
                key={ev.id}
                className={`rounded-xl border p-4.5 flex flex-col justify-between space-y-4 shadow-sm transition-all ${
                  isPast
                    ? "border-border-subtle bg-[#080e1a] opacity-80 hover:opacity-100"
                    : "border-border-default bg-card hover:border-accent/40"
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase ${meta.color}`}>
                      <Icon size={12} />
                      <span>{meta.label.split(" ")[0]}</span>
                    </span>

                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold font-mono ${
                        status === "UPCOMING"
                          ? "bg-accent/10 text-accent-light border border-accent/30"
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

                  <div>
                    <h3 className="text-sm font-bold text-white line-clamp-1">{ev.title}</h3>
                    {ev.description && (
                      <p className="text-xs text-text-secondary line-clamp-2 mt-1 leading-relaxed">
                        {ev.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Timestamps: Dual IST and UTC */}
                <div className="space-y-2 pt-3 border-t border-border-subtle text-xs">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <div className="flex items-center gap-1.5 text-white">
                      <Clock size={12} className="text-accent-light shrink-0" />
                      <span>{dateStrIST}, {timeStrIST} <span className="text-accent-light font-bold">IST</span></span>
                    </div>
                    <span className="text-text-dim bg-surface px-1.5 py-0.5 rounded border border-border-subtle">
                      {timeStrUTC} UTC
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-[11px]">
                    <div className="flex items-center gap-1 text-text-dim truncate max-w-[150px]">
                      <MapPin size={12} className="shrink-0" />
                      <span className="truncate">{ev.location || "ISTRAC MOX"}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(ev)}
                        className="p-1.5 rounded-lg border border-border-subtle text-text-dim hover:text-white hover:bg-card-hover transition-colors"
                        title="Edit Event"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingEvent(ev)}
                        className="p-1.5 rounded-lg border border-border-subtle text-text-dim hover:text-critical hover:bg-critical/10 transition-colors"
                        title="Delete Event"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingEvent ? "Edit Mission Event" : "Schedule New Mission Event"}
          size="lg"
        >
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-text-dim uppercase mb-1">Event Title *</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Aditya-L1 Halo Orbit Maneuver Burn"
                className="w-full rounded-lg border border-border-default bg-[#060c18] px-3 py-2 text-xs text-white outline-none focus:border-accent"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-text-dim uppercase mb-1">Category *</label>
                <select
                  value={formData.eventType}
                  onChange={(e) => setFormData({ ...formData, eventType: e.target.value as any })}
                  className="w-full rounded-lg border border-border-default bg-[#060c18] px-3 py-2 text-xs text-white outline-none focus:border-accent"
                >
                  {EVENT_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-dim uppercase mb-1">Spacecraft Fleet</label>
                <select
                  value={formData.satelliteId}
                  onChange={(e) => setFormData({ ...formData, satelliteId: e.target.value })}
                  className="w-full rounded-lg border border-border-default bg-[#060c18] px-3 py-2 text-xs text-white outline-none focus:border-accent"
                >
                  <option value="">No Spacecraft (Facility)</option>
                  {satellites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Time Frame Selector */}
            <div className="rounded-lg border border-border-subtle bg-surface/50 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Globe size={13} className="text-accent-light" />
                  Time Reference Selection
                </span>
                <div className="flex items-center gap-1 bg-[#060c18] p-0.5 rounded border border-border-default">
                  <button
                    type="button"
                    onClick={() => setInputTz("IST")}
                    className={`px-2.5 py-0.5 text-[10px] font-bold rounded ${
                      inputTz === "IST" ? "bg-accent text-white" : "text-text-dim hover:text-white"
                    }`}
                  >
                    IST (UTC+5:30)
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputTz("UTC")}
                    className={`px-2.5 py-0.5 text-[10px] font-bold rounded ${
                      inputTz === "UTC" ? "bg-accent text-white" : "text-text-dim hover:text-white"
                    }`}
                  >
                    UTC (Zulu)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-text-dim mb-1">
                    Event Start Time ({inputTz}) *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.eventDate}
                    onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
                    className="w-full rounded-lg border border-border-default bg-[#060c18] px-3 py-2 text-xs text-white outline-none focus:border-accent num"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-text-dim mb-1">
                    Event End Time ({inputTz})
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full rounded-lg border border-border-default bg-[#060c18] px-3 py-2 text-xs text-white outline-none focus:border-accent num"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-text-dim uppercase mb-1">Station Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g. IDSN Byalalu (32m)"
                  className="w-full rounded-lg border border-border-default bg-[#060c18] px-3 py-2 text-xs text-white outline-none focus:border-accent"
                />
              </div>

              {editingEvent && (
                <div>
                  <label className="block text-xs font-bold text-text-dim uppercase mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full rounded-lg border border-border-default bg-[#060c18] px-3 py-2 text-xs text-white outline-none focus:border-accent"
                  >
                    <option value="UPCOMING">Upcoming</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="TIMED_OUT">Timed Out</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-text-dim uppercase mb-1">Urgency</label>
                <select
                  value={formData.urgency}
                  onChange={(e) => setFormData({ ...formData, urgency: e.target.value as any })}
                  className="w-full rounded-lg border border-border-default bg-[#060c18] px-3 py-2 text-xs text-white outline-none focus:border-accent"
                >
                  <option value="NORMAL">Normal</option>
                  <option value="IMPORTANT">Important</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-text-dim uppercase mb-1">Operational Description</label>
              <Textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Doppler telemetry correlation parameters and pass acquisition timeline…"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="showOnBanner"
                checked={formData.showOnBanner}
                onChange={(e) => setFormData({ ...formData, showOnBanner: e.target.checked })}
                className="h-4 w-4 rounded border-border-default bg-[#060c18] accent-accent"
              />
              <label htmlFor="showOnBanner" className="text-xs text-text-secondary cursor-pointer">
                Broadcast on live top announcement ticker & public banner
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-border-subtle">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={submitting}>
                {submitting ? "Saving…" : editingEvent ? "Update Event" : "Schedule Event"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingEvent && (
        <Modal
          isOpen={Boolean(deletingEvent)}
          onClose={() => setDeletingEvent(null)}
          title="Delete Mission Event"
          size="sm"
        >
          <div className="space-y-4 pt-2">
            <p className="text-xs text-text-muted">
              Are you sure you want to remove this operational pass from the schedule?
            </p>

            <div className="p-3 rounded-lg border border-critical/30 bg-critical/10 text-xs text-white space-y-1">
              <p className="font-bold">{deletingEvent.title}</p>
              <p className="text-text-dim num">
                IST: {new Date(deletingEvent.eventDate).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} | 
                UTC: {new Date(deletingEvent.eventDate).toLocaleString("en-US", { timeZone: "UTC" })}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setDeletingEvent(null)}>
                Cancel
              </Button>
              <Button type="button" variant="danger" size="sm" onClick={handleDelete}>
                Confirm Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}