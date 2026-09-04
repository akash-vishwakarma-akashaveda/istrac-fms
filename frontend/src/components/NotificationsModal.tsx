import { useState, useEffect, useRef } from 'react'
import { Bell, Search, X, Radio, Satellite, Shield, Cpu, Clock, CheckCircle2, Filter } from 'lucide-react'

export interface NotificationModalItem {
  id: string
  title?: string
  message: string
  category?: string
  type?: string
  timestamp?: string
  createdAt?: string
}

interface NotificationsModalProps {
  isOpen: boolean
  onClose: () => void
  notifications: NotificationModalItem[]
}

const CATEGORY_STYLES: Record<string, { badge: string; icon: typeof Radio }> = {
  MISSION: { badge: 'bg-accent/15 text-accent-light border-accent/30', icon: Satellite },
  PASS: { badge: 'bg-nominal/15 text-nominal border-nominal/30', icon: Radio },
  MAINTENANCE: { badge: 'bg-purple-400/15 text-purple-400 border-purple-400/30', icon: Cpu },
  SECURITY: { badge: 'bg-cyan-400/15 text-cyan-400 border-cyan-400/30', icon: Shield },
  RELAY: { badge: 'bg-warning/15 text-warning border-warning/30', icon: Radio },
  BROADCAST: { badge: 'bg-accent/15 text-accent-light border-accent/30', icon: Bell },
  OTHER: { badge: 'bg-surface text-text-secondary border-border-default', icon: Bell },
}

export function NotificationsModal({ isOpen, onClose, notifications }: NotificationsModalProps) {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('ALL')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setSearch('')
      setSelectedCategory('ALL')
    }
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const categories = [
    'ALL',
    ...Array.from(
      new Set(
        notifications
          .map((n) => (n.category || n.type || 'OTHER').toUpperCase())
          .filter(Boolean)
      )
    ),
  ]

  const filtered = notifications.filter((item) => {
    const text = `${item.title || ''} ${item.message || ''} ${item.category || ''} ${item.type || ''}`.toLowerCase()
    const matchesSearch = text.includes(search.toLowerCase())
    const itemCat = (item.category || item.type || 'OTHER').toUpperCase()
    const matchesCat = selectedCategory === 'ALL' || itemCat === selectedCategory
    return matchesSearch && matchesCat
  })

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-16 sm:pt-20">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-page/85 backdrop-blur-md transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="All Mission Notifications"
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-border-default bg-[#0b1220] shadow-2xl transition-all"
      >
        {/* Header */}
        <div className="border-b border-border-subtle/80 bg-[#101a2f] p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20 text-accent-light border border-accent/30">
                <Bell size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text-primary">
                  Operational Broadcasts & Mission Notices
                </h3>
                <p className="text-[11px] text-text-dim">
                  Real-time telemetry advisories and ground network updates
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-text-dim hover:bg-card hover:text-text-primary transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Search Box */}
          <div className="relative mt-4">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notifications by keyword, station, mission..."
              className="w-full rounded-xl border border-border-default bg-[#070c17] pl-9 pr-8 py-2 text-xs text-text-primary placeholder:text-text-dim focus:border-accent focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-primary"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Category Filter Chips */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="eyebrow text-[10px] text-text-dim mr-1 flex items-center gap-1">
              <Filter size={11} /> Filter:
            </span>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  selectedCategory === cat
                    ? 'bg-accent text-white shadow-sm shadow-accent/30'
                    : 'border border-border-subtle bg-surface text-text-muted hover:border-border-default hover:text-text-primary'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Notification List */}
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-2.5 divide-y divide-border-subtle/40">
          {filtered.map((item, idx) => {
            const catKey = (item.category || item.type || 'OTHER').toUpperCase()
            const meta = CATEGORY_STYLES[catKey] || CATEGORY_STYLES.OTHER
            const Icon = meta.icon

            return (
              <div
                key={item.id || idx}
                className="pt-2.5 first:pt-0 group rounded-xl p-3 hover:bg-[#121c32] transition-colors border border-transparent hover:border-border-subtle"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${meta.badge}`}>
                      <Icon size={14} />
                    </div>

                    <div className="min-w-0">
                      {item.title && (
                        <h4 className="text-xs font-bold text-text-primary group-hover:text-accent-light transition-colors">
                          {item.title}
                        </h4>
                      )}
                      <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                        {item.message}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <span className="num text-[10px] text-text-dim flex items-center gap-1">
                      <Clock size={11} />
                      {item.timestamp || (item.createdAt ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent')}
                    </span>
                    <span className={`mt-1 inline-block rounded border px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider ${meta.badge}`}>
                      {catKey}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}

          {filtered.length === 0 && (
            <div className="py-12 text-center text-text-muted">
              <Bell size={28} className="mx-auto mb-2 opacity-30 text-accent-light" />
              <p className="text-xs font-semibold text-text-primary">No notifications found</p>
              <p className="num mt-1 text-[11px] text-text-dim">Try clearing the search query or category filter.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-border-subtle bg-[#101a2f] px-5 py-3 text-[11px] text-text-dim">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 size={13} className="text-nominal" />
            Live Ground Broadcast Sync Active ({notifications.length} Total Notices)
          </span>
          <div className="flex items-center gap-3">
            <a
              href="/notifications"
              onClick={onClose}
              className="text-accent-light hover:underline font-semibold flex items-center gap-1"
            >
              <span>Open in Nav Feed</span>
              <span>→</span>
            </a>
            <span className="num text-text-dim/60">· ESC to close</span>
          </div>
        </div>
      </div>
    </div>
  )
}
