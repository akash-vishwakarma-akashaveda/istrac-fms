import { Activity } from 'lucide-react'
import { useRecentAuditLog } from '../hooks/useRecentAuditLog'
import { Panel } from './Panel'

const actionLabels: Record<string, string> = {
  FILE_UPLOAD: 'uploaded a file',
  FILE_DOWNLOAD: 'downloaded a file',
  USER_APPROVED: 'approved a user',
  USER_REJECTED: 'rejected a user',
}

function timeAgo(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diffMs / 60000)

  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`

  const hrs = Math.floor(mins / 60)

  if (hrs < 24) return `${hrs}h ago`

  return `${Math.floor(hrs / 24)}d ago`
}

export function AuditFeed() {
  const { data: entries, isLoading } = useRecentAuditLog()

  return (
    /* A log, read top-down: the event in plain language, the raw action code
       and the elapsed time in mono at the right. */
    <Panel
      title="Recent activity"
      meta={!isLoading && entries ? `${entries.length} events` : undefined}
      flush
      className="h-full"
    >
      {isLoading && (
        <div className="divide-y divide-border-subtle">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div className="h-2.5 w-40 animate-pulse rounded-xs bg-card-hover" />
              <div className="h-2.5 w-12 animate-pulse rounded-xs bg-card-hover" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && (!entries || entries.length === 0) && (
        <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
          <Activity size={18} strokeWidth={1.6} className="text-text-dim" aria-hidden="true" />

          <p className="mt-3 text-[13px] text-text-muted">No recent activity.</p>

          <p className="num mt-1.5 text-[10px] text-text-dim">LOG EMPTY</p>
        </div>
      )}

      {!isLoading && entries && entries.length > 0 && (
        <ul className="divide-y divide-border-subtle">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center gap-3 px-4 py-3.5 transition-colors duration-150 hover:bg-card-hover"
            >
              <span
                aria-hidden="true"
                className="h-1 w-1 shrink-0 rounded-full bg-accent"
              />

              <span className="min-w-0 flex-1 truncate text-[13px] text-text-secondary">
                {actionLabels[entry.action] ?? entry.action}
              </span>

              {/* The raw action code, for anyone matching this against a log. */}
              <span className="num hidden shrink-0 text-[10px] text-text-dim md:block">
                {entry.action}
              </span>

              <span className="num w-16 shrink-0 text-right text-[10px] text-text-dim">
                {timeAgo(entry.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
