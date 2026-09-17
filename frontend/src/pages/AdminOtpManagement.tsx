import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  KeyRound,
  Search,
  RefreshCw,
  Copy,
  Mail,
  Clock,
  ExternalLink,
  ShieldCheck,
  Sliders,
  Phone,
  Building2,
  X,
  Send,
} from 'lucide-react'
import { adminApi, type PasswordResetItem } from '../api/admin.api'
import { useToastStore } from '../store/toastStore'
import { PageHeader, Button, Badge, Avatar } from '../components'

export function AdminOtpManagement() {
  const addToast = useToastStore((s) => s.addToast)

  const [items, setItems] = useState<PasswordResetItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'USED' | 'EXPIRED'>('ALL')
  const [activeTemplatePreview, setActiveTemplatePreview] = useState<PasswordResetItem | null>(null)
  const [expiryMinutesSetting, setExpiryMinutesSetting] = useState<number>(15)
  const [now, setNow] = useState(Date.now())

  // Ticker for live remaining countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [resets, config] = await Promise.all([
        adminApi.getPasswordResets().catch(() => []),
        adminApi.getSystemConfig().catch(() => null),
      ])
      setItems(resets || [])
      if (config?.passwordResetOtpExpiryMinutes) {
        setExpiryMinutesSetting(Number(config.passwordResetOtpExpiryMinutes))
      }
    } catch {
      addToast({
        title: 'Error',
        message: 'Could not fetch password reset records',
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleCopyText = (text: string, title: string, message: string) => {
    navigator.clipboard.writeText(text)
    addToast({
      title,
      message,
      variant: 'success',
    })
  }

  const extractSubject = (text: string) => {
    const match = text.match(/^Subject:\s*(.+)$/m)
    return match ? match[1].trim() : 'Password Reset Verification Code'
  }

  const extractBody = (text: string) => {
    return text.replace(/^Subject:\s*.+\r?\n\r?\n?/, '').trim()
  }

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter !== 'ALL' && item.status !== statusFilter) {
        return false
      }
      if (!search.trim()) return true
      const q = search.toLowerCase().trim()
      return (
        item.userName?.toLowerCase().includes(q) ||
        item.userEmail?.toLowerCase().includes(q) ||
        item.employeeId?.toLowerCase().includes(q) ||
        item.department?.toLowerCase().includes(q) ||
        item.designation?.toLowerCase().includes(q) ||
        item.otp?.includes(q)
      )
    })
  }, [items, search, statusFilter])

  // Counts
  const counts = useMemo(() => {
    return {
      total: items.length,
      active: items.filter((i) => i.status === 'ACTIVE').length,
      used: items.filter((i) => i.status === 'USED').length,
      expired: items.filter((i) => i.status === 'EXPIRED').length,
    }
  }, [items])

  const getRemainingText = (expiresAtStr: string) => {
    const exp = new Date(expiresAtStr).getTime()
    const diffSec = Math.floor((exp - now) / 1000)
    if (diffSec <= 0) return 'Expired'
    const mins = Math.floor(diffSec / 60)
    const secs = diffSec % 60
    return `${mins}m ${secs}s remaining`
  }

  return (
    <div className="w-full space-y-6 pb-16">
      <PageHeader
        eyebrow="IDENTITY & ACCESS MANAGEMENT"
        title="Password Reset & Verification Queue"
        description="Review operator password reset requests, inspect employee credentials, and dispatch 6-digit verification codes across authorized operational channels."
        meta={
          <div className="flex items-center gap-2 pt-1">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                counts.active > 0
                  ? 'bg-nominal/15 text-nominal border border-nominal/30'
                  : 'bg-white/5 text-text-dim border border-white/10'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  counts.active > 0 ? 'bg-nominal animate-pulse' : 'bg-slate-500'
                }`}
              />
              <span>{counts.active} Active Verification Codes</span>
            </span>
            <span className="num text-xs text-text-dim">
              · Configured Expiry Window: {expiryMinutesSetting} mins
            </span>
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <Link to="/admin/settings">
              <Button variant="secondary" size="sm" className="gap-1.5 cursor-pointer text-xs">
                <Sliders size={13} className="text-accent-light" />
                <span>Configure Expiry</span>
              </Button>
            </Link>

            <Button
              variant="primary"
              size="sm"
              onClick={fetchData}
              disabled={loading}
              className="gap-1.5 cursor-pointer text-xs font-semibold"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Refresh Queue</span>
            </Button>
          </div>
        }
      />

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Active Codes */}
        <div className="rounded-xl border border-nominal/30 bg-nominal/[0.04] p-4 flex items-center justify-between shadow-sm">
          <div>
            <div className="text-[11px] font-mono uppercase font-semibold text-nominal">Active Codes</div>
            <div className="text-2xl font-bold font-mono text-white mt-1">{counts.active}</div>
            <div className="text-[11px] text-text-dim mt-0.5">Valid for verification</div>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-nominal/15 text-nominal border border-nominal/30">
            <KeyRound size={22} className={counts.active > 0 ? 'animate-pulse' : ''} />
          </div>
        </div>

        {/* Metric 2: Used / Completed */}
        <div className="rounded-xl border border-white/10 bg-card p-4 flex items-center justify-between shadow-sm">
          <div>
            <div className="text-[11px] font-mono uppercase font-semibold text-text-dim">Passwords Updated</div>
            <div className="text-2xl font-bold font-mono text-white mt-1">{counts.used}</div>
            <div className="text-[11px] text-text-dim mt-0.5">Successfully consumed</div>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-text-secondary border border-white/10">
            <ShieldCheck size={22} className="text-nominal" />
          </div>
        </div>

        {/* Metric 3: Expired Codes */}
        <div className="rounded-xl border border-white/10 bg-card p-4 flex items-center justify-between shadow-sm">
          <div>
            <div className="text-[11px] font-mono uppercase font-semibold text-text-dim">Expired Requests</div>
            <div className="text-2xl font-bold font-mono text-white mt-1">{counts.expired}</div>
            <div className="text-[11px] text-text-dim mt-0.5">Exceeded validity window</div>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-text-secondary border border-white/10">
            <Clock size={22} className="text-warning" />
          </div>
        </div>

        {/* Metric 4: Total Requests & Expiry Setting */}
        <div className="rounded-xl border border-white/10 bg-card p-4 flex items-center justify-between shadow-sm">
          <div>
            <div className="text-[11px] font-mono uppercase font-semibold text-text-dim">Global Validity</div>
            <div className="text-2xl font-bold font-mono text-accent-light mt-1">{expiryMinutesSetting}m</div>
            <div className="text-[11px] text-text-dim mt-0.5">
              <Link to="/admin/settings" className="text-accent-light hover:underline">
                Adjust in Settings →
              </Link>
            </div>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 text-accent-light border border-accent/30">
            <Sliders size={22} />
          </div>
        </div>
      </div>

      {/* INTRANET / EXTERNAL DISPATCH NOTICE */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-white/10 bg-card/60 p-3.5 text-xs text-slate-300 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent-light border border-accent/30">
            <Send size={13} />
          </span>
          <span className="leading-relaxed">
            <strong className="text-white font-semibold">Offline / Manual Dispatch Mode:</strong> Automated SMTP email delivery is inactive. Use <span className="text-accent-light font-medium">"Copy Template"</span> or <span className="text-accent-light font-medium">"Mail Client"</span> to dispatch verification codes to operators via Outlook, NIC webmail, intranet chat, or phone.
          </span>
        </div>
      </div>

      {/* FILTER & SEARCH TOOLBAR */}
      <div className="rounded-xl border border-border-default bg-card p-4 space-y-3 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-accent text-white shadow-sm'
                  : 'bg-white/5 text-text-secondary hover:bg-white/10 hover:text-white'
              }`}
            >
              All Requests ({counts.total})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('ACTIVE')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'ACTIVE'
                  ? 'bg-nominal text-slate-950 font-bold shadow-sm'
                  : 'bg-white/5 text-text-secondary hover:bg-white/10 hover:text-white'
              }`}
            >
              Active ({counts.active})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('USED')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'USED'
                  ? 'bg-white/20 text-white font-bold shadow-sm'
                  : 'bg-white/5 text-text-secondary hover:bg-white/10 hover:text-white'
              }`}
            >
              Used / Completed ({counts.used})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('EXPIRED')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'EXPIRED'
                  ? 'bg-warning text-slate-950 font-bold shadow-sm'
                  : 'bg-white/5 text-text-secondary hover:bg-white/10 hover:text-white'
              }`}
            >
              Expired ({counts.expired})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-80">
            <Search size={14} className="absolute left-3 top-2.5 text-text-dim" />
            <input
              type="text"
              placeholder="Search by operator, email, ID, dept..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border-default bg-[#070c18] pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-text-dim focus:border-accent focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2 text-text-dim hover:text-white"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* DETAILED USER DETAILS & OTP TABLE */}
      <div className="rounded-xl border border-border-default bg-card shadow-sm overflow-hidden">
        <div className="border-b border-border-subtle bg-black/20 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound size={16} className="text-accent-light" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Verification Code Records & Operator Profiles ({filteredItems.length})
            </h3>
          </div>
          <span className="text-[11px] text-text-dim font-mono">
            CLICK "COPY OTP" OR "COPY TEMPLATE" TO DISPATCH
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-text-dim space-y-3">
            <RefreshCw size={24} className="animate-spin mx-auto text-accent-light" />
            <p className="text-xs font-mono">Loading operator verification queue…</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-text-dim">
              <KeyRound size={24} />
            </div>
            <div className="text-sm font-semibold text-white">No Verification Requests Found</div>
            <p className="text-xs text-text-secondary max-w-md mx-auto leading-relaxed">
              {search || statusFilter !== 'ALL'
                ? 'No password reset requests matched your active filters or search keyword.'
                : 'No password reset OTP requests have been recorded yet. When an operator requests a reset from the portal login modal, their details and OTP will appear here.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border-subtle bg-black/10 text-text-dim text-[11px] font-mono uppercase tracking-wider">
                  <th className="py-3 px-4 font-semibold">Operator & Identity</th>
                  <th className="py-3 px-4 font-semibold">Department & Contact</th>
                  <th className="py-3 px-4 font-semibold">Verification Code (OTP)</th>
                  <th className="py-3 px-4 font-semibold">Lifecycle Status</th>
                  <th className="py-3 px-4 font-semibold">Requested / Expires</th>
                  <th className="py-3 px-4 text-right font-semibold">Admin Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {filteredItems.map((item) => {
                  const isActive = item.status === 'ACTIVE'
                  const isUsed = item.status === 'USED'
                  const isExpired = item.status === 'EXPIRED'

                  return (
                    <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                      {/* Col 1: Operator & Identity */}
                      <td className="py-3 px-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 shrink-0">
                            <Avatar name={item.userName || 'Operator'} size="sm" />
                          </div>
                          <div className="space-y-0.5 min-w-0">
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <span className="truncate">{item.userName || 'Operator'}</span>
                              {item.role === 'ADMIN' && (
                                <span className="rounded bg-purple-400/15 text-purple-300 border border-purple-400/30 px-1 py-0.5 text-[9px] font-mono font-bold">
                                  ADMIN
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-text-dim font-mono truncate">{item.userEmail}</div>
                            <div className="flex items-center gap-2 pt-0.5">
                              {item.employeeId && (
                                <span className="rounded bg-white/5 border border-white/10 px-1.5 py-0.5 text-[9px] font-mono font-semibold text-slate-300">
                                  ID: {item.employeeId}
                                </span>
                              )}
                              {item.userStatus && item.userStatus !== 'ACTIVE' && (
                                <Badge variant={item.userStatus === 'PENDING' ? 'warning' : 'critical'}>
                                  {item.userStatus}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Col 2: Department & Contact */}
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 font-medium text-white">
                            <Building2 size={13} className="text-accent-light shrink-0" />
                            <span className="truncate">{item.department || 'General Operations'}</span>
                            {item.departmentCode && (
                              <span className="rounded bg-accent/15 text-accent-light px-1 py-0.2 text-[9px] font-mono font-bold">
                                {item.departmentCode}
                              </span>
                            )}
                          </div>
                          {item.designation && (
                            <div className="text-[11px] text-text-secondary truncate">
                              {item.designation}
                            </div>
                          )}
                          {item.phone && (
                            <div className="flex items-center gap-1 text-[10px] text-text-dim font-mono">
                              <Phone size={11} className="text-slate-400" />
                              <a href={`tel:${item.phone}`} className="hover:text-white hover:underline">
                                {item.phone}
                              </a>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Col 3: Verification Code (OTP) */}
                      <td className="py-3 px-4">
                        <div className="inline-flex items-center gap-2.5">
                          <span className="font-mono text-lg font-extrabold text-accent-light tracking-[0.25em] bg-black/50 px-3 py-1.5 rounded-lg border border-accent/40 shadow-inner">
                            {item.otp}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyText(
                                item.otp,
                                'OTP Copied',
                                `Copied verification code ${item.otp} for ${item.userName}`
                              )
                            }
                            className="p-1.5 rounded-lg border border-white/10 bg-white/5 text-text-dim hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                            title="Copy 6-digit OTP code"
                          >
                            <Copy size={13} />
                          </button>
                        </div>
                      </td>

                      {/* Col 4: Lifecycle Status */}
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                              isActive
                                ? 'bg-nominal/15 text-nominal border border-nominal/30'
                                : isUsed
                                ? 'bg-white/5 text-slate-400 border border-white/10'
                                : 'bg-warning/15 text-warning border border-warning/30'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                isActive ? 'bg-nominal animate-pulse' : isUsed ? 'bg-slate-500' : 'bg-warning'
                              }`}
                            />
                            <span>{item.status}</span>
                          </span>

                          {isActive && (
                            <div className="text-[10px] font-mono text-nominal font-semibold flex items-center gap-1">
                              <Clock size={11} />
                              <span>{getRemainingText(item.expiresAt)}</span>
                            </div>
                          )}
                          {isUsed && (
                            <div className="text-[10px] text-text-dim font-mono">
                              Password successfully updated
                            </div>
                          )}
                          {isExpired && (
                            <div className="text-[10px] text-warning/80 font-mono">
                              Window elapsed
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Col 5: Requested / Expires */}
                      <td className="py-3 px-4 text-[11px] font-mono">
                        <div className="space-y-0.5">
                          <div className="text-text-secondary">
                            Req: {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </div>
                          <div className={isActive ? 'text-accent-light font-medium' : 'text-text-dim'}>
                            Exp: {new Date(item.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className="text-[10px] text-text-dim">
                            {new Date(item.createdAt).toLocaleDateString()} ({item.expiryMinutes}m)
                          </div>
                        </div>
                      </td>

                      {/* Col 6: Admin Actions */}
                      <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyText(
                              item.templateText,
                              'Template Copied',
                              `Ready-to-forward message template copied for ${item.userEmail}`
                            )
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent-light hover:bg-accent/25 hover:border-accent transition-colors cursor-pointer"
                          title="Copy full forwardable notification message"
                        >
                          <Copy size={12} />
                          <span>Copy Template</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setActiveTemplatePreview(item)}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-text-secondary hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                          title="View and inspect forwardable message"
                        >
                          <ExternalLink size={12} />
                          <span>View</span>
                        </button>

                        <a
                          href={`mailto:${item.userEmail}?subject=${encodeURIComponent(
                            extractSubject(item.templateText)
                          )}&body=${encodeURIComponent(extractBody(item.templateText))}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-text-dim hover:text-accent-light hover:border-accent-light/40 hover:bg-white/10 transition-colors cursor-pointer"
                          title="Open in Outlook / Webmail with pre-filled message"
                        >
                          <Mail size={12} />
                          <span>Mail Client</span>
                        </a>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: FORWARDABLE EMAIL TEMPLATE PREVIEW */}
      {activeTemplatePreview && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-page/85 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl border border-border-default bg-[#0a0f1d] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent-light border border-accent/30">
                  <Mail size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Forwardable Password Reset Template</h3>
                  <p className="text-xs text-text-dim">Ready to send via Outlook, Webmail, Teams, or Chat</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTemplatePreview(null)}
                className="p-1.5 rounded-lg text-text-dim hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Requester Snapshot */}
            <div className="p-3 rounded-xl border border-white/10 bg-[#060b16] space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-text-dim">Operator:</span>
                <span className="font-bold text-white">{activeTemplatePreview.userName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-dim">Official Email:</span>
                <span className="font-mono text-accent-light">{activeTemplatePreview.userEmail}</span>
              </div>
              {activeTemplatePreview.employeeId && (
                <div className="flex items-center justify-between">
                  <span className="text-text-dim">Employee ID:</span>
                  <span className="font-mono text-slate-300">{activeTemplatePreview.employeeId}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-1 border-t border-white/5">
                <span className="text-text-dim">Verification OTP:</span>
                <span className="font-mono text-lg font-extrabold text-accent-light tracking-widest">
                  {activeTemplatePreview.otp}
                </span>
              </div>
            </div>

            {/* Template Message Box */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Forwardable Message Body
              </label>
              <textarea
                readOnly
                rows={11}
                value={activeTemplatePreview.templateText}
                className="w-full rounded-xl border border-white/10 bg-[#060b16] p-3 text-xs font-mono text-slate-300 outline-none resize-none leading-relaxed select-all"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <a
                href={`mailto:${activeTemplatePreview.userEmail}?subject=${encodeURIComponent(
                  extractSubject(activeTemplatePreview.templateText)
                )}&body=${encodeURIComponent(extractBody(activeTemplatePreview.templateText))}`}
                className="inline-flex items-center gap-1.5 text-xs text-accent-light hover:underline font-medium"
                title="Launch external mail client (Outlook, Thunderbird, etc.)"
              >
                <Send size={13} />
                <span>Open Mail Client</span>
              </a>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setActiveTemplatePreview(null)}
                >
                  Close
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    handleCopyText(
                      activeTemplatePreview.templateText,
                      'Template Copied',
                      'Template ready to paste into external email or chat message'
                    )
                    setActiveTemplatePreview(null)
                  }}
                  className="gap-1.5"
                >
                  <Copy size={13} />
                  <span>Copy Template</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
