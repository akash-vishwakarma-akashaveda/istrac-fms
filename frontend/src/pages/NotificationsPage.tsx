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
  CheckCircle2,
} from "lucide-react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useNotifications, useMarkAllRead, useMarkRead } from "../hooks/useNotifications"
import { eventsApi, type ActiveBannerData } from "../api/events.api"
import { Button, PageHeader } from "../components"
import { useAuthStore } from "../store/authStore"

const TABS = [
  { id: "ALL", label: "All Alerts", icon: Bell },
  { id: "BROADCASTS", label: "Active Broadcasts", icon: Megaphone },
  { id: "EVENTS", label: "Mission Passes & Events", icon: Radio },
  { id: "FILES", label: "File Uploads", icon: FolderArchive },
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
    if (activeTab === "BROADCASTS" && n.type !== "BROADCAST" && n.category !== "BROADCAST") return false
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
  const activeBroadcastCount = (bannerData?.broadcasts?.length || 0) + (bannerData?.events?.length || 0)

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
    <div className="w-full space-y-6 pb-20 text-text-primary">
      {/* Top Page Header */}
      <div className="border-b border-border-subtle pb-5">
        <PageHeader
          eyebrow="Mission Ground Station Control"
          title="Alerts, Broadcasts & Telemetry Notices"
          description="Centralized operational feed consolidating live mission passes, emergency broadcasts, spacecraft telemetry alerts, and file ingest notifications."
          meta={
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="rounded-full bg-accent/15 border border-accent/30 px-2.5 py-0.5 text-[10px] font-bold uppercase num text-accent-light flex items-center gap-1.5 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-light animate-ping" />
                <span>{activeBroadcastCount} Active Station Broadcasts</span>
              </span>
              <span className="num text-xs text-text-dim font-mono">
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
                className="border-border-default hover:border-accent text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <CheckCheck size={14} className="text-nominal" />
                <span>Acknowledge All</span>
              </Button>
            </div>
          }
        />
      </div>

      {/* 1. TOP LIVE BROADCAST & EVENT MARQUEE CARDS */}
      {bannerData && (bannerData.broadcasts?.length > 0 || bannerData.events?.length > 0) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-text-dim flex items-center gap-1.5">
              <Megaphone size={13} className="text-accent-light" />
              <span>Active Air-Gapped Station Broadcasts (Live)</span>
            </span>
            <span className="text-[11px] num font-mono text-text-dim">
              Synced with BLR Ground Station
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Live Broadcast Items */}
            {bannerData.broadcasts?.map((b) => {
              const isCritical = b.message.startsWith("[CRITICAL")
              const isImportant = b.message.startsWith("[IMPORTANT")

              return (
                <div
                  key={b.id}
                  className={`p-4 rounded-xl border flex items-start gap-3.5 transition-all shadow-md ${
                    isCritical
                      ? "border-critical/50 bg-gradient-to-br from-critical/20 via-[#1a0808] to-[#0c1426] text-white"
                      : isImportant
                      ? "border-[#FF6B00]/40 bg-gradient-to-br from-[#FF6B00]/15 via-[#180b05] to-[#0c1426] text-white"
                      : "border-accent/40 bg-gradient-to-br from-accent/15 via-[#0a1630] to-[#0c1426] text-white"
                  }`}
                >
                  <div
                    className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border mt-0.5 ${
                      isCritical
                        ? "bg-critical/30 border-critical/40 text-critical animate-pulse"
                        : isImportant
                        ? "bg-[#FF6B00]/30 border-[#FF6B00]/40 text-[#FF8533]"
                        : "bg-accent/30 border-accent/40 text-accent-light"
                    }`}
                  >
                    {isCritical ? <Flame size={18} /> : isImportant ? <AlertTriangle size={18} /> : <Megaphone size={18} />}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                          isCritical
                            ? "bg-critical text-white"
                            : isImportant
                            ? "bg-[#FF6B00] text-white"
                            : "bg-accent/30 text-accent-light border border-accent/40"
                        }`}
                      >
                        {isCritical ? "CRITICAL BROADCAST" : isImportant ? "PRIORITY ALERT" : "STATION NOTICE"}
                      </span>
                      <span className="num text-[11px] font-mono text-text-dim">
                        {new Date(b.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} UTC
                      </span>
                    </div>

                    <p className="text-xs font-semibold leading-relaxed text-white">
                      {b.message}
                    </p>
                  </div>
                </div>
              )
            })}

            {/* Active Mission Passes / Upcoming Events */}
            {bannerData.events?.map((ev) => {
              const timeStr = new Date(ev.eventDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

              return (
                <div
                  key={ev.id}
                  onClick={() => handleNavigateEvent(ev.id)}
                  className="p-4 rounded-xl border border-accent/40 bg-gradient-to-br from-accent/15 via-[#0a1630] to-[#0c1426] hover:border-accent hover:shadow-lg hover:shadow-accent/10 text-white flex items-start gap-3.5 cursor-pointer group transition-all"
                >
                  <div className="h-9 w-9 rounded-xl bg-accent/25 border border-accent/40 text-accent-light flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform mt-0.5">
                    <Radio size={18} className="animate-pulse" />
                  </div>

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-accent/40 text-accent-light border border-accent/40">
                          ACTIVE PASS
                        </span>
                        {ev.satellite?.code && (
                          <span className="text-[10px] font-bold text-[#FF8533] uppercase">
                            {ev.satellite.code}
                          </span>
                        )}
                      </div>
                      <span className="num text-[11px] font-mono text-accent-light font-bold">
                        {timeStr} UTC
                      </span>
                    </div>

                    <p className="text-xs font-bold text-white group-hover:text-accent-light transition-colors">
                      {ev.title}
                    </p>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-text-dim truncate">
                        {ev.location || "ISTRAC Deep Space Ground Complex"}
                      </span>
                      <span className="text-[11px] font-bold text-accent-light flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                        <span>View Schedule</span>
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

      {/* 2. FILTER & SEARCH CONTROLS */}
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
                    : "bg-[#0b1426] text-text-secondary hover:text-white hover:bg-card-hover border border-border-default/60"
                }`}
              >
                <Icon size={13} className={isSelected ? "text-white" : "text-text-dim"} />
                <span>{t.label}</span>
              </button>
            )
          })}
        </div>

        {/* Search Input Box */}
        <div className="relative min-w-[260px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter alerts, passes, files…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-border-default bg-[#070e1d] text-xs text-white placeholder:text-text-dim outline-none focus:border-accent transition-colors"
          />
        </div>
      </div>

      {/* 3. ALERTS & NOTIFICATIONS FEED */}
      {filteredNotifications.length === 0 ? (
        <div className="rounded-2xl border border-border-subtle bg-[#091224] p-16 text-center space-y-3 shadow-md">
          <div className="h-12 w-12 rounded-2xl bg-surface border border-border-subtle flex items-center justify-center mx-auto text-text-dim">
            <Bell size={24} />
          </div>
          <p className="text-sm font-bold text-white">No Matching Station Alerts</p>
          <p className="text-xs text-text-dim max-w-sm mx-auto">
            All telemetry logs, passes, and mission notices matching your current filter are caught up.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((n: any) => {
            const isUnread = !n.readAt
            const isHighlighted = String(n.id) === highlightId
            const isCritical = n.category === "CRITICAL" || n.type === "EMERGENCY"
            const isPass = n.type === "PASS" || n.type === "EVENT" || n.type === "MISSION_PASS"
            const isFile = n.type === "FILE_UPLOAD" || n.category === "file"
            const isMaint = n.type === "MAINTENANCE" || n.category === "MAINTENANCE"

            return (
              <div
                key={n.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  isHighlighted
                    ? "border-accent ring-2 ring-accent/50 bg-[#0d1a38] shadow-lg"
                    : isUnread
                    ? "border-accent/40 bg-[#09142b] shadow-md hover:border-accent"
                    : "border-border-default/80 bg-[#081020] hover:bg-[#0c162c] hover:border-border-default"
                }`}
              >
                <div className="flex items-start gap-4 min-w-0 flex-1">
                  {/* Category Icon Badge */}
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border mt-0.5 ${
                      isCritical
                        ? "bg-red-500/15 border-red-500/30 text-red-400"
                        : isPass
                        ? "bg-accent/15 border-accent/30 text-accent-light"
                        : isFile
                        ? "bg-purple-500/15 border-purple-500/30 text-purple-300"
                        : isMaint
                        ? "bg-yellow-500/15 border-yellow-500/30 text-yellow-400"
                        : "bg-nominal/15 border-nominal/30 text-nominal"
                    }`}
                  >
                    {isCritical ? (
                      <Flame size={20} />
                    ) : isPass ? (
                      <Radio size={20} />
                    ) : isFile ? (
                      <FolderArchive size={20} />
                    ) : isMaint ? (
                      <AlertTriangle size={20} />
                    ) : (
                      <Megaphone size={20} />
                    )}
                  </div>

                  <div className="min-w-0 space-y-1.5 flex-1">
                    {/* Top Row: Type Pill, Time, Status */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded px-2 py-0.5 text-[9px] font-extrabold uppercase num tracking-wider ${
                          isCritical
                            ? "bg-red-500/20 text-red-400 border border-red-500/30"
                            : isPass
                            ? "bg-accent/20 text-accent-light border border-accent/30"
                            : isFile
                            ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                            : isMaint
                            ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                            : "bg-nominal/20 text-nominal border border-nominal/30"
                        }`}
                      >
                        {n.type || "STATION ALERT"}
                      </span>

                      {isUnread && (
                        <span className="rounded bg-accent text-white px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider animate-pulse">
                          NEW
                        </span>
                      )}

                      <span className="num text-[11px] text-text-dim font-mono flex items-center gap-1">
                        <Clock size={11} className="text-text-dim" />
                        {new Date(n.createdAt).toLocaleString()} IST
                      </span>
                    </div>

                    {/* Notification Message Text */}
                    <p className={`text-xs leading-relaxed ${isUnread ? "text-white font-semibold" : "text-text-secondary"}`}>
                      {n.message}
                    </p>

                    {/* Action Deep Links */}
                    <div className="flex flex-wrap items-center gap-3 pt-1">
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
                          <span>Open File Repository →</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Action: Acknowledge Status / Button */}
                <div className="shrink-0 flex items-center sm:flex-col justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border-subtle">
                  {isUnread ? (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => markRead.mutate(n.id)}
                      className="text-xs font-bold px-3 py-1.5 shadow-sm"
                    >
                      Acknowledge
                    </Button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] text-text-dim font-mono px-2.5 py-1 rounded-lg bg-surface/80 border border-border-subtle">
                      <CheckCircle2 size={12} className="text-nominal" />
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
          <Button variant="outline" size="sm" onClick={() => fetchNextPage()}>
            Load More Alerts
          </Button>
        </div>
      )}
    </div>
  )
}
