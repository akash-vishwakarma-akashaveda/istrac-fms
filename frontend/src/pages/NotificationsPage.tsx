import { useState, useEffect } from "react"
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
  FileText,
} from "lucide-react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useNotifications, useMarkAllRead, useMarkRead } from "../hooks/useNotifications"
import { eventsApi, type ActiveBannerData } from "../api/events.api"
import { Button, PageHeader } from "../components"
import { useAuthStore } from "../store/authStore"

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
  const [bannerData, setBannerData] = useState<ActiveBannerData | null>(null)

  const { data, fetchNextPage, hasNextPage } = useNotifications()
  const markAllRead = useMarkAllRead()
  const markRead = useMarkRead()

  // Load Live Banner Data & Mission Events
  useEffect(() => {
    async function loadLiveAlerts() {
      try {
        const banner = await eventsApi.getActiveBanner().catch(() => null)
        setBannerData(banner)
      } catch (err) {
        console.error("Failed to load live broadcasts:", err)
      }
    }
    loadLiveAlerts()
  }, [])

  const rawNotifications: any[] = data?.pages.flatMap((p: any) => p.data || []) ?? []
  const allNotifications = rawNotifications

  // Filter based on active tab and search
  const filteredNotifications = allNotifications.filter((n) => {
    if (activeTab === "UNREAD" && n.readAt) return false
    if (activeTab === "BROADCASTS" && n.type !== "BROADCAST" && n.type !== "CRITICAL" && n.type !== "NOTICE" && n.category !== "BROADCAST") return false
    if (activeTab === "EVENTS" && n.type !== "PASS" && n.type !== "EVENT" && n.type !== "MISSION_PASS") return false
    if (activeTab === "FILES" && n.type !== "FILE_UPLOAD" && n.category !== "file") return false

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return (
        n.message?.toLowerCase().includes(q) ||
        n.type?.toLowerCase().includes(q) ||
        n.category?.toLowerCase().includes(q)
      )
    }
    return true
  })

  const unreadCount = allNotifications.filter((i) => !i.readAt).length

  // High-priority active broadcasts (exclude routine file uploads from the top marquee)
  const priorityBroadcasts = bannerData?.broadcasts?.filter((b) => {
    const m = b.message.toLowerCase()
    return !m.includes("uploaded") && !m.includes("ingested")
  }) || []

  const activePassEvents = bannerData?.events || []
  const hasLiveMarquee = priorityBroadcasts.length > 0 || activePassEvents.length > 0

  const handleNavigateEvent = (eventId?: string) => {
    const targetUrl = isAdmin ? "/admin/events" : "/dashboard/events"
    if (eventId) {
      navigate(`${targetUrl}?eventId=${eventId}`)
    } else {
      navigate(targetUrl)
    }
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
              <span className="rounded-full bg-accent/15 border border-accent/30 px-3 py-0.5 text-xs font-bold font-mono text-accent-light flex items-center gap-1.5 shadow-sm">
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
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
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
                  className={`p-4 rounded-xl border flex items-start gap-3.5 transition-all shadow-lg backdrop-blur-md ${
                    isCritical
                      ? "border-rose-500/60 bg-gradient-to-br from-rose-950/40 via-[#18080c] to-[#070b16] text-white shadow-rose-950/30"
                      : isImportant
                      ? "border-amber-500/50 bg-gradient-to-br from-amber-950/35 via-[#160d05] to-[#070b16] text-white shadow-amber-950/20"
                      : "border-cyan-500/40 bg-gradient-to-br from-cyan-950/30 via-[#07152b] to-[#070b16] text-white shadow-cyan-950/20"
                  }`}
                >
                  <div
                    className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border mt-0.5 shadow-inner ${
                      isCritical
                        ? "bg-rose-500/25 border-rose-500/50 text-rose-400 animate-pulse"
                        : isImportant
                        ? "bg-amber-500/25 border-amber-500/50 text-amber-300"
                        : "bg-cyan-500/20 border-cyan-500/40 text-cyan-400"
                    }`}
                  >
                    {isCritical ? <Flame size={18} /> : isImportant ? <AlertTriangle size={18} /> : <Megaphone size={18} />}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full font-mono tracking-wider ${
                          isCritical
                            ? "bg-rose-500 text-white shadow-sm shadow-rose-500/50"
                            : isImportant
                            ? "bg-amber-500 text-black font-bold"
                            : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                        }`}
                      >
                        {isCritical ? "CRITICAL ADVISORY" : isImportant ? "PRIORITY NOTICE" : "STATION BULLETIN"}
                      </span>
                      <span className="text-[11px] font-mono text-text-dim">
                        {new Date(b.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} UTC
                      </span>
                    </div>

                    <p className="text-xs font-semibold leading-relaxed text-slate-100">
                      {b.message}
                    </p>
                  </div>
                </div>
              )
            })}

            {/* Active Mission Passes / Operational Events */}
            {activePassEvents.map((ev) => {
              const timeStr = new Date(ev.eventDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

              return (
                <div
                  key={ev.id}
                  onClick={() => handleNavigateEvent(ev.id)}
                  className="p-4 rounded-xl border border-accent/40 bg-gradient-to-br from-accent/20 via-[#071328] to-[#070b16] hover:border-accent hover:shadow-lg hover:shadow-accent/15 text-white flex items-start gap-3.5 cursor-pointer group transition-all"
                >
                  <div className="h-9 w-9 rounded-xl bg-accent/25 border border-accent/40 text-accent-light flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform mt-0.5 shadow-inner">
                    <Radio size={18} className="animate-pulse" />
                  </div>

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-accent/30 text-accent-light border border-accent/40 font-mono tracking-wider">
                          TRACKING PASS
                        </span>
                        {ev.satellite?.code && (
                          <span className="text-[10px] font-bold font-mono text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/30">
                            {ev.satellite.code}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-accent-light font-bold">
                        {timeStr} UTC
                      </span>
                    </div>

                    <p className="text-xs font-bold text-white group-hover:text-accent-light transition-colors">
                      {ev.title}
                    </p>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-text-dim truncate">
                        {ev.location || "ISTRAC Deep Space Network"}
                      </span>
                      <span className="text-[11px] font-bold text-accent-light flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
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

      {/* 2. FILTER TABS & SEARCH BAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
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
                    ? "bg-accent text-white shadow-md shadow-accent/25 border border-accent"
                    : "bg-[#091122] text-text-secondary hover:text-white hover:bg-[#0e1b36] border border-white/10"
                }`}
              >
                <Icon size={13} className={isSelected ? "text-white" : "text-text-dim"} />
                <span>{t.label}</span>
                {t.id === "UNREAD" && unreadCount > 0 && (
                  <span className="ml-1 rounded-full bg-critical px-1.5 py-0.2 text-[9px] font-extrabold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Search Input Box */}
        <div className="relative min-w-[280px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search alerts, filenames, passes…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-white/10 bg-[#070e1d] text-xs text-white placeholder:text-text-dim outline-none focus:border-accent transition-colors shadow-inner"
          />
        </div>
      </div>

      {/* 3. ALERTS & NOTIFICATIONS FEED */}
      {filteredNotifications.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#070e1c] p-16 text-center space-y-3 shadow-md">
          <div className="h-12 w-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-text-dim">
            <Bell size={24} />
          </div>
          <p className="text-sm font-bold text-white">No Matching Notifications</p>
          <p className="text-xs text-text-dim max-w-sm mx-auto">
            All telemetry logs, operational passes, and broadcasts matching your current filter are caught up.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredNotifications.map((n: any) => {
            const isUnread = !n.readAt
            const isHighlighted = String(n.id) === highlightId
            const isCritical = n.category === "CRITICAL" || n.type === "EMERGENCY" || n.message?.includes("[CRITICAL")
            const isPass = n.type === "PASS" || n.type === "EVENT" || n.type === "MISSION_PASS"
            const isFile = n.type === "FILE_UPLOAD" || n.category === "file" || n.message?.includes("uploaded")
            const isImportant = n.type === "WARNING" || n.message?.includes("[IMPORTANT")

            return (
              <div
                key={n.id}
                className={`p-3.5 sm:p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 shadow-md ${
                  isHighlighted
                    ? "border-accent ring-2 ring-accent/50 bg-[#0e1c3a] shadow-lg"
                    : isUnread
                    ? isCritical
                      ? "border-rose-500/50 bg-gradient-to-r from-rose-950/30 to-[#070d1a]"
                      : isImportant
                      ? "border-amber-500/40 bg-gradient-to-r from-amber-950/25 to-[#070d1a]"
                      : isFile
                      ? "border-purple-500/40 bg-gradient-to-r from-purple-950/25 to-[#070d1a]"
                      : "border-accent/40 bg-gradient-to-r from-accent/15 to-[#070d1a]"
                    : "border-white/10 bg-[#060a16] hover:bg-[#0a1224] hover:border-white/20"
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  {/* Category Icon Badge */}
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border mt-0.5 shadow-inner ${
                      isCritical
                        ? "bg-rose-500/20 border-rose-500/40 text-rose-400"
                        : isPass
                        ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400"
                        : isFile
                        ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                        : isImportant
                        ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                        : "bg-accent/20 border-accent/40 text-accent-light"
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

                  <div className="min-w-0 space-y-1 flex-1">
                    {/* Top Row: Type Pill, Time, Status */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded px-2 py-0.5 text-[9px] font-extrabold uppercase font-mono tracking-wider ${
                          isCritical
                            ? "bg-rose-500/25 text-rose-300 border border-rose-500/40"
                            : isPass
                            ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                            : isFile
                            ? "bg-purple-500/25 text-purple-300 border border-purple-500/40"
                            : isImportant
                            ? "bg-amber-500/25 text-amber-300 border border-amber-500/40"
                            : "bg-accent/20 text-accent-light border border-accent/30"
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

                      {isUnread && (
                        <span className="rounded bg-accent/90 text-white px-1.5 py-0.2 text-[9px] font-extrabold uppercase tracking-wider font-mono animate-pulse shadow-sm">
                          NEW
                        </span>
                      )}

                      <span className="text-[11px] text-text-dim font-mono flex items-center gap-1">
                        <Clock size={11} className="text-text-dim" />
                        {new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} IST
                      </span>
                    </div>

                    {/* Notification Message Text */}
                    <p className={`text-xs leading-relaxed ${isUnread ? "text-white font-semibold" : "text-slate-300"}`}>
                      {n.message}
                    </p>

                    {/* Action Deep Links */}
                    <div className="flex flex-wrap items-center gap-3 pt-0.5">
                      {isPass && (
                        <button
                          type="button"
                          onClick={() => handleNavigateEvent(n.resourceId)}
                          className="text-[11px] font-bold text-accent-light hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Calendar size={12} />
                          <span>View in Mission Calendar →</span>
                        </button>
                      )}

                      {isFile && (
                        <button
                          type="button"
                          onClick={handleNavigateFile}
                          className="text-[11px] font-bold text-purple-300 hover:underline flex items-center gap-1 cursor-pointer"
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
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-accent/40 bg-accent/15 text-accent-light hover:bg-accent hover:text-white transition-all text-xs font-semibold cursor-pointer shadow-sm active:scale-95"
                    >
                      <Check size={13} />
                      <span>Acknowledge</span>
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] text-text-dim font-mono px-2 py-0.5 rounded-md bg-white/5 border border-white/10">
                      <Check size={11} className="text-emerald-400" />
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
