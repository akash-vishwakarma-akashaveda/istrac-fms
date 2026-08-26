import { useEffect, useState } from 'react'
import {
  Megaphone,
  Radio,
  AlertTriangle,
  Flame,
  X,
} from 'lucide-react'
import { eventsApi, type ActiveBannerData } from '../api/events.api'

export function DynamicAlertBanner() {
  const [data, setData] = useState<ActiveBannerData | null>(null)
  const [dismissedIds, setDismissedIds] = useState<string[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    const fetchBanner = async () => {
      try {
        const res = await eventsApi.getActiveBanner()
        setData(res)
      } catch {
        // silent
      }
    }
    fetchBanner()
    const interval = setInterval(fetchBanner, 60000) // auto-refresh every minute
    return () => clearInterval(interval)
  }, [])

  // Consolidate broadcasts and events into unified items
  const items: Array<{
    id: string
    type: 'BROADCAST' | 'EVENT'
    title: string
    urgency: string
    timestamp: string
  }> = []

  if (data?.broadcasts) {
    data.broadcasts.forEach((b) => {
      if (!dismissedIds.includes(b.id)) {
        items.push({
          id: b.id,
          type: 'BROADCAST',
          title: b.message,
          urgency: b.message.startsWith('[CRITICAL') ? 'CRITICAL' : 'NORMAL',
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
        })
      }
    })
  }

  // Cycle automatically if multiple items
  useEffect(() => {
    if (items.length <= 1) return
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length)
    }, 8000)
    return () => clearInterval(timer)
  }, [items.length])

  if (items.length === 0) return null

  const activeItem = items[currentIndex % items.length]
  if (!activeItem) return null

  const isCritical = activeItem.urgency === 'CRITICAL'
  const isImportant = activeItem.urgency === 'IMPORTANT'

  const handleDismiss = () => {
    setDismissedIds((prev) => [...prev, activeItem.id])
  }

  return (
    <div
      className={`relative z-20 flex items-center justify-between px-4 py-2 text-xs transition-all border-b ${
        isCritical
          ? 'border-critical/50 bg-gradient-to-r from-critical/25 via-[#230808] to-critical/15 text-white'
          : isImportant
            ? 'border-[#FF6B00]/40 bg-gradient-to-r from-[#FF6B00]/20 via-[#1c0d04] to-[#FF6B00]/10 text-white'
            : 'border-accent/40 bg-gradient-to-r from-accent/15 via-[#081022] to-accent/10 text-white'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
            isCritical
              ? 'bg-critical/30 text-critical animate-pulse'
              : isImportant
                ? 'bg-[#FF6B00]/30 text-[#FF8533]'
                : 'bg-accent/30 text-accent-light'
          }`}
        >
          {activeItem.type === 'EVENT' ? (
            <Radio size={13} />
          ) : isCritical ? (
            <Flame size={13} />
          ) : isImportant ? (
            <AlertTriangle size={13} />
          ) : (
            <Megaphone size={13} />
          )}
        </div>

        <div className="flex items-center gap-2 min-w-0 truncate">
          <span className="font-bold truncate text-text-primary">{activeItem.title}</span>
          <span className="num hidden sm:inline text-[10px] text-text-dim shrink-0">
            · {activeItem.timestamp}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-3">
        {items.length > 1 && (
          <span className="num text-[10px] text-text-dim px-1.5 py-0.5 rounded bg-surface border border-border-subtle">
            {((currentIndex % items.length) + 1)}/{items.length}
          </span>
        )}

        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 rounded text-text-dim hover:text-white hover:bg-card-hover transition-colors"
          aria-label="Dismiss banner alert"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  )
}
