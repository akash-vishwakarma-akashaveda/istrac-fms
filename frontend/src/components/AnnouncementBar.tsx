import { useState, useEffect, useCallback } from "react"
import { Bell, ChevronLeft, ChevronRight, ArrowRight, Radio, Zap } from "lucide-react"
import { eventsApi } from "../api/events.api"
import { notificationsApi } from "../api/notifications.api"
import { NotificationsModal, type NotificationModalItem } from "./NotificationsModal"
import { useCms } from "../context/cmsContext"

interface BannerItem {
  id: string
  title?: string
  message: string
  category: string
  urgency?: "NORMAL" | "IMPORTANT" | "CRITICAL"
  timestamp?: string
}

const URGENCY_STYLES: Record<string, string> = {
  CRITICAL: "border-y-critical/60 from-[#1a0505] via-[#2a0808] to-[#1a0505] shadow-critical/20",
  IMPORTANT: "border-y-warning/50 from-[#1a1005] via-[#2a1c05] to-[#1a1005] shadow-warning/15",
  NORMAL: "border-y-accent/40 from-[#0b1733] via-[#10234a] to-[#0b1733] shadow-accent/15",
}

const URGENCY_BADGE: Record<string, string> = {
  CRITICAL: "bg-critical text-white shadow-critical/50",
  IMPORTANT: "bg-warning text-black shadow-warning/40",
  NORMAL: "bg-accent text-white shadow-accent/50",
}

const EVENT_TYPE_CATEGORY: Record<string, string> = {
  MISSION_PASS: "PASS",
  LAUNCH: "LAUNCH",
  ORBIT_MANEUVER: "MANEUVER",
  MAINTENANCE: "MAINTENANCE",
  SEMINAR: "SEMINAR",
  ANOMALY: "ANOMALY",
}

/**
 * Live notice bar — powered directly by Events (showOnBanner=true) +
 * Broadcast Alerts from the backend. No CMS dependency.
 * Polls every 60 seconds for fresh data.
 */
export function AnnouncementBar() {
  const { cmsBlocks } = useCms()
  const cmsConfig = cmsBlocks['announcements'] as {
    visible?: boolean
    maxBannerItems?: number
    autoScrollSeconds?: number
    showModalButton?: boolean
  } | undefined

  const maxLimit = Math.max(1, Number(cmsConfig?.maxBannerItems) || 10)
  const autoScrollSeconds = Math.max(2, Number(cmsConfig?.autoScrollSeconds) || 5)
  const isVisible = cmsConfig?.visible ?? true
  const showModalBtn = cmsConfig?.showModalButton ?? true

  const [items, setItems] = useState<BannerItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [allNotifications, setAllNotifications] = useState<NotificationModalItem[]>([])
  const [topUrgency, setTopUrgency] = useState<"NORMAL" | "IMPORTANT" | "CRITICAL">("NORMAL")

  const fetchLiveData = useCallback(async () => {
    try {
      // Fetch active banner events + broadcasts in parallel
      const [bannerData, publicNotifs] = await Promise.allSettled([
        eventsApi.getActiveBanner(),
        notificationsApi.getPublicNotifications(),
      ])

      const bannerItems: BannerItem[] = []

      // Map active events (showOnBanner: true)
      if (bannerData.status === "fulfilled" && bannerData.value) {
        const { events, broadcasts } = bannerData.value

        events?.forEach((ev) => {
          bannerItems.push({
            id: ev.id,
            title: ev.title,
            message: ev.description ?? `${ev.location ?? ""} · ${new Date(ev.eventDate).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} IST`,
            category: EVENT_TYPE_CATEGORY[ev.eventType] ?? ev.eventType,
            urgency: ev.urgency,
          })
        })

        broadcasts?.forEach((bc) => {
          bannerItems.push({
            id: bc.id,
            message: bc.message,
            category: "BROADCAST",
            urgency: "IMPORTANT",
            timestamp: new Date(bc.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
          })
        })
      }

      // Map public notifications and broadcast alerts
      const notifItems: NotificationModalItem[] = []
      if (publicNotifs.status === "fulfilled" && publicNotifs.value?.length) {
        publicNotifs.value.forEach((n) => {
          notifItems.push({
            id: n.id,
            message: n.message,
            category: n.category || n.type || "NOTICE",
            createdAt: n.createdAt,
          })

          const alreadyInBanner = bannerItems.some(
            (b) => b.id === n.id || b.message.trim() === n.message.trim()
          )
          if (!alreadyInBanner) {
            bannerItems.push({
              id: n.id,
              message: n.message,
              category: n.category || n.type || "BROADCAST",
              urgency:
                n.type === "CRITICAL" || n.message.includes("[CRITICAL")
                  ? "CRITICAL"
                  : n.type === "WARNING" || n.type === "IMPORTANT" || n.message.includes("[IMPORTANT")
                  ? "IMPORTANT"
                  : "NORMAL",
              timestamp: new Date(n.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
            })
          }
        })
        setAllNotifications(notifItems)
      }

      if (bannerItems.length > 0) {
        const urgency = bannerItems.some((i) => i.urgency === "CRITICAL")
          ? "CRITICAL"
          : bannerItems.some((i) => i.urgency === "IMPORTANT")
            ? "IMPORTANT"
            : "NORMAL"
        setTopUrgency(urgency)
        setItems(bannerItems.slice(0, maxLimit))
        setCurrentIndex(0)
      }
    } catch {
      // Keep last known state on fetch error
    }
  }, [maxLimit])

  useEffect(() => {
    fetchLiveData()
  }, [fetchLiveData])

  useEffect(() => {
    const timer = setInterval(fetchLiveData, 15_000)
    return () => clearInterval(timer)
  }, [fetchLiveData])

  useEffect(() => {
    if (isPaused || items.length <= 1) return
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length)
    }, autoScrollSeconds * 1000)
    return () => clearInterval(interval)
  }, [isPaused, items.length, autoScrollSeconds])

  if (!isVisible || items.length === 0) return null

  const currentItem = items[currentIndex] || items[0]
  const barStyle = URGENCY_STYLES[topUrgency] ?? URGENCY_STYLES.NORMAL
  const badgeStyle = URGENCY_BADGE[currentItem.urgency ?? "NORMAL"] ?? URGENCY_BADGE.NORMAL

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        className={`relative z-30 border-y bg-gradient-to-r shadow-md transition-all ${barStyle}`}
      >
        <span
          aria-hidden="true"
          className={`absolute inset-y-0 left-0 w-1 ${
            topUrgency === "CRITICAL" ? "bg-critical" :
            topUrgency === "IMPORTANT" ? "bg-warning" : "bg-accent-light"
          } shadow-sm`}
        />

        <div className="shell flex flex-col gap-2.5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={`flex items-center gap-1.5 shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase shadow-sm ${badgeStyle}`}>
              {topUrgency === "CRITICAL" ? (
                <Zap size={11} className="animate-pulse" />
              ) : (
                <Radio size={12} className="animate-pulse" />
              )}
              <span>{topUrgency === "CRITICAL" ? "CRITICAL" : "LIVE NOTICE"}</span>
            </div>

            {currentItem.category && (
              <span className="hidden sm:inline-flex rounded border border-accent/40 bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-light">
                {currentItem.category}
              </span>
            )}

            <span aria-hidden="true" className="hidden h-3.5 w-px bg-accent/30 sm:block" />

            <div className="min-w-0 flex-1 overflow-hidden">
              <p
                key={currentItem.id + currentIndex}
                className="truncate text-xs font-medium text-white animate-fadeIn tracking-wide"
              >
                {currentItem.title && (
                  <strong className="font-bold text-accent-light mr-1.5">
                    {currentItem.title}:
                  </strong>
                )}
                <span className="text-slate-100">{currentItem.message}</span>
                {currentItem.timestamp && (
                  <span className="ml-2 num text-[10px] text-slate-400">· {currentItem.timestamp}</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
            {items.length > 1 && (
              <div className="flex items-center gap-1.5 border-r border-accent/25 pr-3">
                <span className="num text-[11px] font-bold text-accent-light">
                  {currentIndex + 1} / {items.length}
                </span>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    aria-label="Previous notice"
                    onClick={() => setCurrentIndex((prev) => (prev === 0 ? items.length - 1 : prev - 1))}
                    className="rounded p-1 text-slate-300 hover:bg-accent/20 hover:text-white transition-colors"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label="Next notice"
                    onClick={() => setCurrentIndex((prev) => (prev + 1) % items.length)}
                    className="rounded p-1 text-slate-300 hover:bg-accent/20 hover:text-white transition-colors"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {allNotifications.length > items.length && (
              <span className="hidden md:inline-flex items-center rounded-full bg-accent/25 border border-accent/40 px-2 py-0.5 text-[10px] font-mono font-bold text-accent-light shadow-sm">
                +{allNotifications.length - items.length} more
              </span>
            )}

            {showModalBtn && (
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/20 px-3 py-1 text-xs font-bold text-accent-light hover:bg-accent hover:text-white shadow-sm transition-all duration-200 cursor-pointer"
              >
                <Bell size={12} />
                <span>All Notices ({allNotifications.length || items.length})</span>
                <ArrowRight size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      <NotificationsModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        notifications={allNotifications.length > 0 ? allNotifications : items.map((i) => ({
          id: i.id,
          message: i.message,
          category: i.category,
        }))}
      />
    </>
  )
}
