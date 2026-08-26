import { useState } from 'react'
import {
  Bell,
  CheckCheck,
  Radio,
  AlertTriangle,
  Flame,
  Info,
} from 'lucide-react'
import { useNotifications, useMarkAllRead, useMarkRead } from '../hooks/useNotifications'
import { Button, PageHeader } from '../components'

const TABS = ['All', 'Unread', 'Passes', 'System', 'Broadcasts'] as const

export function NotificationsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('All')

  // Map category to API param if needed
  const categoryParam =
    tab === 'Passes'
      ? 'PASS'
      : tab === 'System'
      ? 'SYSTEM'
      : tab === 'Broadcasts'
      ? 'BROADCAST'
      : undefined

  const { data, fetchNextPage, hasNextPage } = useNotifications(categoryParam)
  const markAllRead = useMarkAllRead()
  const markRead = useMarkRead()

  let items: any[] = data?.pages.flatMap((p: any) => p.data || []) ?? []
  if (tab === 'Unread') {
    items = items.filter((i) => !i.readAt)
  }

  const unreadCount = items.filter((i) => !i.readAt).length

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 text-text-primary">
      <PageHeader
        eyebrow="Mission Operations"
        title="Broadcasts & Station Alerts"
        meta={
          <span className="num text-xs text-text-dim font-mono">
            {unreadCount > 0 ? `${unreadCount} Unread Alerts` : 'All Alerts Acknowledged'}
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllRead.mutate()}
              className="border-border-default hover:border-accent text-xs font-bold"
            >
              <CheckCheck size={14} className="text-nominal" />
              <span>Acknowledge All</span>
            </Button>
          </div>
        }
      />

      {/* Category Tabs Rail */}
      <div className="flex gap-2 border-b border-border-subtle pb-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              tab === t
                ? 'bg-accent/20 border border-accent/40 text-accent-light shadow-sm'
                : 'text-text-secondary hover:text-white hover:bg-card-hover border border-transparent'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      {items.length === 0 ? (
        <div className="rounded-xl border border-border-subtle bg-card p-12 text-center space-y-2 shadow-sm">
          <Bell size={32} className="mx-auto text-text-dim opacity-50" />
          <p className="text-sm font-bold text-white">No Active Alerts</p>
          <p className="text-xs text-text-dim">You are fully caught up with all ground telemetry broadcasts.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((n: any) => {
            const isUnread = !n.readAt
            const isCritical = n.category === 'CRITICAL' || n.type === 'EMERGENCY'
            const isPass = n.type === 'PASS'
            const isMaint = n.type === 'MAINTENANCE' || n.category === 'MAINTENANCE'

            return (
              <div
                key={n.id}
                onClick={() => {
                  if (isUnread) markRead.mutate(n.id)
                }}
                className={`p-4 rounded-xl border transition-all flex items-start justify-between gap-4 cursor-pointer ${
                  isUnread
                    ? 'border-accent/40 bg-[#0b1730] shadow-sm hover:border-accent'
                    : 'border-border-default bg-card hover:bg-card-hover hover:border-border-subtle'
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border mt-0.5 ${
                      isCritical
                        ? 'bg-red-500/15 border-red-500/30 text-red-400'
                        : isPass
                        ? 'bg-accent/15 border-accent/30 text-accent-light'
                        : isMaint
                        ? 'bg-yellow-500/15 border-yellow-500/30 text-yellow-400'
                        : 'bg-nominal/15 border-nominal/30 text-nominal'
                    }`}
                  >
                    {isCritical ? (
                      <Flame size={18} />
                    ) : isPass ? (
                      <Radio size={18} />
                    ) : isMaint ? (
                      <AlertTriangle size={18} />
                    ) : (
                      <Info size={18} />
                    )}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                          isCritical
                            ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                            : isPass
                            ? 'bg-accent/15 text-accent-light border border-accent/30'
                            : isMaint
                            ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30'
                            : 'bg-nominal/15 text-nominal border border-nominal/30'
                        }`}
                      >
                        {n.type || 'ALERT'}
                      </span>

                      {isUnread && (
                        <span className="rounded bg-accent text-white px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                          NEW
                        </span>
                      )}

                      <span className="num text-[11px] text-text-dim">
                        {new Date(n.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <p className={`text-xs leading-relaxed ${isUnread ? 'text-white font-medium' : 'text-text-secondary'}`}>
                      {n.message}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 pt-1">
                  {isUnread ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        markRead.mutate(n.id)
                      }}
                      className="text-[11px] font-bold text-accent-light hover:underline"
                    >
                      Acknowledge
                    </button>
                  ) : (
                    <span className="text-[11px] text-text-dim font-mono">Read</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

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
