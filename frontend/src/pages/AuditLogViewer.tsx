import { useState } from 'react'
import {
  Download,
  Search,
  Filter,
  Shield,
  FileText,
  Eye,
  Activity,
  Lock,
  RefreshCw,
} from 'lucide-react'
import { useAuditLog } from '../hooks/useAuditLog'
import { api } from '../lib/axios'
import { exportToCsv } from '../lib/exportCsv'
import { Button, PageHeader, Modal } from '../components'

// Human-friendly action labels & styling
function formatActionDetails(action: string, resourceType?: string | null): {
  label: string
  category: 'AUTH' | 'FILE' | 'USER' | 'CMS' | 'DEPT' | 'SYSTEM'
  color: string
} {
  const act = action.toUpperCase()
  if (act.includes('LOGIN') || act.includes('AUTH') || act.includes('LOGOUT')) {
    return { label: 'Authentication & Session', category: 'AUTH', color: 'border-yellow-400/30 bg-yellow-400/10 text-yellow-300' }
  }
  if (act.includes('FILE') || act.includes('UPLOAD') || act.includes('DOWNLOAD') || resourceType === 'file') {
    return { label: act.includes('DOWNLOAD') ? 'Dataset Downloaded' : 'Telemetry Ingested', category: 'FILE', color: 'border-nominal/30 bg-nominal/10 text-nominal' }
  }
  if (act.includes('USER') || resourceType === 'user') {
    return { label: 'User Clearance Modified', category: 'USER', color: 'border-purple-400/30 bg-purple-400/10 text-purple-300' }
  }
  if (act.includes('CMS') || resourceType === 'cms_block') {
    return { label: 'Portal CMS Updated', category: 'CMS', color: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300' }
  }
  if (act.includes('DEPARTMENT') || resourceType === 'department') {
    return { label: 'Division Configuration', category: 'DEPT', color: 'border-accent/30 bg-accent/10 text-accent-light' }
  }
  return { label: action, category: 'SYSTEM', color: 'border-border-default bg-surface text-text-secondary' }
}

export function AuditLogViewer() {
  const [search, setSearch] = useState('')
  const [actionCategory, setActionCategory] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  const filters = {
    action: actionCategory || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  }

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useAuditLog(filters)

  const rawEntries = data?.pages.flatMap((p) => p.data) ?? []

  // Client-side search filter across user, action, resourceId, and IP
  const filteredEntries = rawEntries.filter((e) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (e.userName && e.userName.toLowerCase().includes(q)) ||
      (e.action && e.action.toLowerCase().includes(q)) ||
      (e.resourceType && e.resourceType.toLowerCase().includes(q)) ||
      (e.resourceId && e.resourceId.toLowerCase().includes(q)) ||
      (e.ipAddress && e.ipAddress.toLowerCase().includes(q))
    )
  })

  // Executive summary counts
  const totalCount = filteredEntries.length
  const authCount = filteredEntries.filter((e) => e.action.includes('AUTH') || e.action.includes('login')).length
  const fileCount = filteredEntries.filter((e) => e.resourceType === 'file' || e.action.includes('FILE')).length
  const clearanceCount = filteredEntries.filter((e) => e.resourceType === 'user' || e.action.includes('USER')).length

  async function handleExport() {
    setIsExporting(true)
    try {
      const { data: exportRows } = await api.get('/admin/audit-logs', {
        params: {
          ...filters,
          export: 'csv',
          pageSize: 5000,
        },
      })
      exportToCsv(
        `istrac-audit-log-${new Date().toISOString().slice(0, 10)}.csv`,
        (exportRows.data || filteredEntries) as unknown as Record<string, unknown>[],
      )
    } catch {
      exportToCsv(
        `istrac-audit-log-${new Date().toISOString().slice(0, 10)}.csv`,
        filteredEntries as unknown as Record<string, unknown>[],
      )
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="w-full space-y-6 pb-16">
      {/* Header */}
      <PageHeader
        eyebrow="Administration & Compliance"
        title="Audit Logs & Security Trail"
        description="Tamper-evident chronological record of all officer actions, telemetry transfers, and security events."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="text-xs"
              title="Refresh Logs"
            >
              <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handleExport}
              disabled={isExporting}
              className="text-xs shadow-md shadow-accent/25"
            >
              <Download size={13} strokeWidth={2} />
              <span>{isExporting ? 'Exporting CSV…' : 'Export Audit CSV'}</span>
            </Button>
          </div>
        }
      />

      {/* ============================================================ */}
      {/* 1. EXECUTIVE SUMMARY METRICS */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-xl border border-border-default bg-card p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-dim block">
              Total Logged Events
            </span>
            <strong className="text-2xl font-bold text-white num block mt-0.5">
              {totalCount}
            </strong>
            <span className="text-[10px] text-text-dim block">Tamper-evident trail</span>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface border border-border-subtle text-accent-light">
            <Activity size={18} />
          </div>
        </div>

        <div className="rounded-xl border border-border-default bg-card p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-dim block">
              Auth & Logins
            </span>
            <strong className="text-2xl font-bold text-yellow-300 num block mt-0.5">
              {authCount}
            </strong>
            <span className="text-[10px] text-text-dim block">Session verifications</span>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface border border-border-subtle text-yellow-400">
            <Lock size={18} />
          </div>
        </div>

        <div className="rounded-xl border border-border-default bg-card p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-dim block">
              Telemetry & Datasets
            </span>
            <strong className="text-2xl font-bold text-nominal num block mt-0.5">
              {fileCount}
            </strong>
            <span className="text-[10px] text-text-dim block">Ingest & file transfers</span>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface border border-border-subtle text-nominal">
            <FileText size={18} />
          </div>
        </div>

        <div className="rounded-xl border border-border-default bg-card p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-dim block">
              Clearance Changes
            </span>
            <strong className="text-2xl font-bold text-purple-300 num block mt-0.5">
              {clearanceCount}
            </strong>
            <span className="text-[10px] text-text-dim block">RBAC & multi-dept scopes</span>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface border border-border-subtle text-purple-400">
            <Shield size={18} />
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. UNIFIED FILTER & SEARCH TOOLBAR */}
      {/* ============================================================ */}
      <div className="rounded-xl border border-border-default bg-card p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-text-primary">
          <Filter size={14} className="text-accent-light" />
          <span>Filter Audit Trail</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {/* Keyword Search */}
          <div className="relative sm:col-span-2">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
            <input
              type="text"
              placeholder="Search officer name, IP address, action, or resource ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border-default bg-[#060c18] pl-9 pr-3 py-2 text-xs text-white placeholder:text-text-dim outline-none focus:border-accent"
            />
          </div>

          {/* Action Category Filter */}
          <div>
            <select
              value={actionCategory}
              onChange={(e) => setActionCategory(e.target.value)}
              className="w-full rounded-lg border border-border-default bg-[#060c18] px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
            >
              <option value="">All Action Categories</option>
              <option value="FILE">FILE (Upload / Download)</option>
              <option value="USER">USER (Clearance & Approvals)</option>
              <option value="POST:/auth">AUTH (Logins & Sessions)</option>
              <option value="CMS">CMS (Portal Configuration)</option>
              <option value="DEPARTMENT">DEPT (Division Settings)</option>
            </select>
          </div>

          {/* From Date Filter */}
          <div>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-lg border border-border-default bg-[#060c18] px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
              title="Filter from date"
            />
          </div>

          {/* To Date Filter */}
          <div>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-lg border border-border-default bg-[#060c18] px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
              title="Filter to date"
            />
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 3. HIGH-READABILITY AUDIT LOG TABLE */}
      {/* ============================================================ */}
      <div className="rounded-xl border border-border-default bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-default bg-surface/50">
          <div className="flex items-center gap-2">
            <Shield size={15} className="text-accent-light" />
            <span className="text-xs font-bold uppercase tracking-wider text-text-primary">
              Audit Event Stream
            </span>
            <span className="num font-bold text-xs text-accent-light rounded-full bg-accent/15 border border-accent/30 px-2 py-0.5">
              {filteredEntries.length} Records
            </span>
          </div>

          <span className="num text-[11px] text-text-dim">
            Live Stream (Latest First)
          </span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs text-text-dim">
            Loading secure audit stream from database…
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <p className="text-sm font-bold text-white">No Audit Events Found</p>
            <p className="text-xs text-text-dim">No records match your active search and filter criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="border-b border-border-default bg-surface text-[11px] font-bold text-text-dim uppercase tracking-wider">
                  <th className="px-5 py-3.5 w-[20%]">Timestamp (UTC)</th>
                  <th className="px-4 py-3.5 w-[20%]">Officer / User</th>
                  <th className="px-4 py-3.5 w-[22%]">Action Description</th>
                  <th className="px-4 py-3.5 w-[14%]">Resource Target</th>
                  <th className="px-4 py-3.5 w-[12%]">IP Address</th>
                  <th className="px-5 py-3.5 w-[12%] text-right">Inspection</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-xs">
                {filteredEntries.map((entry) => {
                  const actionMeta = formatActionDetails(entry.action, entry.resourceType)

                  return (
                    <tr key={entry.id} className="hover:bg-card-hover transition-colors">
                      {/* Timestamp */}
                      <td className="px-5 py-3.5 num text-text-secondary font-mono text-[11px]">
                        <span className="text-white font-bold block">
                          {new Date(entry.createdAt).toLocaleTimeString([], { hour12: false })} UTC
                        </span>
                        <span className="text-[10px] text-text-dim block">
                          {new Date(entry.createdAt).toLocaleDateString()}
                        </span>
                      </td>

                      {/* Officer */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface border border-border-subtle text-accent-light text-xs font-bold">
                            {(entry.userName || 'S')[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-white block truncate">
                              {entry.userName || 'System Authority'}
                            </span>
                            <span className="text-[10px] text-text-dim block truncate font-mono">
                              {entry.userId ? `${entry.userId.slice(0, 8)}…` : 'SYSTEM'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Action Badge & Description */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-1">
                          <span
                            className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-bold uppercase num ${actionMeta.color}`}
                          >
                            <span>{actionMeta.label}</span>
                          </span>
                          <p className="text-[11px] text-text-dim truncate max-w-xs font-mono">
                            {entry.action}
                          </p>
                        </div>
                      </td>

                      {/* Resource Target */}
                      <td className="px-4 py-3.5">
                        <span className="num font-mono text-xs text-text-primary bg-[#060c18] px-2 py-1 rounded border border-border-subtle inline-block max-w-[120px] truncate">
                          {entry.resourceType ? `${entry.resourceType.toUpperCase()}` : 'SYSTEM'}
                        </span>
                      </td>

                      {/* IP Address */}
                      <td className="px-4 py-3.5 num font-mono text-[11px] text-text-dim">
                        {entry.ipAddress || '127.0.0.1 (Local)'}
                      </td>

                      {/* Inspect Details Trigger */}
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedEntry(entry)}
                          className="px-2.5 py-1.5 rounded-lg border border-border-default bg-[#0c1424] text-text-muted hover:border-accent hover:text-white transition-all text-xs font-bold inline-flex items-center gap-1"
                          title="Inspect Event JSON Payload"
                        >
                          <Eye size={12} className="text-accent-light" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Load More Pagination */}
        {hasNextPage && (
          <div className="p-4 border-t border-border-default bg-surface/50 text-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="text-xs"
            >
              {isFetchingNextPage ? 'Loading More Records…' : 'Load More Audit Entries'}
            </Button>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 4. EVENT DETAILS INSPECTION MODAL */}
      {/* ============================================================ */}
      <Modal
        isOpen={selectedEntry !== null}
        onClose={() => setSelectedEntry(null)}
        title="Audit Event Dossier & State Diff"
      >
        {selectedEntry && (
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            <div className="p-3.5 rounded-xl border border-border-default bg-[#060c18] space-y-1">
              <span className="text-[10px] text-text-dim font-mono uppercase font-bold block">
                EVENT ID: #{selectedEntry.id}
              </span>
              <h3 className="text-sm font-bold text-white">
                {selectedEntry.action}
              </h3>
              <p className="text-xs text-text-secondary font-mono">
                Initiated by: <strong className="text-white">{selectedEntry.userName || 'System Authority'}</strong> ({selectedEntry.userId || 'N/A'})
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs num">
              <div className="p-3 rounded-lg border border-border-subtle bg-surface">
                <span className="text-[10px] text-text-dim block uppercase font-bold">Timestamp (UTC)</span>
                <strong className="text-white">{new Date(selectedEntry.createdAt).toUTCString()}</strong>
              </div>

              <div className="p-3 rounded-lg border border-border-subtle bg-surface">
                <span className="text-[10px] text-text-dim block uppercase font-bold">Origin IP / Agent</span>
                <span className="text-text-secondary">{selectedEntry.ipAddress || '127.0.0.1 (Localhost)'}</span>
              </div>

              <div className="p-3 rounded-lg border border-border-subtle bg-surface">
                <span className="text-[10px] text-text-dim block uppercase font-bold">Resource Type</span>
                <strong className="text-accent-light">{selectedEntry.resourceType || 'SYSTEM_CORE'}</strong>
              </div>

              <div className="p-3 rounded-lg border border-border-subtle bg-surface">
                <span className="text-[10px] text-text-dim block uppercase font-bold">Resource Identifier</span>
                <span className="text-text-secondary truncate block font-mono">{selectedEntry.resourceId || 'N/A'}</span>
              </div>
            </div>

            {/* State Diffs (Old Value vs New Value) */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-text-primary block">Audit State Payload (Diff):</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border border-border-subtle bg-[#060c18] space-y-1">
                  <span className="text-[10px] uppercase font-bold text-warning block">Prior State (Old Value)</span>
                  <pre className="text-[11px] font-mono text-text-dim overflow-x-auto max-h-40 p-2 rounded bg-black/40 border border-white/5">
                    {selectedEntry.oldValue ? JSON.stringify(selectedEntry.oldValue, null, 2) : 'null (No previous record)'}
                  </pre>
                </div>

                <div className="p-3 rounded-lg border border-border-subtle bg-[#060c18] space-y-1">
                  <span className="text-[10px] uppercase font-bold text-nominal block">Committed State (New Value)</span>
                  <pre className="text-[11px] font-mono text-text-secondary overflow-x-auto max-h-40 p-2 rounded bg-black/40 border border-white/5">
                    {selectedEntry.newValue ? JSON.stringify(selectedEntry.newValue, null, 2) : 'null (No modified payload)'}
                  </pre>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-border-subtle">
              <Button type="button" variant="outline" size="sm" onClick={() => setSelectedEntry(null)}>
                Close Inspector
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
