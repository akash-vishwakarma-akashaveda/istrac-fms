import { useMemo, useState } from "react"
import {
  Bell,
  CheckCheck,
  Radio,
  AlertTriangle,
  Flame,
  Search,
  Calendar,
  FolderArchive,
  Megaphone,
  ArrowUpRight,
  Clock,
  Check,
  X,
  FileText,
} from "lucide-react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { useNotifications, useMarkAllRead, useMarkRead } from "../hooks/useNotifications"
import { useActiveBanner } from "../hooks/useActiveBanner"
import { useSatellites } from "../hooks/useSatellites"
import { eventsApi, type MissionEventItem } from "../api/events.api"
import { Button, PageHeader } from "../components"
import { useAuthStore } from "../store/authStore"
import { kindOf } from "../lib/notificationKind"

const TABS = [
  { id: "ALL", label: "All Operational Alerts", icon: Bell },
  { id: "BROADCASTS", label: "Station Broadcasts", icon: Megaphone },
  { id: "EVENTS", label: "Passes & Mission Events", icon: Radio },
  { id: "FILES", label: "File Ingests", icon: FileText },
  { id: "UNREAD", label: "Unacknowledged", icon: AlertTriangle },
] as const

export function NotificationsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const highlightId = searchParams.get("highlight")
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === "ADMIN"

  const [activeTab, setActiveTab] = useState<string>("ALL")
  const [searchQuery, setSearchQuery] = useState("")
  const [broadcastLabelFilter, setBroadcastLabelFilter] = useState("ALL")
  const { data: bannerData } = useActiveBanner()

  const { data, fetchNextPage, hasNextPage } = useNotifications()
  const markAllRead = useMarkAllRead()
  const markRead = useMarkRead()

  const { data: userSatellites = [] } = useSatellites()
  const userSatIds = useMemo(() => new Set(userSatellites.map((s) => s.id)), [userSatellites])

  const userDeptIds = new Set(
    (user?.departmentAccess || [])
      .map((d) => d.departmentId || d.department?.id)
      .filter((id): id is string => Boolean(id))
  )
  const userDeptNames = new Set(
    (user?.departmentAccess || [])
      .map((d) => d.department?.name?.toLowerCase().trim())
      .filter((n): n is string => Boolean(n))
  )
  const userDeptCodes = new Set(
    (user?.departmentAccess || [])
      .map((d) => d.department?.code?.toLowerCase().trim())
      .filter((c): c is string => Boolean(c))
  )

  const rawNotifications: any[] = data?.pages.flatMap((p: any) => p.data || []) ?? []
  const allNotifications = rawNotifications.filter((n) => {
    if (isAdmin) return true
    const kind = kindOf(n)

    let meta: any = n.metadata
    if (typeof meta === "string") {
      try {
        meta = JSON.parse(meta)
      } catch {
        meta = {}
      }
    } else if (!meta) {
      meta = {}
    }

    // Mission/satellite access check
    if (meta.satelliteId && !userSatIds.has(meta.satelliteId)) {
      return false
    }

    if (kind === "file" || n.type === "FILE_UPLOAD" || n.category === "file") {
      const targetDeptId = meta.departmentId || (Array.isArray(meta.departmentIds) ? meta.departmentIds[0] : null)
      if (targetDeptId) {
        return userDeptIds.has(targetDeptId)
      }
      if (meta.satelliteId) {
        return userSatIds.has(meta.satelliteId)
      }
      if (meta.departmentName) {
        return userDeptNames.has(meta.departmentName.toLowerCase().trim())
      }
      if (meta.departmentCode) {
        return userDeptCodes.has(meta.departmentCode.toLowerCase().trim())
      }
      if (n.actorId && user?.id && n.actorId === user.id) {
        return true
      }
      return false
    }

    if (meta.target === "departments" && Array.isArray(meta.departmentIds)) {
      return meta.departmentIds.some((dId: string) => userDeptIds.has(dId))
    }
    if (meta.target === "all_departments") {
      return userDeptIds.size > 0
    }

    return true
  })

  // Filter based on active tab and search
  const filteredNotifications = allNotifications.filter((n) => {
    if (activeTab === "UNREAD" && n.readAt) return false
    const kind = kindOf(n)
    if (activeTab === "BROADCASTS" && kind !== "broadcast") return false
    if (activeTab === "BROADCASTS" && broadcastLabelFilter !== "ALL" && (n.label || "General") !== broadcastLabelFilter) return false
    if (activeTab === "EVENTS" && kind !== "event") return false
    if (activeTab === "FILES" && kind !== "file") return false

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return (
        n.message?.toLowerCase().includes(q) ||
        n.type?.toLowerCase().includes(q) ||
        n.category?.toLowerCase().includes(q) ||
        n.label?.toLowerCase().includes(q)
      )
    }
    return true
  })

  const unreadCount = allNotifications.filter((i) => !i.readAt).length
  const broadcastLabels = Array.from(
    new Set(allNotifications.filter((n) => kindOf(n) === "broadcast").map((n) => n.label || "General"))
  ).sort()

  // High-priority active broadcasts (exclude routine file uploads from the top marquee)
  const priorityBroadcasts = bannerData?.broadcasts?.filter((b: any) => kindOf(b) === "broadcast") || []

  const activePassEvents = bannerData?.events || []
  const hasLiveMarquee = priorityBroadcasts.length > 0 || activePassEvents.length > 0

  const { data: allEvents } = useQuery<MissionEventItem[]>({
    queryKey: ["events"],
    queryFn: () => eventsApi.getEvents({ limit: 200 }),
    staleTime: 30_000,
  })

  const handleNavigateEvent = (eventId?: string) => {
    const targetUrl = isAdmin ? "/admin/events" : "/dashboard/events"
    if (!eventId) {
      navigate(targetUrl)
      return
    }

    let tabParam = ""
    if (allEvents && allEvents.length > 0) {
      const ev = allEvents.find((e) => e.id === eventId)
      if (ev) {
        const now = new Date()
        const evDate = new Date(ev.eventDate)
        const endDate = ev.endDate ? new Date(ev.endDate) : null
        const status = ev.status as string
        const isTerminal = status === "COMPLETED" || status === "CANCELLED" || status === "TIMED_OUT"
        const isDateExpired = endDate ? endDate < now : evDate < now

        if (isTerminal || (status !== "IN_PROGRESS" && isDateExpired)) {
          tabParam = "&tab=PAST"
        } else {
          tabParam = "&tab=LIVE"
        }
      }
    }

    navigate(`${targetUrl}?eventId=${eventId}${tabParam}`)
  }

  const handleNavigateFile = () => {
    navigate("/dashboard/files")
  }

  return (
    <div className="w-full space-y-6 pb-24 text-text-primary">
      {/* Page Header */}
      <div className="border-b border-border-subtle pb-5">
        <PageHeader
          eyebrow="MISSION CONTROL & TELEMETRY FEEDS"
          title="Alerts, Broadcasts & Station Notices"
          description="Real-time operational stream consolidating emergency advisories, spacecraft tracking passes, station bulletins, and automated telemetry file ingests."
          meta={
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="rounded-full bg-accent/15 border border-accent/30 px-3 py-0.5 text-xs font-bold font-mono text-accent-light dark:text-accent-light flex items-center gap-1.5 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-accent-light animate-ping" />
                <span>{priorityBroadcasts.length + activePassEvents.length} Active Advisories</span>
              </span>
              <span className="text-xs text-text-dim font-mono">
                · {unreadCount > 0 ? `${unreadCount} Unacknowledged` : "All Caught Up"}
              </span>
            </div>
          }
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAllRead.mutate()}
                disabled={unreadCount === 0 || markAllRead.isPending}
                className="gap-1.5 border-border-default hover:border-accent text-xs font-semibold cursor-pointer shadow-sm"
              >
                <CheckCheck size={14} className="text-nominal" />
                <span>Acknowledge All</span>
              </Button>
            </div>
          }
        />
      </div>

      {/* 1. TOP PRIORITY ADVISORIES & PASSES */}
      {hasLiveMarquee && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-2">
              <Megaphone size={14} className="text-accent-light" />
              <span>Active Air-Gapped Station Advisories & Passes</span>
            </span>
            <span className="text-[11px] font-mono text-text-dim">
              Synchronized with MOX Command Center
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Live Operational Broadcasts */}
            {priorityBroadcasts.map((b) => {
              const isCritical = b.message.includes("[CRITICAL")
              const isImportant = b.message.includes("[IMPORTANT")

              return (
                <div
                  key={b.id}
                  className={`p-4 rounded-xl border flex items-start gap-3.5 transition-all shadow-sm ${
                    isCritical
                      ? "border-rose-300 bg-rose-50/70 text-text-primary dark:border-rose-500/50 dark:bg-card dark:hover:bg-card-hover dark:shadow-card"
                      : isImportant
                      ? "border-amber-300 bg-amber-50/70 text-text-primary dark:border-amber-500/50 dark:bg-card dark:hover:bg-card-hover dark:shadow-card"
                      : "border-sky-300 bg-sky-50/70 text-text-primary dark:border-secondary/40 dark:bg-card dark:hover:bg-card-hover dark:shadow-card"
                  }`}
                >
                  <div
                    className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border mt-0.5 shadow-xs ${
                      isCritical
                        ? "bg-rose-100 border-rose-300 text-rose-700 dark:bg-rose-500/20 dark:border-rose-500/40 dark:text-rose-400 animate-pulse"
                        : isImportant
                        ? "bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-500/20 dark:border-amber-500/40 dark:text-amber-300"
                        : "bg-sky-100 border-sky-300 text-sky-700 dark:bg-secondary/20 dark:border-secondary/40 dark:text-secondary-light"
                    }`}
                  >
                    {isCritical ? <Flame size={18} /> : isImportant ? <AlertTriangle size={18} /> : <Megaphone size={18} />}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full font-mono tracking-wider ${
                          isCritical
                            ? "bg-rose-600 text-white shadow-sm"
                            : isImportant
                            ? "bg-amber-500 text-black font-bold"
                            : "bg-sky-100 text-sky-800 border border-sky-300 dark:bg-secondary/20 dark:text-secondary-light dark:border-secondary/40"
                        }`}
                      >
                        {isCritical ? "CRITICAL ADVISORY" : isImportant ? "PRIORITY NOTICE" : "STATION BULLETIN"}
                      </span>
                      <span className="text-[11px] font-mono text-text-dim">
                        {new Date(b.createdAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })} IST
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm font-semibold leading-relaxed text-text-primary">
                      {b.message}
                    </p>
                  </div>
                </div>
              )
            })}

            {/* Active Mission Passes / Operational Events */}
            {activePassEvents.map((ev) => {
              const timeStr = new Date(ev.eventDate).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })

              return (
                <div
                  key={ev.id}
                  onClick={() => handleNavigateEvent(ev.id)}
                  className="p-4 rounded-xl border border-accent/40 bg-orange-50/50 dark:bg-card dark:hover:bg-card-hover hover:border-accent hover:shadow-card-hover text-text-primary flex items-start gap-3.5 cursor-pointer group transition-all shadow-sm dark:shadow-card"
                >
                  <div className="h-9 w-9 rounded-xl bg-accent/15 border border-accent/30 text-accent-light dark:text-accent-light flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform mt-0.5 shadow-xs">
                    <Radio size={18} className="animate-pulse" />
                  </div>

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-accent/15 text-accent-light dark:text-accent-light border border-accent/30 font-mono tracking-wider">
                          TRACKING PASS
                        </span>
                        {ev.satellite?.code && (
                          <span className="text-[10px] font-bold font-mono text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-400/30">
                            {ev.satellite.code}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-accent-light dark:text-accent-light font-bold">
                        {timeStr} UTC
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm font-bold text-text-primary group-hover:text-accent-light transition-colors">
                      {ev.title}
                    </p>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] sm:text-xs text-text-dim truncate">
                        {ev.location || "ISTRAC Deep Space Network"}
                      </span>
                      <span className="text-[11px] font-bold text-accent-light dark:text-accent-light flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                        <span>View Details</span>
                        <ArrowUpRight size={12} />
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 2. FILTER TABS & SEARCH BAR (STICKY ON SCROLL) */}
      <div className="sticky top-0 z-20 p-2.5 rounded-2xl bg-card/95 backdrop-blur-md border border-border-default shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 transition-all">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {TABS.map((t) => {
            const Icon = t.icon
            const isSelected = activeTab === t.id

            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? "bg-accent text-white shadow-sm border border-accent"
                    : "bg-surface text-text-secondary hover:text-text-primary hover:bg-card-hover border border-border-subtle"
                }`}
              >
                <Icon size={13} className={isSelected ? "text-white" : "text-text-dim"} />
                <span>{t.label}</span>
                {t.id === "UNREAD" && unreadCount > 0 && (
                  <span className="ml-1 rounded-full bg-critical-fill px-1.5 py-0.2 text-[10px] font-extrabold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Search Input Box */}
        <div className="relative w-full sm:w-auto sm:min-w-[280px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search alerts, filenames, passes…"
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-border-default bg-surface text-xs text-text-primary placeholder:text-text-dim outline-none focus:border-accent transition-colors shadow-inner"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-primary transition-colors cursor-pointer"
              title="Clear search query"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Broadcast category sub-filter (custom categories chosen by admins) */}
      {activeTab === "BROADCASTS" && broadcastLabels.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter broadcasts by category">
          <span className="text-[11px] font-semibold text-text-dim mr-1">Category:</span>
          {["ALL", ...broadcastLabels].map((label) => (
            <button
              key={label}
              type="button"
              aria-pressed={broadcastLabelFilter === label}
              onClick={() => setBroadcastLabelFilter(label)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                broadcastLabelFilter === label
                  ? "border-accent bg-accent/15 text-accent-light"
                  : "border-border-default text-text-secondary hover:text-text-primary"
              }`}
            >
              {label === "ALL" ? "All" : label}
            </button>
          ))}
        </div>
      )}

      {/* 3. ALERTS & NOTIFICATIONS FEED */}
      {filteredNotifications.length === 0 ? (
        <div className="rounded-2xl border border-border-default bg-card p-16 text-center space-y-3 shadow-sm">
          <div className="h-12 w-12 rounded-2xl bg-surface border border-border-default flex items-center justify-center mx-auto text-text-dim">
            <Bell size={24} />
          </div>
          <p className="text-sm font-bold text-text-primary">No Matching Notifications</p>
          <p className="text-xs text-text-dim max-w-sm mx-auto">
            All telemetry logs, operational passes, and broadcasts matching your current filter are caught up.
          </p>
          {searchQuery && (
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchQuery('')}
                className="cursor-pointer"
              >
                Clear Search Filter
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredNotifications.map((n: any) => {
            const isUnread = !n.readAt
            const isHighlighted = String(n.id) === highlightId
            const kind = kindOf(n)
            const isCritical = n.type === "CRITICAL" || n.type === "EMERGENCY" || n.message?.includes("[CRITICAL")
            const isPass = kind === "event"
            const isFile = kind === "file"
            const isImportant = n.type === "WARNING" || n.message?.includes("[IMPORTANT")

            // Notifications older than 24 hours must not be tagged or named as NEW
            const createdTime = n.createdAt
              ? new Date(n.createdAt).getTime()
              : n.timestamp
              ? new Date(n.timestamp).getTime()
              : 0
            const isWithin24Hours = !isNaN(createdTime) && createdTime > 0 && Date.now() - createdTime < 24 * 60 * 60 * 1000 && Date.now() - createdTime >= 0
            const isNew = isUnread && isWithin24Hours

            return (
              <div
                key={n.id}
                className={`p-3.5 sm:p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 ${
                  isHighlighted
                    ? "border-accent ring-2 ring-accent/40 bg-accent/10 shadow-md"
                    : isUnread
                    ? isCritical
                      ? "border-rose-300 border-l-4 border-l-rose-500 bg-rose-50/50 dark:border-rose-500/40 dark:border-l-rose-500 dark:bg-card dark:hover:bg-card-hover shadow-sm dark:shadow-card"
                      : isImportant
                      ? "border-amber-300 border-l-4 border-l-amber-500 bg-amber-50/50 dark:border-amber-500/40 dark:border-l-amber-500 dark:bg-card dark:hover:bg-card-hover shadow-sm dark:shadow-card"
                      : isFile
                      ? "border-purple-300 border-l-4 border-l-purple-500 bg-purple-50/50 dark:border-purple-500/40 dark:border-l-purple-500 dark:bg-card dark:hover:bg-card-hover shadow-sm dark:shadow-card"
                      : isPass
                      ? "border-sky-300 border-l-4 border-l-secondary bg-sky-50/50 dark:border-secondary/40 dark:border-l-secondary dark:bg-card dark:hover:bg-card-hover shadow-sm dark:shadow-card"
                      : "border-accent/30 border-l-4 border-l-accent bg-orange-50/50 dark:border-accent/40 dark:border-l-accent dark:bg-card dark:hover:bg-card-hover shadow-sm dark:shadow-card"
                    : "border-border-default border-l-4 border-l-border-default bg-card/70 hover:bg-card hover:border-border-bright opacity-85 hover:opacity-100 shadow-sm"
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  {/* Category Icon Badge */}
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border mt-0.5 shadow-xs ${
                      isCritical
                        ? "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:border-rose-500/30 dark:text-rose-400"
                        : isPass
                        ? "bg-sky-100 text-secondary border-sky-200 dark:bg-secondary/15 dark:border-secondary/30 dark:text-secondary-light"
                        : isFile
                        ? "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/15 dark:border-purple-500/30 dark:text-purple-300"
                        : isImportant
                        ? "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:border-amber-500/30 dark:text-amber-300"
                        : "bg-accent/15 text-accent-light border-accent/25 dark:bg-accent/15 dark:border-accent/30 dark:text-accent-light"
                    }`}
                  >
                    {isCritical ? (
                      <Flame size={19} />
                    ) : isPass ? (
                      <Radio size={19} />
                    ) : isFile ? (
                      <FolderArchive size={19} />
                    ) : isImportant ? (
                      <AlertTriangle size={19} />
                    ) : (
                      <Megaphone size={19} />
                    )}
                  </div>

                  <div className="min-w-0 space-y-1.5 flex-1">
                    {/* Top Row: Type Pill, Time, Status */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-extrabold uppercase font-mono tracking-wider ${
                          isCritical
                            ? "bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/35"
                            : isPass
                            ? "bg-sky-100 text-sky-800 border border-sky-200 dark:bg-secondary/20 dark:text-secondary-light dark:border-secondary/35"
                            : isFile
                            ? "bg-purple-100 text-purple-800 border border-purple-200 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/35"
                            : isImportant
                            ? "bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/35"
                            : "bg-accent/15 text-accent-light border border-accent/30 dark:bg-accent/20 dark:text-accent-light dark:border-accent/35"
                        }`}
                      >
                        {isCritical
                          ? "CRITICAL"
                          : isFile
                          ? "FILE INGEST"
                          : isPass
                          ? "MISSION PASS"
                          : isImportant
                          ? "PRIORITY"
                          : n.type || "NOTICE"}
                      </span>

                      {kind === "broadcast" && (
                        <span className="rounded border border-border-default px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                          Broadcast · {n.label || "General"}
                        </span>
                      )}

                      {isNew && (
                        <span className="rounded bg-accent text-white px-1.5 py-0.2 text-[10px] font-extrabold uppercase tracking-wider font-mono animate-pulse shadow-sm">
                          NEW
                        </span>
                      )}

                      <span className="text-[11px] text-text-dim font-mono flex items-center gap-1">
                        <Clock size={11} className="text-text-dim" />
                        {isWithin24Hours
                          ? `${new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} IST`
                          : `${new Date(n.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })} · ${new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} IST`}
                      </span>
                    </div>

                    {/* Notification Message Text */}
                    <p className={`text-xs sm:text-sm leading-relaxed ${isUnread ? "text-text-primary font-semibold" : "text-text-secondary"}`}>
                      {n.message}
                    </p>

                    {/* Action Deep Links */}
                    <div className="flex flex-wrap items-center gap-3 pt-0.5">
                      {isPass && (
                        <button
                          type="button"
                          onClick={() => handleNavigateEvent(n.resourceId)}
                          className="text-[11px] font-bold text-secondary dark:text-secondary-light hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Calendar size={12} />
                          <span>View in Mission Calendar →</span>
                        </button>
                      )}

                      {isFile && (
                        <button
                          type="button"
                          onClick={handleNavigateFile}
                          className="text-[11px] font-bold text-purple-700 dark:text-purple-300 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <FolderArchive size={12} />
                          <span>Open Ingest Repository →</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Action: Acknowledge Status / Compact Button */}
                <div className="shrink-0 flex items-center justify-end sm:self-center">
                  {isUnread ? (
                    <button
                      type="button"
                      onClick={() => markRead.mutate(n.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-accent/40 bg-accent/10 text-accent-light hover:bg-accent hover:text-white dark:border-accent/40 dark:bg-accent/15 dark:text-accent-light dark:hover:bg-accent dark:hover:text-white transition-all text-xs font-semibold cursor-pointer shadow-sm active:scale-95"
                    >
                      <Check size={13} />
                      <span>Acknowledge</span>
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] text-text-dim font-mono px-2 py-0.5 rounded-md bg-surface border border-border-default">
                      <Check size={11} className="text-nominal" />
                      <span>Acknowledged</span>
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination: Load More */}
      {hasNextPage && (
        <div className="flex justify-center pt-4">
          <Button variant="outline" size="sm" onClick={() => fetchNextPage()} className="cursor-pointer">
            Load More Alerts
          </Button>
        </div>
      )}
    </div>
  )
}
