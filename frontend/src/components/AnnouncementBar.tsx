import { useState, useEffect } from 'react'
import { Bell, ChevronLeft, ChevronRight, ArrowRight, Radio } from 'lucide-react'
import { useCms } from '../context/cmsContext'
import { notificationsApi } from '../api/notifications.api'
import { NotificationsModal, type NotificationModalItem } from './NotificationsModal'

interface AnnouncementItem {
  id: string
  title?: string
  message: string
  category?: string
  timestamp?: string
}

interface AnnouncementsBlock {
  visible?: boolean
  backgroundColor?: string
  text?: string
  items?: AnnouncementItem[]
}

const DEFAULT_NOTIFICATIONS: AnnouncementItem[] = [
  {
    id: 'n-1',
    title: 'MISSION UPDATE: Aditya-L1 Halo Orbit Stationkeeping',
    message: 'Doppler lock confirmed on 2.2 GHz S-Band. Chandrayaan-3 Telemetry Sync Verified · All Tracking Stations Nominal.',
    category: 'MISSION',
    timestamp: '10 Mins Ago',
  },
  {
    id: 'n-2',
    title: 'IDSN 32-Meter Deep Space Dish Calibration Complete',
    message: 'Byalalu IDSN 32m dish completed autotrack calibration; cryo-receiver noise temperature measured at nominal 12.4K.',
    category: 'MAINTENANCE',
    timestamp: '35 Mins Ago',
  },
  {
    id: 'n-3',
    title: 'Cartosat-3 S-Band Pass Acquisition Scheduled',
    message: 'Downlink window configured for 14:30 UTC over Bengaluru MOX-1 primary ground terminal.',
    category: 'PASS',
    timestamp: '1 Hour Ago',
  },
  {
    id: 'n-4',
    title: 'Downrange Ground Relays Synchronized',
    message: 'Port Blair & Mauritius telemetry relays synchronized for upcoming launch vehicle trajectory tracking.',
    category: 'RELAY',
    timestamp: '3 Hours Ago',
  },
  {
    id: 'n-5',
    title: 'NETRA IS4OM Space Debris Conjunction Screen Passed',
    message: 'Zero high-risk orbital conjunction events identified for operational Indian spacecraft in 72-hour screening.',
    category: 'SECURITY',
    timestamp: 'Today 08:00 UTC',
  },
]

export function AnnouncementBar() {
  const { cmsBlocks } = useCms()
  const block = cmsBlocks['announcements'] as AnnouncementsBlock | undefined

  const [notifications, setNotifications] = useState<NotificationModalItem[]>(DEFAULT_NOTIFICATIONS)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  // Load notifications from CMS or public backend API
  useEffect(() => {
    if (block?.items && block.items.length > 0) {
      setNotifications(block.items)
    } else if (block?.text) {
      setNotifications([
        {
          id: 'cms-default',
          message: block.text,
          category: 'NOTICE',
          timestamp: 'Live',
        },
        ...DEFAULT_NOTIFICATIONS.slice(1),
      ])
    }

    // Try fetching public broadcast alerts from backend
    notificationsApi
      .getPublicNotifications()
      .then((serverItems) => {
        if (serverItems && serverItems.length > 0) {
          const mapped: NotificationModalItem[] = serverItems.map((n) => ({
            id: n.id,
            message: n.message,
            category: n.category || n.type || 'NOTICE',
            createdAt: n.createdAt,
          }))
          setNotifications(mapped.slice(0, 20))
        }
      })
      .catch(() => {})
  }, [block])

  // Get top 5 notifications for the banner ticker
  const bannerItems = notifications.slice(0, 5)

  // Auto-rotate every 5 seconds
  useEffect(() => {
    if (isPaused || bannerItems.length <= 1) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % bannerItems.length)
    }, 5000)

    return () => clearInterval(interval)
  }, [isPaused, bannerItems.length])

  if (block?.visible === false || bannerItems.length === 0) return null

  const currentItem = bannerItems[currentIndex] || bannerItems[0]

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        className="relative z-30 border-y border-accent/40 bg-gradient-to-r from-[#0b1733] via-[#10234a] to-[#0b1733] shadow-md shadow-accent/15 transition-all"
      >
        {/* Left Edge Accent Bar */}
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-accent-light shadow-sm shadow-accent-light" />

        <div className="shell flex flex-col gap-2.5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: Glowing Badge, Notice Content */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Highly Highlighted Badge */}
            <div className="flex items-center gap-1.5 shrink-0 rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold text-white shadow-sm shadow-accent/50 tracking-wide uppercase">
              <Radio size={12} className="animate-pulse text-white" />
              <span>LIVE NOTICE</span>
            </div>

            {/* Category Tag */}
            {currentItem.category && (
              <span className="hidden sm:inline-flex rounded border border-accent/40 bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-light">
                {currentItem.category}
              </span>
            )}

            <span aria-hidden="true" className="hidden h-3.5 w-px bg-accent/30 sm:block" />

            {/* Notification Text with Smooth Fade Transition */}
            <div className="min-w-0 flex-1 overflow-hidden">
              <p
                key={currentItem.id || currentIndex}
                className="truncate text-xs font-medium text-white animate-fadeIn tracking-wide"
              >
                {currentItem.title ? (
                  <strong className="font-bold text-accent-light mr-1.5">
                    {currentItem.title}:
                  </strong>
                ) : null}
                <span className="text-slate-100">{currentItem.message}</span>
              </p>
            </div>
          </div>

          {/* Right: Counter, Nav Controls & "View All Notifications" Button */}
          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
            {/* 1 of 5 Counter & Arrows */}
            {bannerItems.length > 1 && (
              <div className="flex items-center gap-1.5 border-r border-accent/25 pr-3">
                <span className="num text-[11px] font-bold text-accent-light">
                  {currentIndex + 1} / {bannerItems.length}
                </span>

                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    aria-label="Previous notice"
                    onClick={() =>
                      setCurrentIndex((prev) => (prev === 0 ? bannerItems.length - 1 : prev - 1))
                    }
                    className="rounded p-1 text-slate-300 hover:bg-accent/20 hover:text-white transition-colors"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label="Next notice"
                    onClick={() => setCurrentIndex((prev) => (prev + 1) % bannerItems.length)}
                    className="rounded p-1 text-slate-300 hover:bg-accent/20 hover:text-white transition-colors"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Prominently Styled "View All" Button */}
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/20 px-3 py-1 text-xs font-bold text-accent-light hover:bg-accent hover:text-white shadow-sm transition-all duration-200"
            >
              <Bell size={12} />
              <span>All Notices</span>
              <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </div>

      {/* All Notifications Modal with Search */}
      <NotificationsModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        notifications={notifications}
      />
    </>
  )
}
