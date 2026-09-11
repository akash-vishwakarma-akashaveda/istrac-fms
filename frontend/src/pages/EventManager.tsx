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
} from "lucide-react"
import { eventsApi, type MissionEventItem } from "../api/events.api"
import { useDepartments } from "../hooks/useDepartments"
import { useAdminSatellites } from "../hooks/useSatellites"
import { useToastStore } from "../store/toastStore"
import { useQueryClient } from "@tanstack/react-query"
import { useSearchParams } from "react-router-dom"
import { PageHeader, Button, Modal, Textarea } from "../components"
import { schedulerApi } from "../api/schedule.api"

const DEFAULT_CATEGORY_MAP: Record<string, { icon: any; color: string; dot: string; bullet: string }> = {
  MISSION_PASS: { icon: Radio, color: "text-nominal bg-nominal/15 border-nominal/30", dot: "bg-nominal", bullet: "🟢" },
  LAUNCH: { icon: Flame, color: "text-purple-400 bg-purple-400/15 border-purple-400/30", dot: "bg-purple-500", bullet: "🟣" },
  ORBIT_MANEUVER: { icon: Sparkles, color: "text-orange-400 bg-orange-400/15 border-orange-400/30", dot: "bg-orange-400", bullet: "🟠" },
  MAINTENANCE: { icon: AlertTriangle, color: "text-accent-light bg-accent/15 border-accent/30", dot: "bg-accent", bullet: "🔵" },
  SEMINAR: { icon: Building2, color: "text-emerald-400 bg-emerald-400/15 border-emerald-400/30", dot: "bg-emerald-400", bullet: "🟢" },
  ANOMALY: { icon: Flame, color: "text-critical bg-critical/15 border-critical/30", dot: "bg-critical", bullet: "🔴" },
}

const CUSTOM_CATEGORY_PALETTE = [
  { icon: Sparkles, color: "text-cyan-400 bg-cyan-400/15 border-cyan-400/30", dot: "bg-cyan-400", bullet: "🔷" },
  { icon: Sparkles, color: "text-pink-400 bg-pink-400/15 border-pink-400/30", dot: "bg-pink-400", bullet: "🌸" },
  { icon: Sparkles, color: "text-amber-400 bg-amber-400/15 border-amber-400/30", dot: "bg-amber-400", bullet: "🟡" },
  { icon: Sparkles, color: "text-indigo-400 bg-indigo-400/15 border-indigo-400/30", dot: "bg-indigo-400", bullet: "🟣" },
  { icon: Sparkles, color: "text-lime-400 bg-lime-400/15 border-lime-400/30", dot: "bg-lime-400", bullet: "🟩" },
]

export type EventTabMode = "LIVE_FUTURE" | "PAST"

/** Formats any Date or ISO string into YYYY-MM-DDTHH:mm in Indian Standard Time (Asia/Kolkata) */
const formatISTForInput = (d: Date | string | null | undefined): string => {
  if (!d) return ""
  const date = typeof d === "string" ? new Date(d) : d
  if (isNaN(date.getTime())) return ""

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
  const parts = formatter.formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "00"
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`
}

/** Parses IST datetime-local input string (YYYY-MM-DDTHH:mm) to UTC ISO string */
const parseISTToISO = (inputStr: string): string => {
  if (!inputStr) return ""
  // Append +05:30 to explicitly anchor the string to Indian Standard Time
  return new Date(`${inputStr}:00+05:30`).toISOString()
}

export function EventManager() {
  const addToast = useToastStore((s) => s.addToast)
  const { data: departments } = useDepartments()
  const { data: adminSatellites } = useAdminSatellites()
  const satellites = useMemo(() => adminSatellites || [], [adminSatellites])

  const [events, setEvents] = useState<MissionEventItem[]>([])
  const [locations, setLocations] = useState<string[]>([])
  const [categories, setCategories] = useState<Array<{ id: string; label: string }>>([])
  const [isAddingLocation, setIsAddingLocation] = useState(false)
  const [newLocationInput, setNewLocationInput] = useState("")
  const [isAddingCategory, setIsAddingCategory] = useState(false)
  const [newCategoryLabel, setNewCategoryLabel] = useState("")

  const [searchParams] = useSearchParams()
  const targetEventId = searchParams.get("eventId")
  const urlTab = searchParams.get("tab")

  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [tabMode, setTabMode] = useState<EventTabMode>(urlTab?.toUpperCase() === "PAST" ? "PAST" : "LIVE_FUTURE")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [typeFilter, setTypeFilter] = useState("ALL")
  const queryClient = useQueryClient()

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<MissionEventItem | null>(null)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    eventType: "MISSION_PASS",
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

  // Dropdown item delete double confirmation box
  const [dropdownDeleteTarget, setDropdownDeleteTarget] = useState<{
    type: "location" | "category"
    id: string
    label: string
  } | null>(null)
  const [deletingDropdownItem, setDeletingDropdownItem] = useState(false)

  const getCategoryMeta = (typeId: string) => {
    const cat = categories.find((c) => c.id === typeId)
    const defaults = DEFAULT_CATEGORY_MAP[typeId]
    if (defaults) {
      return {
        id: typeId,
        label: cat ? cat.label : typeId.replace(/_/g, " "),
        icon: defaults.icon,
        color: defaults.color,
        dot: defaults.dot,
        bullet: defaults.bullet,
      }
    }
    const customCats = categories.filter((c) => !DEFAULT_CATEGORY_MAP[c.id])
    const customIdx = customCats.findIndex((c) => c.id === typeId)
    const palette = CUSTOM_CATEGORY_PALETTE[(customIdx >= 0 ? customIdx : 0) % CUSTOM_CATEGORY_PALETTE.length]
    return {
      id: typeId,
      label: cat ? cat.label : typeId.replace(/_/g, " "),
      icon: palette.icon,
      color: palette.color,
      dot: palette.dot,
      bullet: palette.bullet,
    }
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const [eventsData, schedulerData, configData] = await Promise.all([
        eventsApi.getEvents({ limit: 200 }),
        schedulerApi.getMissionEventScheduler().catch(() => null),
        eventsApi.getEventConfig().catch(() => ({ locations: [], categories: [] })),
      ])
      setEvents(eventsData || [])
      if (schedulerData) {
        setSchedulerInterval(schedulerData.interval)
      }
      if (configData) {
        if (configData.locations?.length) setLocations(configData.locations)
        if (configData.categories?.length) setCategories(configData.categories)
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

  // Automatically navigate to PAST or LIVE_FUTURE tab and scroll to card when eventId is present in URL
  useEffect(() => {
    if (!targetEventId || loading) return

    let isMounted = true
    const targetEvent = events.find((ev) => ev.id === targetEventId)

    if (!targetEvent && events.length > 0) {
      eventsApi
        .getEventById(targetEventId)
        .then((fetched) => {
          if (!isMounted || !fetched) return
          setEvents((prev) => {
            if (prev.some((e) => e.id === fetched.id)) return prev
            return [...prev, fetched]
          })
        })
        .catch(() => {})
      return
    }

    if (!targetEvent) return

    const isPast = pastEvents.some((ev) => ev.id === targetEventId)
    const isLive = liveFutureEvents.some((ev) => ev.id === targetEventId)

    if (isPast) {
      setTabMode("PAST")
    } else if (isLive) {
      setTabMode("LIVE_FUTURE")
    }

    // Clear filters if they would hide the targeted event
    if (statusFilter !== "ALL" && targetEvent.status !== statusFilter) {
      setStatusFilter("ALL")
    }
    if (typeFilter !== "ALL" && targetEvent.eventType !== typeFilter) {
      setTypeFilter("ALL")
    }

    const timer = setTimeout(() => {
      const el = document.getElementById(`event-card-${targetEventId}`)
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" })
      }
    }, 250)

    return () => {
      isMounted = false
      clearTimeout(timer)
    }
  }, [targetEventId, loading, events, pastEvents, liveFutureEvents])

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
    setIsAddingLocation(false)
    setIsAddingCategory(false)
    setFormData({
      title: "",
      description: "",
      eventType: categories[0]?.id || "MISSION_PASS",
      satelliteId: "",
      departmentId: "", // Explicitly empty: defaults to All-Facility (no hardcoded FDD)
      eventDate: formatISTForInput(new Date()),
      endDate: "",
      location: locations[0] || "ISTRAC MOX Bengaluru",
      urgency: "NORMAL",
      status: "UPCOMING",
      showOnBanner: true,
    })
    setIsModalOpen(true)
  }

  const openEditModal = (ev: MissionEventItem) => {
    setEditingEvent(ev)
    setIsAddingLocation(false)
    setIsAddingCategory(false)
    setFormData({
      title: ev.title,
      description: ev.description || "",
      eventType: ev.eventType,
      satelliteId: ev.satelliteId || "",
      departmentId: ev.departmentId || "",
      eventDate: formatISTForInput(ev.eventDate),
      endDate: formatISTForInput(ev.endDate),
      location: ev.location || (locations[0] || "ISTRAC MOX Bengaluru"),
      urgency: ev.urgency,
      status: ev.status,
      showOnBanner: ev.showOnBanner,
    })
    setIsModalOpen(true)
  }

  const handleAddLocation = async () => {
    const trimmed = newLocationInput.trim()
    if (!trimmed) return
    try {
      const updated = await eventsApi.addLocation(trimmed)
      setLocations(updated)
      setFormData((prev) => ({ ...prev, location: trimmed }))
      setNewLocationInput("")
      setIsAddingLocation(false)
      addToast({ title: "Location Added", message: `Added "${trimmed}" to station locations`, variant: "success" })
    } catch (err: any) {
      addToast({
        title: "Error",
        message: err.response?.data?.error?.message || "Failed to add location",
        variant: "error",
      })
    }
  }

  const handleAddCategory = async () => {
    const trimmed = newCategoryLabel.trim()
    if (!trimmed) return
    try {
      const updated = await eventsApi.addCategory({ label: trimmed })
      setCategories(updated)
      const newlyAdded = updated.find((c) => c.label.toLowerCase() === trimmed.toLowerCase())
      if (newlyAdded) {
        setFormData((prev) => ({ ...prev, eventType: newlyAdded.id }))
      }
      setNewCategoryLabel("")
      setIsAddingCategory(false)
      addToast({ title: "Category Added", message: `Added category "${trimmed}"`, variant: "success" })
    } catch (err: any) {
      addToast({
        title: "Error",
        message: err.response?.data?.error?.message || "Failed to add category",
        variant: "error",
      })
    }
  }

  const handleConfirmDropdownDelete = async () => {
    if (!dropdownDeleteTarget) return
    setDeletingDropdownItem(true)
    try {
      if (dropdownDeleteTarget.type === "category") {
        const updated = await eventsApi.deleteCategory(dropdownDeleteTarget.id)
        setCategories(updated)
        if (formData.eventType === dropdownDeleteTarget.id) {
          setFormData((prev) => ({ ...prev, eventType: updated[0]?.id || "MISSION_PASS" }))
        }
        addToast({
          title: "Category Deleted",
          message: `Removed "${dropdownDeleteTarget.label}" from event categories`,
          variant: "info",
        })
      } else {
        const updated = await eventsApi.deleteLocation(dropdownDeleteTarget.id)
        setLocations(updated)
        if (formData.location === dropdownDeleteTarget.id) {
          setFormData((prev) => ({ ...prev, location: updated[0] || "" }))
        }
        addToast({
          title: "Location Deleted",
          message: `Removed "${dropdownDeleteTarget.label}" from station locations`,
          variant: "info",
        })
      }
      setDropdownDeleteTarget(null)
    } catch (err: any) {
      addToast({
        title: "Error",
        message: err.response?.data?.error?.message || "Failed to delete item",
        variant: "error",
      })
    } finally {
      setDeletingDropdownItem(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim() || !formData.eventDate) {
      addToast({ title: "Validation Error", message: "Title and Event Date are required", variant: "warning" })
      return
    }

    if (formData.endDate && formData.endDate <= formData.eventDate) {
      addToast({
        title: "Validation Error",
        message: "Event end time must be chronologically after the start time",
        variant: "warning",
      })
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        ...formData,
        satelliteId: formData.satelliteId || null,
        departmentId: formData.departmentId || null,
        eventDate: parseISTToISO(formData.eventDate),
        endDate: formData.endDate ? parseISTToISO(formData.endDate) : null,
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
      queryClient.invalidateQueries({ queryKey: ["events"] })
      queryClient.invalidateQueries({ queryKey: ["active-banner"] })
      queryClient.invalidateQueries({ queryKey: ["notifications"] })
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
      queryClient.invalidateQueries({ queryKey: ["events"] })
      queryClient.invalidateQueries({ queryKey: ["active-banner"] })
      queryClient.invalidateQueries({ queryKey: ["notifications"] })
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
          description="Schedule spacecraft telemetry passes, rocket launch windows, orbit determination maneuvers, and station maintenance windows in Indian Standard Time (IST)."
        />

        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={openCreateModal}
          className="shadow-md shadow-accent/25 shrink-0 w-full sm:w-auto justify-center"
        >
          <Plus size={14} />
          <span>Schedule Mission Event</span>
        </Button>
      </div>

      {/* Tabs & Scheduler Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border-subtle gap-3 pb-2 sm:pb-0">
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto -mb-px">
          <button
            type="button"
            onClick={() => setTabMode("LIVE_FUTURE")}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              tabMode === "LIVE_FUTURE"
                ? "border-accent text-accent-light bg-accent/10 rounded-t-lg"
                : "border-transparent text-text-dim hover:text-white"
            }`}
          >
            <Zap size={14} className={tabMode === "LIVE_FUTURE" ? "animate-pulse text-accent-light" : ""} />
            <span>Live & Future Events</span>
            <span className="num rounded-full bg-accent/20 px-1.5 sm:px-2 py-0.5 text-[10px] font-bold text-accent-light">
              {liveFutureEvents.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTabMode("PAST")}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              tabMode === "PAST"
                ? "border-accent text-accent-light bg-accent/10 rounded-t-lg"
                : "border-transparent text-text-dim hover:text-white"
            }`}
          >
            <History size={14} />
            <span>Past & Completed Events</span>
            <span className="num rounded-full bg-surface px-1.5 sm:px-2 py-0.5 text-[10px] font-bold text-text-dim">
              {pastEvents.length}
            </span>
          </button>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto pt-1 sm:pt-0 border-t border-border-subtle/40 sm:border-t-0">
          <div className="flex items-center gap-2">
            <Clock size={13} className="text-accent-light shrink-0" />
            <span className="text-[11px] font-semibold text-text-dim whitespace-nowrap">
              Status Check
            </span>
            <select
              value={schedulerInterval}
              onChange={handleSchedulerChange}
              disabled={schedulerSaving}
              className="rounded-lg border border-border-default bg-[#060c18] px-2.5 py-1.5 sm:py-2 text-[11px] font-semibold text-white outline-none focus:border-accent cursor-pointer disabled:opacity-50"
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
            {categories.map((c) => {
              const meta = getCategoryMeta(c.id)
              return (
                <option key={c.id} value={c.id}>
                  {meta.bullet} {c.label}
                </option>
              )
            })}
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
            const meta = getCategoryMeta(ev.eventType)
            const Icon = meta.icon
            const isPast = tabMode === "PAST"
            const status = ev.status as string
            const isTarget = targetEventId === ev.id

            const d = new Date(ev.eventDate)
            const dateStrIST = d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", month: "short", day: "numeric", year: "numeric" })
            const timeStrIST = d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })

            let endStrIST = ""
            if (ev.endDate) {
              const endD = new Date(ev.endDate)
              endStrIST = endD.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })
            }

            return (
              <div
                key={ev.id}
                id={`event-card-${ev.id}`}
                className={`rounded-xl border p-4.5 flex flex-col justify-between space-y-4 shadow-sm transition-all ${
                  isTarget
                    ? "border-accent ring-2 ring-accent/60 bg-[#0a1738] shadow-lg shadow-accent/15 scale-[1.01]"
                    : isPast
                    ? "border-border-subtle bg-[#080e1a] opacity-80 hover:opacity-100"
                    : "border-border-default bg-card hover:border-accent/40"
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] font-bold uppercase ${meta.color}`}>
                      <Icon size={12} />
                      <span className="line-clamp-1">{meta.label}</span>
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

                {/* Card Timestamps: Pure IST */}
                <div className="space-y-2 pt-3 border-t border-border-subtle text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px] font-mono">
                    <div className="flex items-center gap-1.5 text-white">
                      <Clock size={12} className="text-accent-light shrink-0" />
                      <span>
                        {dateStrIST} at {timeStrIST}
                        {endStrIST && ` - ${endStrIST}`} <span className="text-accent-light font-bold">IST</span>
                      </span>
                    </div>
                    {ev.department?.code ? (
                      <span className="text-accent-light bg-accent/10 border border-accent/20 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono">
                        {ev.department.code}
                      </span>
                    ) : (
                      <span className="text-text-dim bg-surface px-1.5 py-0.5 rounded border border-border-subtle text-[10px]">
                        Facility-Wide
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1 text-[11px] gap-2">
                    <div className="flex items-center gap-2 truncate min-w-0 flex-1">
                      {ev.satellite && (
                        <span className="font-mono text-cyan-400 shrink-0 font-semibold text-[10px] bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">
                          {ev.satellite.code || ev.satellite.name}
                        </span>
                      )}
                      <div className="flex items-center gap-1 text-text-dim truncate">
                        <MapPin size={12} className="shrink-0" />
                        <span className="truncate">{ev.location || "ISTRAC MOX"}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditModal(ev)}
                        className="p-2 sm:p-1.5 rounded-lg border border-border-subtle text-text-dim hover:text-white hover:bg-card-hover transition-colors cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center"
                        title="Edit Event"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingEvent(ev)}
                        className="p-2 sm:p-1.5 rounded-lg border border-border-subtle text-text-dim hover:text-critical hover:bg-critical/10 transition-colors cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center"
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
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            {/* Event Title */}
            <div>
              <label className="block text-xs font-bold text-text-dim uppercase mb-1.5 flex flex-wrap items-center justify-between gap-1">
                <span>
                  Event Title <span className="text-critical">*</span>
                </span>
                <span className="text-[10px] font-normal text-text-dim lowercase">concise operational description</span>
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Aditya-L1 Halo Orbit Maneuver Burn"
                className="w-full rounded-lg border border-border-default bg-[#060c18] px-3.5 py-2.5 text-base sm:text-xs text-white placeholder:text-text-dim/60 outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all min-h-[42px] sm:min-h-[38px]"
              />
            </div>

            {/* Symmetrical Row 1: Spacecraft Fleet & Operational Division (both standard dropdowns) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Spacecraft Fleet */}
              <div>
                <label className="block text-xs font-bold text-text-dim uppercase mb-1.5">
                  Spacecraft Fleet
                </label>
                <select
                  value={formData.satelliteId}
                  onChange={(e) => setFormData({ ...formData, satelliteId: e.target.value })}
                  className="w-full rounded-lg border border-border-default bg-[#060c18] px-3.5 py-2.5 text-base sm:text-xs text-white outline-none focus:border-accent focus:ring-1 focus:ring-accent cursor-pointer transition-all min-h-[42px] sm:min-h-[38px]"
                >
                  <option value="">No Spacecraft (Ground Facility Pass)</option>
                  {satellites.map((s) => {
                    const hasCode = s.code && s.name.toLowerCase().includes(s.code.toLowerCase())
                    const label = s.code && !hasCode ? `${s.name} (${s.code})` : s.name
                    return (
                      <option key={s.id} value={s.id}>
                        {label}
                      </option>
                    )
                  })}
                </select>
              </div>

              {/* Operational Division Dropdown */}
              <div>
                <label className="block text-xs font-bold text-text-dim uppercase mb-1.5">
                  Operational Division
                </label>
                <select
                  value={formData.departmentId}
                  onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                  className="w-full rounded-lg border border-border-default bg-[#060c18] px-3.5 py-2.5 text-base sm:text-xs text-white outline-none focus:border-accent focus:ring-1 focus:ring-accent cursor-pointer transition-all min-h-[42px] sm:min-h-[38px]"
                >
                  <option value="">All-Facility / Multi-Division</option>
                  {departments?.map((d) => {
                    const label = d.code && !d.name.includes(`(${d.code})`) ? `${d.name} (${d.code})` : d.name
                    return (
                      <option key={d.id} value={d.id}>
                        {label}
                      </option>
                    )
                  })}
                </select>
              </div>
            </div>

            {/* Symmetrical Row 2: Category & Station Location (both with + Add Custom & Delete) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Category (Event Type) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-text-dim uppercase">
                    Category (Event Type) <span className="text-critical">*</span>
                  </label>
                  {!isAddingCategory && (
                    <button
                      type="button"
                      onClick={() => setIsAddingCategory(true)}
                      className="text-[11px] text-accent-light hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={11} />
                      <span>Add Custom</span>
                    </button>
                  )}
                </div>

                {isAddingCategory ? (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Deep Space Calibration"
                      value={newCategoryLabel}
                      onChange={(e) => setNewCategoryLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          handleAddCategory()
                        }
                      }}
                      className="flex-1 min-w-0 rounded-lg border border-accent bg-[#060c18] px-3.5 py-2 text-base sm:text-xs text-white outline-none focus:ring-1 focus:ring-accent min-h-[42px] sm:min-h-[36px]"
                      autoFocus
                    />
                    <div className="flex items-center gap-2 justify-end shrink-0">
                      <Button type="button" size="sm" variant="primary" onClick={handleAddCategory} className="flex-1 sm:flex-none justify-center">
                        Add
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setIsAddingCategory(false)
                          setNewCategoryLabel("")
                        }}
                        className="flex-1 sm:flex-none justify-center"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <select
                        value={formData.eventType}
                        onChange={(e) => setFormData({ ...formData, eventType: e.target.value })}
                        className="flex-1 min-w-0 rounded-lg border border-border-default bg-[#060c18] px-3.5 py-2.5 text-base sm:text-xs text-white outline-none focus:border-accent focus:ring-1 focus:ring-accent cursor-pointer truncate transition-all min-h-[42px] sm:min-h-[38px]"
                      >
                        {categories.map((c) => {
                          const meta = getCategoryMeta(c.id)
                          return (
                            <option key={c.id} value={c.id}>
                              {meta.bullet} {c.label}
                            </option>
                          )
                        })}
                      </select>
                      {categories.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setDropdownDeleteTarget({
                              type: "category",
                              id: formData.eventType,
                              label: categories.find((c) => c.id === formData.eventType)?.label || formData.eventType,
                            })
                          }
                          title={`Delete category "${categories.find((c) => c.id === formData.eventType)?.label || formData.eventType}"`}
                          className="h-[42px] w-[42px] sm:h-[38px] sm:w-[38px] shrink-0 flex items-center justify-center rounded-lg border border-border-default bg-[#060c18] text-text-dim hover:text-critical hover:border-critical/40 hover:bg-critical/10 transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>

                    {/* Live Category Style Preview Badge */}
                    <div className="flex items-center gap-2 px-1">
                      <span className="text-[10px] uppercase font-bold text-text-dim">Preview:</span>
                      <span className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] font-bold uppercase border ${getCategoryMeta(formData.eventType).color}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${getCategoryMeta(formData.eventType).dot}`} />
                        <span>{getCategoryMeta(formData.eventType).label}</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Station Location Dropdown with Add/Delete */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-text-dim uppercase">Station Location</label>
                  {!isAddingLocation && (
                    <button
                      type="button"
                      onClick={() => setIsAddingLocation(true)}
                      className="text-[11px] text-accent-light hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={11} />
                      <span>Add Custom</span>
                    </button>
                  )}
                </div>

                {isAddingLocation ? (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Svalbard Ground Station"
                      value={newLocationInput}
                      onChange={(e) => setNewLocationInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          handleAddLocation()
                        }
                      }}
                      className="flex-1 min-w-0 rounded-lg border border-accent bg-[#060c18] px-3.5 py-2 text-base sm:text-xs text-white outline-none focus:ring-1 focus:ring-accent min-h-[42px] sm:min-h-[36px]"
                      autoFocus
                    />
                    <div className="flex items-center gap-2 justify-end shrink-0">
                      <Button type="button" size="sm" variant="primary" onClick={handleAddLocation} className="flex-1 sm:flex-none justify-center">
                        Add
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setIsAddingLocation(false)
                          setNewLocationInput("")
                        }}
                        className="flex-1 sm:flex-none justify-center"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <select
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="flex-1 min-w-0 rounded-lg border border-border-default bg-[#060c18] px-3.5 py-2.5 text-base sm:text-xs text-white outline-none focus:border-accent focus:ring-1 focus:ring-accent cursor-pointer truncate transition-all min-h-[42px] sm:min-h-[38px]"
                    >
                      {locations.map((loc) => (
                        <option key={loc} value={loc}>
                          {loc}
                        </option>
                      ))}
                    </select>
                    {locations.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setDropdownDeleteTarget({
                            type: "location",
                            id: formData.location,
                            label: formData.location,
                          })
                        }
                        title={`Delete station location "${formData.location}"`}
                        className="h-[42px] w-[42px] sm:h-[38px] sm:w-[38px] shrink-0 flex items-center justify-center rounded-lg border border-border-default bg-[#060c18] text-text-dim hover:text-critical hover:border-critical/40 hover:bg-critical/10 transition-colors cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Time Frame Card - Strictly IST */}
            <div className="rounded-xl border border-border-subtle bg-[#060d1b]/70 p-3.5 sm:p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle/60 pb-2.5">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <Clock size={13} className="text-accent-light" />
                  <span>Event Schedule (Indian Standard Time - IST)</span>
                </span>
                <span className="text-[10px] font-mono font-bold text-accent-light bg-accent/10 border border-accent/25 px-2.5 py-0.5 rounded-full">
                  UTC +05:30
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-text-dim mb-1.5">
                    Event Start Time (IST) <span className="text-critical">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.eventDate}
                    onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
                    className="w-full rounded-lg border border-border-default bg-[#060c18] px-3.5 py-2.5 text-base sm:text-xs text-white outline-none focus:border-accent focus:ring-1 focus:ring-accent num transition-all min-h-[42px] sm:min-h-[38px] [color-scheme:dark]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-text-dim mb-1.5 flex items-center justify-between">
                    <span>Event End Time (IST)</span>
                    <span className="text-[10px] text-text-dim font-normal">optional</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full rounded-lg border border-border-default bg-[#060c18] px-3.5 py-2.5 text-base sm:text-xs text-white outline-none focus:border-accent focus:ring-1 focus:ring-accent num transition-all min-h-[42px] sm:min-h-[38px] [color-scheme:dark]"
                  />
                </div>
              </div>
            </div>

            {/* Urgency & Status */}
            <div className={`grid grid-cols-1 ${editingEvent ? "sm:grid-cols-2" : ""} gap-3.5`}>
              <div>
                <label className="block text-xs font-bold text-text-dim uppercase mb-1.5">Urgency Priority</label>
                <select
                  value={formData.urgency}
                  onChange={(e) => setFormData({ ...formData, urgency: e.target.value as any })}
                  className="w-full rounded-lg border border-border-default bg-[#060c18] px-3.5 py-2.5 text-base sm:text-xs text-white outline-none focus:border-accent focus:ring-1 focus:ring-accent cursor-pointer transition-all min-h-[42px] sm:min-h-[38px]"
                >
                  <option value="NORMAL">Normal</option>
                  <option value="IMPORTANT">Important</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>

              {editingEvent && (
                <div>
                  <label className="block text-xs font-bold text-text-dim uppercase mb-1.5">Mission Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full rounded-lg border border-border-default bg-[#060c18] px-3.5 py-2.5 text-base sm:text-xs text-white outline-none focus:border-accent focus:ring-1 focus:ring-accent cursor-pointer transition-all min-h-[42px] sm:min-h-[38px]"
                  >
                    <option value="UPCOMING">Upcoming</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="TIMED_OUT">Timed Out</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-text-dim uppercase mb-1.5">Operational Description</label>
              <Textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Telemetry correlation parameters, antenna elevation angles, and pass acquisition timeline…"
                className="w-full rounded-lg border border-border-default bg-[#060c18] px-3.5 py-2.5 text-base sm:text-xs text-white outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all resize-none min-h-[80px]"
              />
            </div>

            {/* Sticky Action Footer (Always visible) */}
            <div className="sticky bottom-0 -mx-4 sm:-mx-5 -mb-4 sm:-mb-5 px-4 sm:px-5 py-3 border-t border-border-subtle bg-[#080e1b]/95 backdrop-blur-md flex items-center justify-end gap-2.5 z-10">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 sm:flex-none justify-center"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={submitting}
                className="flex-1 sm:flex-none justify-center font-bold"
              >
                {submitting ? "Saving…" : editingEvent ? "Update Event" : "Schedule Event"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* DROPDOWN ITEM DELETE DOUBLE CONFIRMATION BOX */}
      {dropdownDeleteTarget && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => {
            if (!deletingDropdownItem) setDropdownDeleteTarget(null)
          }}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-critical/30 bg-[#0a1120] p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-critical/15 text-critical shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">
                  Remove {dropdownDeleteTarget.type === "location" ? "Station Location" : "Event Category"}?
                </h4>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Are you sure you want to remove{" "}
                  <span className="font-semibold text-white">"{dropdownDeleteTarget.label}"</span> from the dropdown?
                </p>
                <p className="text-[11px] text-text-dim">
                  Historical and existing events will remain unaffected.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={deletingDropdownItem}
                onClick={() => setDropdownDeleteTarget(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={deletingDropdownItem}
                onClick={handleConfirmDropdownDelete}
              >
                {deletingDropdownItem ? "Deleting…" : "Confirm Delete"}
              </Button>
            </div>
          </div>
        </div>
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
                Scheduled (IST): {new Date(deletingEvent.eventDate).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
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