import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications, useMarkAllRead, useMarkRead } from '../hooks/useNotifications'
import { Button, PageHeader, Panel } from '../components'

const TABS = ['All', 'Unread', 'Files', 'System', 'Approvals'] as const

function groupByDate(items: { createdAt: string, readAt: string | null,id : number ,message : string}[]) {
  const groups: Record<string, typeof items> = {}
  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()

  items.forEach((item) => {
    const d = new Date(item.createdAt).toDateString()
    const label = d === today ? 'Today' : d === yesterday ? 'Yesterday' : new Date(item.createdAt).toLocaleDateString()
    groups[label] = [...(groups[label] ?? []), item]
  })
  return groups
}

export function NotificationsPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<(typeof TABS)[number]>('All')
  const category = tab === 'All' || tab === 'Unread' ? undefined : tab

  const { data, fetchNextPage, hasNextPage } = useNotifications(category)
  const markAllRead = useMarkAllRead()
  const markRead = useMarkRead()

  let items = data?.pages.flatMap((p: any) => p.data || []) ?? []
  if (tab === 'Unread') items = items.filter((i) => !i.readAt)

  const grouped = groupByDate(items)

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Notifications"
        meta={
          <span className="num text-[11px] text-text-dim">
            {items.length} loaded
          </span>
        }
        actions={
          <Button variant="outline" size="sm" onClick={() => markAllRead.mutate()}>
            Mark all read
          </Button>
        }
      />

      {/* Category rail */}
      <div className="-mt-2 flex gap-1 overflow-x-auto border-b border-border-subtle">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={`shrink-0 border-b-2 px-3 pb-2.5 text-[11px] font-bold tracking-[0.1em] uppercase transition-colors duration-150 ${
              tab === t
                ? 'border-b-accent text-accent-light'
                : 'border-b-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {items.length === 0 && (
        <div className="rounded-xl border border-border-subtle bg-card p-10 text-center shadow-card">
          <p className="num text-sm text-text-dim">—</p>
          <p className="mt-2 text-[13px] text-text-muted">Nothing here yet.</p>
        </div>
      )}

      {Object.entries(grouped).map(([date, group]) => (
        <Panel
          key={date}
          title={date}
          meta={
            <span className="num text-[10px] text-text-dim">
              {group.length}
            </span>
          }
          flush
        >
          <div className="divide-y divide-border-subtle">
            {group.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => { markRead.mutate(n.id); navigate('/dashboard/files') }}
                className={`flex w-full items-start gap-3 border-l-2 px-4 py-3 text-left transition-colors duration-150 hover:bg-card-hover ${
                  !n.readAt ? 'border-l-accent' : 'border-l-transparent'
                }`}
              >
                {/* Unread marker — position is the signal, colour only reinforces it. */}
                <span className="mt-1.5 flex w-1.5 shrink-0 justify-center" aria-hidden="true">
                  {!n.readAt && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                </span>

                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-[13px] leading-5 ${
                      !n.readAt ? 'text-text-primary' : 'text-text-secondary'
                    }`}
                  >
                    {n.message}
                  </span>

                  <span className="num mt-1 block text-[10px] text-text-dim">
                    {new Date(n.createdAt).toLocaleTimeString()}
                  </span>
                </span>

                {!n.readAt && (
                  <span className="col-label shrink-0 text-accent-light">New</span>
                )}
              </button>
            ))}
          </div>
        </Panel>
      ))}

      {hasNextPage && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => fetchNextPage()}>
            Load more
          </Button>
        </div>
      )}
    </div>
  )
}
