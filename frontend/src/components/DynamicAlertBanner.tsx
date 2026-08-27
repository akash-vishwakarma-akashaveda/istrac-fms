import { useEffect, useState } from 'react'
import {
  Megaphone,
  Radio,
  AlertTriangle,
  Flame,
  X,
  ChevronRight,
  BellRing,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { eventsApi, type ActiveBannerData } from '../api/events.api'

export function DynamicAlertBanner() {
  const navigate = useNavigate()
  const [data, setData] = useState<ActiveBannerData | null>(null)
  const [dismissedIds, setDismissedIds] = useState<string[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    const fetchBanner = async () => {
      try {
        const res = await eventsApi.getActiveBanner()
        setData(res)
      } catch {
        // silent fallback
      }
    }
    fetchBanner()
    const interval = setInterval(fetchBanner, 45000) // auto-refresh every 45s
    return () => clearInterval(interval)
  }, [])

  // Consolidate broadcasts and events into unified items
  const items: Array<{
    id: string
    type: 'BROADCAST' | 'EVENT'
    title: string
    urgency: string
    timestamp: string
    rawEvent?: any
  }> = []

  if (data?.broadcasts) {
    data.broadcasts.forEach((b) => {
      if (!dismissedIds.includes(b.id)) {
        items.push({
          id: b.id,
          type: 'BROADCAST',
          title: b.message,
          urgency: b.message.startsWith('[CRITICAL') ? 'CRITICAL' : b.message.startsWith('[IMPORTANT') ? 'IMPORTANT' : 'NORMAL',
          timestamp: new Date(b.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        })
      }
    })
  }

  if (data?.events) {
    data.events.forEach((ev) => {
      if (!dismissedIds.includes(ev.id)) {
        const timeStr = new Date(ev.eventDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        items.push({
          id: ev.id,
          type: 'EVENT',
          title: `[MISSION SCHEDULE] ${ev.title} at ${ev.location || 'ISTRAC MOX'} (${timeStr} UTC)`,
          urgency: ev.urgency,
          timestamp: timeStr,
          rawEvent: ev,
        })
      }
    })
  }

  // Cycle automatically if multiple items
  useEffect(() => {
    if (items.length <= 1) return
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length)
    }, 9000)
    return () => clearInterval(timer)
  }, [items.length])

  if (items.length === 0) return null

  const activeItem = items[currentIndex % items.length]
  if (!activeItem) return null

  const isCritical = activeItem.urgency === 'CRITICAL'
  const isImportant = activeItem.urgency === 'IMPORTANT'

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation()
    setDismissedIds((prev) => [...prev, activeItem.id])
  }

  const handleItemClick = () => {
    if (activeItem.type === 'EVENT') {
      navigate(`/dashboard/events?eventId=${activeItem.id}`)
    } else {
      navigate(`/notifications?highlight=${activeItem.id}`)
    }
  }

  return (
    <div
      className={`relative z-20 flex items-center justify-between px-3.5 py-1.5 text-xs transition-all border-b shadow-sm ${
        isCritical
          ? 'border-critical/60 bg-gradient-to-r from-critical/30 via-[#220707] to-critical/20 text-white'
          : isImportant
            ? 'border-[#FF6B00]/50 bg-gradient-to-r from-[#FF6B00]/25 via-[#1a0a03] to-[#FF6B00]/15 text-white'
            : 'border-accent/40 bg-gradient-to-r from-accent/20 via-[#071126] to-accent/10 text-white'
      }`}
    >
      {/* Clickable Alert Headline */}
      <div
        onClick={handleItemClick}
        className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer group py-0.5"
        title="Click to view alert details"
      >
        {/* Pulsing indicator icon */}
        <div
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
            isCritical
              ? 'bg-critical/30 border-critical/40 text-critical animate-pulse'
              : isImportant
                ? 'bg-[#FF6B00]/30 border-[#FF6B00]/40 text-[#FF8533]'
                : 'bg-accent/30 border-accent/40 text-accent-light'
          }`}
        >
          {activeItem.type === 'EVENT' ? (
            <Radio size={13} className="animate-pulse" />
          ) : isCritical ? (
            <Flame size={13} />
          ) : isImportant ? (
            <AlertTriangle size={13} />
          ) : (
            <Megaphone size={13} />
          )}
        </div>

        {/* Badge & Title */}
        <div className="flex items-center gap-2 min-w-0 truncate">
          <span
            className={`hidden xs:inline px-1.5 py-0.2 rounded text-[10px] font-extrabold uppercase tracking-wider shrink-0 ${
              isCritical
                ? 'bg-critical text-white'
                : isImportant
                  ? 'bg-[#FF6B00] text-white'
                  : 'bg-accent/40 text-accent-light border border-accent/40'
            }`}
          >
            {activeItem.type === 'EVENT' ? 'MISSION PASS' : activeItem.urgency}
          </span>

          <span className="font-semibold truncate text-text-primary group-hover:text-accent-light transition-colors">
            {activeItem.title}
          </span>

          <span className="num hidden md:inline text-[10px] text-text-dim shrink-0">
            · {activeItem.timestamp}
          </span>
        </div>
      </div>

      {/* Right Controls: View All Button + Counter + Dismiss */}
      <div className="flex items-center gap-2 shrink-0 ml-3">
        {/* VIEW ALL BUTTON */}
        <button
          type="button"
          onClick={() => navigate('/notifications')}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase transition-all bg-surface/80 hover:bg-accent/20 hover:text-accent-light border border-border-default hover:border-accent/40 text-text-secondary"
          title="View all alerts, broadcasts & operational notices"
        >
          <BellRing size={12} className="text-accent-light" />
          <span className="hidden sm:inline">View All</span>
          <span className="num px-1 py-0.2 rounded bg-surface border border-border-subtle text-[10px] font-mono">
            {items.length}
          </span>
          <ChevronRight size={12} className="text-text-dim" />
        </button>

        {/* Counter */}
        {items.length > 1 && (
          <span className="num text-[10px] text-text-dim px-1.5 py-0.5 rounded bg-surface border border-border-subtle font-mono hidden sm:inline">
            {(currentIndex % items.length) + 1}/{items.length}
          </span>
        )}

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 rounded text-text-dim hover:text-white hover:bg-surface transition-colors"
          aria-label="Dismiss banner alert"
          title="Dismiss from top banner"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  )
}
