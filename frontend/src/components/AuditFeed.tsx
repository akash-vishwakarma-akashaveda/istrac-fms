import {
  Activity,
  Calendar,
  FileText,
  FileUp,
  FileDown,
  UserCheck,
  UserX,
  Users,
  LogIn,
  ShieldAlert,
  Building2,
  Layers,
  Radio,
  Cpu,
  KeyRound,
} from 'lucide-react'
import { useRecentAuditLog } from '../hooks/useRecentAuditLog'
import { Panel } from './Panel'
import type { AuditLogEntry } from '../api'

function timeAgo(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diffMs / 60000)

  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`

  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`

  return `${Math.floor(hrs / 24)}d ago`
}

function getResourceLabel(entry: AuditLogEntry): string | null {
  const data = entry.newValue || entry.oldValue
  if (data && typeof data === 'object') {
    if (typeof data.title === 'string' && data.title) return data.title
    if (typeof data.name === 'string' && data.name) return data.name
    if (typeof data.originalName === 'string' && data.originalName) return data.originalName
    if (typeof data.fileName === 'string' && data.fileName) return data.fileName
    if (typeof data.code === 'string' && data.code) return data.code
  }
  if (entry.resourceType && entry.resourceId) {
    return `${entry.resourceType} #${entry.resourceId}`
  }
  return null
}

function getDeptBadge(entry: AuditLogEntry): string | null {
  const data = entry.newValue || entry.oldValue
  if (data && typeof data === 'object') {
    if (typeof data.departmentCode === 'string') return data.departmentCode
    if (typeof data.deptCode === 'string') return data.deptCode
    if (data.department && typeof (data.department as any).code === 'string') {
      return (data.department as any).code
    }
  }
  return null
}

interface FormattedAudit {
  actor: string
  verb: string
  target: string | null
  deptBadge: string | null
  actionTag: string
  icon: any
  iconBg: string
  iconColor: string
}

function parseAuditEntry(entry: AuditLogEntry): FormattedAudit {
  const actor = entry.userName || 'System Controller'
  const target = getResourceLabel(entry)
  const deptBadge = getDeptBadge(entry)
  const action = (entry.action || '').toUpperCase()

  // 1. Mission Events & Calendar
  if (action.startsWith('EVENT:') || action.includes('EVENT') || entry.resourceType === 'event') {
    if (action.includes('CANCEL')) {
      return {
        actor,
        verb: 'cancelled mission pass',
        target,
        deptBadge,
        actionTag: 'EVENT CANCEL',
        icon: Calendar,
        iconBg: 'bg-critical/15 border-critical/30',
        iconColor: 'text-critical',
      }
    }
    if (action.includes('CREATE')) {
      return {
        actor,
        verb: 'scheduled mission event',
        target,
        deptBadge,
        actionTag: 'EVENT SCHEDULE',
        icon: Calendar,
        iconBg: 'bg-nominal/15 border-nominal/30',
        iconColor: 'text-nominal',
      }
    }
    if (action.includes('UPDATE')) {
      return {
        actor,
        verb: 'updated event parameters for',
        target,
        deptBadge,
        actionTag: 'EVENT UPDATE',
        icon: Calendar,
        iconBg: 'bg-accent/15 border-accent/30',
        iconColor: 'text-accent-light',
      }
    }
    if (action.includes('DELETE')) {
      return {
        actor,
        verb: 'purged mission event',
        target,
        deptBadge,
        actionTag: 'EVENT DELETE',
        icon: Calendar,
        iconBg: 'bg-critical/15 border-critical/30',
        iconColor: 'text-critical',
      }
    }
    return {
      actor,
      verb: 'modified flight event',
      target,
      deptBadge,
      actionTag: 'EVENT',
      icon: Calendar,
      iconBg: 'bg-accent/15 border-accent/30',
      iconColor: 'text-accent-light',
    }
  }

  // 2. Files & Datasets
  if (action.startsWith('FILE') || action.startsWith('FOLDER') || entry.resourceType === 'file') {
    if (action.includes('DOWNLOAD')) {
      return {
        actor,
        verb: 'downloaded dataset',
        target,
        deptBadge,
        actionTag: 'DOWNLOAD',
        icon: FileDown,
        iconBg: 'bg-blue-400/15 border-blue-400/30',
        iconColor: 'text-blue-400',
      }
    }
    if (action.includes('UPLOAD') || action.includes('INGEST')) {
      return {
        actor,
        verb: 'ingested telemetry file',
        target,
        deptBadge,
        actionTag: 'FILE UPLOAD',
        icon: FileUp,
        iconBg: 'bg-nominal/15 border-nominal/30',
        iconColor: 'text-nominal',
      }
    }
    if (action.includes('DELETE')) {
      return {
        actor,
        verb: 'deleted dataset file',
        target,
        deptBadge,
        actionTag: 'FILE DELETE',
        icon: FileText,
        iconBg: 'bg-critical/15 border-critical/30',
        iconColor: 'text-critical',
      }
    }
    if (action.includes('RESTORE')) {
      return {
        actor,
        verb: 'restored archived file',
        target,
        deptBadge,
        actionTag: 'FILE RESTORE',
        icon: FileText,
        iconBg: 'bg-nominal/15 border-nominal/30',
        iconColor: 'text-nominal',
      }
    }
    if (action.includes('TOGGLE_VISIBILITY')) {
      return {
        actor,
        verb: 'changed classification visibility for',
        target,
        deptBadge,
        actionTag: 'VISIBILITY',
        icon: FileText,
        iconBg: 'bg-warning/15 border-warning/30',
        iconColor: 'text-warning',
      }
    }
    if (action.includes('FOLDER')) {
      return {
        actor,
        verb: 'created telemetry directory',
        target,
        deptBadge,
        actionTag: 'DIRECTORY',
        icon: FileText,
        iconBg: 'bg-purple-400/15 border-purple-400/30',
        iconColor: 'text-purple-400',
      }
    }
    return {
      actor,
      verb: 'updated dataset metadata for',
      target,
      deptBadge,
      actionTag: 'FILE UPDATE',
      icon: FileText,
      iconBg: 'bg-accent/15 border-accent/30',
      iconColor: 'text-accent-light',
    }
  }

  // 3. User Clearances & Approvals
  if (action.includes('USER') || entry.resourceType === 'user') {
    if (action.includes('APPROVE')) {
      return {
        actor,
        verb: 'approved operator clearance for',
        target: target || 'new operator',
        deptBadge,
        actionTag: 'ACCESS APPROVED',
        icon: UserCheck,
        iconBg: 'bg-nominal/15 border-nominal/30',
        iconColor: 'text-nominal',
      }
    }
    if (action.includes('REJECT')) {
      return {
        actor,
        verb: 'rejected registration request for',
        target: target || 'applicant',
        deptBadge,
        actionTag: 'ACCESS REJECTED',
        icon: UserX,
        iconBg: 'bg-critical/15 border-critical/30',
        iconColor: 'text-critical',
      }
    }
    if (action.includes('PROFILE')) {
      return {
        actor,
        verb: 'updated operator profile credentials',
        target: null,
        deptBadge,
        actionTag: 'PROFILE',
        icon: Users,
        iconBg: 'bg-accent/15 border-accent/30',
        iconColor: 'text-accent-light',
      }
    }
    return {
      actor,
      verb: 'modified user clearance for',
      target,
      deptBadge,
      actionTag: 'USER ACCESS',
      icon: Users,
      iconBg: 'bg-purple-400/15 border-purple-400/30',
      iconColor: 'text-purple-400',
    }
  }

  // 4. Authentication
  if (action.includes('LOGIN') || action.includes('AUTH') || action.includes('REGISTER')) {
    if (action.includes('FAILED')) {
      return {
        actor,
        verb: 'failed authentication challenge',
        target: null,
        deptBadge,
        actionTag: 'AUTH FAILED',
        icon: ShieldAlert,
        iconBg: 'bg-critical/15 border-critical/30',
        iconColor: 'text-critical',
      }
    }
    if (action.includes('REGISTER')) {
      return {
        actor,
        verb: 'submitted registration clearance request',
        target: null,
        deptBadge,
        actionTag: 'REGISTRATION',
        icon: KeyRound,
        iconBg: 'bg-blue-400/15 border-blue-400/30',
        iconColor: 'text-blue-400',
      }
    }
    return {
      actor,
      verb: 'authenticated secure operator session',
      target: null,
      deptBadge,
      actionTag: 'LOGIN',
      icon: LogIn,
      iconBg: 'bg-nominal/15 border-nominal/30',
      iconColor: 'text-nominal',
    }
  }

  // 5. Departments / Divisions
  if (action.includes('DEPARTMENT') || entry.resourceType === 'department') {
    return {
      actor,
      verb: action.includes('UPDATE') ? 'updated division configuration for' : action.includes('DELETE') ? 'deleted division' : 'configured division',
      target,
      deptBadge: deptBadge || (target ? target.slice(0, 4).toUpperCase() : null),
      actionTag: 'DIVISION',
      icon: Building2,
      iconBg: 'bg-accent/15 border-accent/30',
      iconColor: 'text-accent-light',
    }
  }

  // 6. CMS & Portal Blocks
  if (action.includes('CMS') || entry.resourceType === 'cms_block') {
    return {
      actor,
      verb: 'published CMS portal changes to',
      target: target || entry.resourceId || 'landing page',
      deptBadge,
      actionTag: 'CMS EDIT',
      icon: Layers,
      iconBg: 'bg-cyan-400/15 border-cyan-400/30',
      iconColor: 'text-cyan-400',
    }
  }

  // 7. Satellite Operations
  if (action.includes('SATELLITE') || entry.resourceType === 'satellite') {
    return {
      actor,
      verb: action.includes('DELETE') ? 'decommissioned spacecraft' : action.includes('CREATE') ? 'registered new satellite' : 'updated spacecraft telemetry for',
      target,
      deptBadge,
      actionTag: 'SPACECRAFT',
      icon: Radio,
      iconBg: 'bg-indigo-400/15 border-indigo-400/30',
      iconColor: 'text-indigo-400',
    }
  }

  // 8. Storage & System Config
  if (action.includes('STORAGE') || action.includes('CONFIG') || action.includes('STATION')) {
    return {
      actor,
      verb: 'configured ground station infrastructure',
      target,
      deptBadge,
      actionTag: 'SYSTEM CONFIG',
      icon: Cpu,
      iconBg: 'bg-purple-400/15 border-purple-400/30',
      iconColor: 'text-purple-400',
    }
  }

  // Default Fallback
  return {
    actor,
    verb: 'performed operational action',
    target: target || (entry.resourceType ? `${entry.resourceType} #${entry.resourceId || ''}` : null),
    deptBadge,
    actionTag: entry.action,
    icon: Activity,
    iconBg: 'bg-surface border-border-default',
    iconColor: 'text-text-dim',
  }
}

export function AuditFeed() {
  const { data: entries, isLoading } = useRecentAuditLog()

  return (
    /* A log, read top-down: the event in natural plain language, actor, target resource,
       and elapsed time with action badges. */
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
              <div className="flex items-center gap-3">
                <div className="h-7 w-7 animate-pulse rounded-lg bg-card-hover" />
                <div className="h-3 w-48 animate-pulse rounded-xs bg-card-hover" />
              </div>
              <div className="h-3 w-12 animate-pulse rounded-xs bg-card-hover" />
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
          {entries.map((entry) => {
            const parsed = parseAuditEntry(entry)
            const Icon = parsed.icon
            const istTimestamp = new Date(entry.createdAt).toLocaleString('en-IN', {
              timeZone: 'Asia/Kolkata',
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })

            return (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-3 px-4 py-3 transition-colors duration-150 hover:bg-card-hover group"
                title={`${istTimestamp} IST`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${parsed.iconBg} ${parsed.iconColor}`}
                  >
                    <Icon size={14} />
                  </div>

                  <div className="min-w-0 flex-1 text-xs leading-relaxed truncate">
                    <span className="font-bold text-text-primary mr-1.5">
                      {parsed.actor}
                    </span>
                    <span className="text-text-secondary mr-1.5">
                      {parsed.verb}
                    </span>
                    {parsed.target && (
                      <span className="font-semibold text-accent-light truncate">
                        "{parsed.target}"
                      </span>
                    )}
                    {parsed.deptBadge && (
                      <span className="ml-1.5 rounded px-1.5 py-0.2 text-[9px] font-mono font-bold bg-accent/15 text-accent-light border border-accent/25 inline-block">
                        {parsed.deptBadge}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="num hidden shrink-0 text-[10px] font-mono text-text-dim border border-border-subtle rounded px-1.5 py-0.5 bg-surface/50 sm:inline-block">
                    {parsed.actionTag}
                  </span>

                  <span className="num text-right text-[11px] text-text-dim">
                    {timeAgo(entry.createdAt)}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}
