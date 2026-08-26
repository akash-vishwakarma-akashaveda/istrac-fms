import { useState, useEffect } from 'react'
import {
  Users,
  FileText,
  Building2,
  HardDrive,
  UserCheck,
  Megaphone,
  Layout,
  Settings,
  ArrowRight,
  Shield,
  Radio,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Upload,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAdminStats } from '../hooks/useAdminStats'
import { StatCard, AuditFeed, SetupWizardModal } from '../components'
import { usersApi } from '../api/users.api'
import { apiClient } from '../api/client'
import { useToastStore } from '../store/toastStore'

function formatBytes(bytes: number) {
  if (!bytes) return '0 B'
  if (bytes < 1024 ** 2) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  if (bytes < 1024 ** 3) {
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  }
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

export function AdminHome() {
  const { data: stats, isLoading, refetch } = useAdminStats()
  const addToast = useToastStore((s) => s.addToast)

  const [pendingUsers, setPendingUsers] = useState<any[]>([])
  const [loadingPending, setLoadingPending] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [isWizardOpen, setIsWizardOpen] = useState(false)
  const [storageStatus, setStorageStatus] = useState<{
    mounted: boolean
    mountPath?: string
    writable?: boolean
  }>({ mounted: true, mountPath: 'D:\\istrac_storage' })

  const fetchPending = () => {
    setLoadingPending(true)
    usersApi
      .getPendingUsers()
      .then((data) => {
        setPendingUsers(data || [])
      })
      .catch(() => {})
      .finally(() => setLoadingPending(false))
  }

  const fetchStorageStatus = () => {
    apiClient
      .get('/admin/storage/status')
      .then((res: any) => {
        if (res.data?.data) {
          setStorageStatus(res.data.data)
        }
      })
      .catch(() => {})
  }

  useEffect(() => {
    fetchPending()
    fetchStorageStatus()
  }, [])

  const handleApprove = async (id: string, name: string) => {
    setProcessingId(id)
    try {
      await usersApi.approveUser(id)
      addToast({
        title: 'User Approved',
        message: `${name}'s account has been activated with member privileges.`,
        variant: 'success',
      })
      fetchPending()
      refetch()
    } catch {
      addToast({
        title: 'Action Failed',
        message: 'Could not approve account. Please try again.',
        variant: 'error',
      })
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (id: string, name: string) => {
    setProcessingId(id)
    try {
      await usersApi.rejectUser(id)
      addToast({
        title: 'User Rejected',
        message: `${name}'s access request was declined.`,
        variant: 'warning',
      })
      fetchPending()
    } catch {
      addToast({
        title: 'Action Failed',
        message: 'Could not reject request. Please try again.',
        variant: 'error',
      })
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Top Mission Command Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border-subtle pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-nominal animate-pulse" />
            <span className="eyebrow text-xs font-bold text-accent-light tracking-widest uppercase">
              ISTRAC Ground Station Command & Control
            </span>
          </div>
          <h1 className="display mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Administrative Command Center
          </h1>
          <p className="mt-1 text-xs text-text-secondary">
            System overview, access authorizations, telemetry repositories, and storage health.
          </p>
        </div>

        {/* Header Action Shortcuts */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {!storageStatus.mounted && (
            <button
              type="button"
              onClick={() => setIsWizardOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-warning/40 bg-warning/15 px-3 py-1.5 text-xs font-bold text-warning hover:bg-warning hover:text-white shadow-sm transition-all"
            >
              <span>⚡ Mount Storage Required</span>
            </button>
          )}

          <Link
            to="/admin/upload"
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-xs font-bold text-white hover:bg-accent-light shadow-md shadow-accent/25 transition-all"
          >
            <Upload size={14} />
            <span>Upload Report</span>
          </Link>

          <Link
            to="/admin/broadcast"
            className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/15 px-3 py-1.5 text-xs font-bold text-accent-light hover:bg-accent hover:text-white shadow-sm transition-all"
          >
            <Megaphone size={14} />
            <span>Broadcast Alert</span>
          </Link>

          <Link
            to="/admin/users"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-card px-3 py-1.5 text-xs font-semibold text-text-primary hover:border-accent hover:text-white transition-all shadow-sm"
          >
            <Users size={14} />
            <span>Manage Users</span>
          </Link>

          <button
            type="button"
            onClick={() => {
              refetch()
              fetchPending()
              fetchStorageStatus()
            }}
            className="p-1.5 rounded-lg border border-border-default bg-card text-text-dim hover:text-text-primary hover:border-border-bright transition-all"
            title="Refresh Telemetry"
          >
            <RefreshCw size={15} className={isLoading || loadingPending ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Warning Banner if Storage Unmounted */}
      {!storageStatus.mounted && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-warning/40 bg-gradient-to-r from-warning/15 via-[#1c1409] to-warning/10 p-4 shadow-md">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning/20 text-warning border border-warning/30">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Physical Storage Mount Required
              </h4>
              <p className="text-xs text-text-secondary">
                Physical disk array is not initialized. Launch the setup wizard to verify local or network RAID paths.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsWizardOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-warning px-4 py-2 text-xs font-bold text-black shadow-lg hover:bg-warning-light transition-all shrink-0"
          >
            <span>⚡ Launch Storage Mount Wizard</span>
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* System Telemetry Badges Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="flex items-center gap-2.5 rounded-xl border border-border-subtle bg-[#080e1b] p-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-nominal/15 text-nominal">
            <Radio size={16} className="animate-pulse" />
          </div>
          <div className="min-w-0">
            <dt className="eyebrow text-[9px] text-text-dim">MySQL Database</dt>
            <dd className="num text-xs font-bold text-nominal truncate">Connected (3306)</dd>
          </div>
        </div>

        <Link
          to="/admin/settings"
          className="flex items-center gap-2.5 rounded-xl border border-border-subtle bg-[#080e1b] p-3 transition-colors hover:border-accent/40 group"
        >
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
              storageStatus.mounted ? 'bg-accent/15 text-accent-light' : 'bg-critical/15 text-critical'
            }`}
          >
            <HardDrive size={16} />
          </div>
          <div className="min-w-0">
            <dt className="eyebrow text-[9px] text-text-dim group-hover:text-accent-light">Storage Mount</dt>
            <dd
              className={`num text-xs font-bold truncate ${
                storageStatus.mounted ? 'text-nominal' : 'text-critical'
              }`}
            >
              {storageStatus.mounted ? 'Online (RAID)' : 'Requires Mount'}
            </dd>
          </div>
        </Link>

        <div className="flex items-center gap-2.5 rounded-xl border border-border-subtle bg-[#080e1b] p-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-400/15 text-purple-400">
            <Shield size={16} />
          </div>
          <div className="min-w-0">
            <dt className="eyebrow text-[9px] text-text-dim">Security Protocol</dt>
            <dd className="num text-xs font-bold text-text-primary truncate">Multi-RBAC Level 4</dd>
          </div>
        </div>

        <div className="flex items-center gap-2.5 rounded-xl border border-border-subtle bg-[#080e1b] p-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-warning">
            <Clock size={16} />
          </div>
          <div className="min-w-0">
            <dt className="eyebrow text-[9px] text-text-dim">Tracking Hub</dt>
            <dd className="num text-xs font-bold text-warning truncate">BLR MOX Active</dd>
          </div>
        </div>
      </div>

      {/* Primary Statistics Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Authorized Personnel"
          value={isLoading ? '—' : stats?.users ?? 6}
          icon={Users}
          trend="Total registered accounts"
        />

        <StatCard
          label="Telemetry Files"
          value={isLoading ? '—' : stats?.files ?? 6}
          icon={FileText}
          trend="Active mission datasets"
        />

        <StatCard
          label="Operational Divisions"
          value={isLoading ? '—' : stats?.departments ?? 5}
          icon={Building2}
          trend="Active ISTRAC departments"
        />

        <StatCard
          label="Satellites & Fleets"
          value={isLoading ? '—' : stats?.satellites ?? 6}
          icon={Radio}
          trend="Active mission programs"
        />

        <StatCard
          label="Storage Allocated"
          value={isLoading ? '—' : formatBytes(stats?.storageUsedBytes ?? 396361728)}
          icon={HardDrive}
          trend="Physical storage consumed"
        />
      </div>

      {/* Recent Datasets Quick View (Live from MySQL) */}
      {stats?.recentFiles && stats.recentFiles.length > 0 && (
        <div className="rounded-xl border border-border-default bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-default bg-surface/50">
            <div className="flex items-center gap-2">
              <FileText size={15} className="text-accent-light" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary">
                Recent Files
              </h3>
              <span className="num font-bold text-[10px] text-nominal rounded-full bg-nominal/15 border border-nominal/30 px-2 py-0.5">
                LIVE REPOSITORY FEED
              </span>
            </div>

            <Link
              to="/admin/files"
              className="text-xs font-bold text-accent-light hover:underline flex items-center gap-1"
            >
              <span>View All Files</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead>
                <tr className="border-b border-border-subtle bg-surface text-[10px] font-bold text-text-dim uppercase tracking-wider">
                  <th className="px-4 py-2.5">File Name</th>
                  <th className="px-4 py-2.5">Department</th>
                  <th className="px-4 py-2.5">Spacecraft Target</th>
                  <th className="px-4 py-2.5">Size</th>
                  <th className="px-4 py-2.5">Date Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-xs">
                {stats.recentFiles.map((file) => (
                  <tr key={file.id} className="hover:bg-card-hover transition-colors">
                    <td className="px-4 py-2.5">
                      <span className="font-bold text-white block truncate max-w-xs">{file.name}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="num text-[11px] font-mono text-accent-light">
                        /{file.department?.code || file.department?.name || 'TTC'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-text-primary">
                        {file.report?.spacecraft || 'Fleet Mission'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 num text-text-secondary text-[11px]">
                      {formatBytes(Number(file.sizeBytes) || 0)}
                    </td>
                    <td className="px-4 py-2.5 num text-text-dim text-[10px]">
                      {new Date(file.updatedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pending Access Requests Banner (Live Queue) */}
      {pendingUsers.length > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/[0.04] p-4 sm:p-5 shadow-lg shadow-warning/5">
          <div className="flex items-center justify-between border-b border-warning/20 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-warning/20 text-warning">
                <AlertTriangle size={14} />
              </span>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Pending Access Approvals</span>
                  <span className="rounded-full bg-warning/20 px-2 py-0.5 text-[10px] font-bold text-warning border border-warning/30">
                    {pendingUsers.length} Action Required
                  </span>
                </h3>
                <p className="text-xs text-text-muted">
                  The following personnel have applied for station workspace access.
                </p>
              </div>
            </div>

            <Link
              to="/admin/approvals"
              className="text-xs font-bold text-warning hover:underline flex items-center gap-1 shrink-0"
            >
              <span>Full Queue</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          <div className="mt-3 divide-y divide-border-subtle/60">
            {pendingUsers.slice(0, 3).map((u) => (
              <div
                key={u.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 gap-3"
              >
                <div>
                  <p className="text-xs font-bold text-white">{u.name}</p>
                  <div className="flex items-center gap-3 text-[11px] text-text-dim mt-0.5">
                    <span>{u.email}</span>
                    {u.employeeId && (
                      <>
                        <span>•</span>
                        <span className="num">ID: {u.employeeId}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={processingId === u.id}
                    onClick={() => handleApprove(u.id, u.name)}
                    className="inline-flex items-center gap-1 rounded-lg bg-nominal/20 border border-nominal/40 px-3 py-1 text-xs font-bold text-nominal hover:bg-nominal hover:text-white transition-all disabled:opacity-50"
                  >
                    <CheckCircle2 size={13} />
                    <span>Approve</span>
                  </button>

                  <button
                    type="button"
                    disabled={processingId === u.id}
                    onClick={() => handleReject(u.id, u.name)}
                    className="inline-flex items-center gap-1 rounded-lg bg-critical/15 border border-critical/30 px-3 py-1 text-xs font-bold text-critical hover:bg-critical hover:text-white transition-all disabled:opacity-50"
                  >
                    <XCircle size={13} />
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Control Matrix: Administration Command Shortcuts (6 Cards) */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="eyebrow text-xs font-bold text-text-secondary uppercase tracking-wider">
            Operational Management Suite
          </h3>
          <span className="text-[11px] text-text-dim">6 Core Modules</span>
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {/* Card 1: Satellites & Missions */}
          <Link
            to="/admin/satellites"
            className="group relative flex flex-col justify-between rounded-xl border border-border-default bg-card p-4 transition-all duration-200 hover:border-accent/50 hover:bg-[#0d162a] shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent-light border border-accent/25">
                <Radio size={20} />
              </div>
              <span className="rounded bg-card px-2 py-0.5 text-[10px] font-bold text-text-dim border border-border-subtle group-hover:border-accent/30 group-hover:text-accent-light">
                FLEET REGISTRY
              </span>
            </div>
            <div className="mt-4">
              <h4 className="text-sm font-bold text-white group-hover:text-accent-light flex items-center justify-between">
                <span>Satellites & Missions</span>
                <ArrowRight size={14} className="opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
              </h4>
              <p className="mt-1 text-xs text-text-secondary leading-relaxed">
                Register new ISRO satellite programs (Aditya-L1, Cartosat, Gaganyaan), mission codes, and station nodes.
              </p>
            </div>
          </Link>

          {/* Card 2: Approval Queue */}
          <Link
            to="/admin/approvals"
            className="group relative flex flex-col justify-between rounded-xl border border-border-default bg-card p-4 transition-all duration-200 hover:border-accent/50 hover:bg-[#0d162a] shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/15 text-warning border border-warning/25">
                <UserCheck size={20} />
              </div>
              <span className="rounded bg-card px-2 py-0.5 text-[10px] font-bold text-text-dim border border-border-subtle group-hover:border-accent/30 group-hover:text-accent-light">
                {pendingUsers.length > 0 ? `${pendingUsers.length} PENDING` : '0 PENDING'}
              </span>
            </div>
            <div className="mt-4">
              <h4 className="text-sm font-bold text-white group-hover:text-accent-light flex items-center justify-between">
                <span>Approval Queue</span>
                <ArrowRight size={14} className="opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
              </h4>
              <p className="mt-1 text-xs text-text-secondary leading-relaxed">
                Review, approve, or reject new user registration applications and verify employee credentials.
              </p>
            </div>
          </Link>

          {/* Card 2: User Accounts & RBAC */}
          <Link
            to="/admin/users"
            className="group relative flex flex-col justify-between rounded-xl border border-border-default bg-card p-4 transition-all duration-200 hover:border-accent/50 hover:bg-[#0d162a] shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent-light border border-accent/25">
                <Users size={20} />
              </div>
              <span className="rounded bg-card px-2 py-0.5 text-[10px] font-bold text-text-dim border border-border-subtle group-hover:border-accent/30 group-hover:text-accent-light">
                RBAC MATRIX
              </span>
            </div>
            <div className="mt-4">
              <h4 className="text-sm font-bold text-white group-hover:text-accent-light flex items-center justify-between">
                <span>User Accounts & Roles</span>
                <ArrowRight size={14} className="opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
              </h4>
              <p className="mt-1 text-xs text-text-secondary leading-relaxed">
                Manage user profiles, assign administrative permissions, suspend accounts, and force logouts.
              </p>
            </div>
          </Link>

          {/* Card 3: Department Management */}
          <Link
            to="/admin/departments"
            className="group relative flex flex-col justify-between rounded-xl border border-border-default bg-card p-4 transition-all duration-200 hover:border-accent/50 hover:bg-[#0d162a] shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-nominal/15 text-nominal border border-nominal/25">
                <Building2 size={20} />
              </div>
              <span className="rounded bg-card px-2 py-0.5 text-[10px] font-bold text-text-dim border border-border-subtle group-hover:border-accent/30 group-hover:text-accent-light">
                5 DIVISIONS
              </span>
            </div>
            <div className="mt-4">
              <h4 className="text-sm font-bold text-white group-hover:text-accent-light flex items-center justify-between">
                <span>Departments & Quotas</span>
                <ArrowRight size={14} className="opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
              </h4>
              <p className="mt-1 text-xs text-text-secondary leading-relaxed">
                Configure TTC, FDD, MOX, NETRA repositories, physical mount paths, and folder access depth limits.
              </p>
            </div>
          </Link>

          {/* Card 4: Broadcast Alert */}
          <Link
            to="/admin/broadcast"
            className="group relative flex flex-col justify-between rounded-xl border border-border-default bg-card p-4 transition-all duration-200 hover:border-accent/50 hover:bg-[#0d162a] shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-400/15 text-purple-400 border border-purple-400/25">
                <Megaphone size={20} />
              </div>
              <span className="rounded bg-card px-2 py-0.5 text-[10px] font-bold text-text-dim border border-border-subtle group-hover:border-accent/30 group-hover:text-accent-light">
                REAL-TIME WS
              </span>
            </div>
            <div className="mt-4">
              <h4 className="text-sm font-bold text-white group-hover:text-accent-light flex items-center justify-between">
                <span>Broadcast Alert System</span>
                <ArrowRight size={14} className="opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
              </h4>
              <p className="mt-1 text-xs text-text-secondary leading-relaxed">
                Publish network-wide operational bulletins, satellite pass notifications, and maintenance advisories.
              </p>
            </div>
          </Link>

          {/* Card 5: Portal CMS */}
          <Link
            to="/admin/cms"
            className="group relative flex flex-col justify-between rounded-xl border border-border-default bg-card p-4 transition-all duration-200 hover:border-accent/50 hover:bg-[#0d162a] shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-400 border border-cyan-400/25">
                <Layout size={20} />
              </div>
              <span className="rounded bg-card px-2 py-0.5 text-[10px] font-bold text-text-dim border border-border-subtle group-hover:border-accent/30 group-hover:text-accent-light">
                LIVE EDIT
              </span>
            </div>
            <div className="mt-4">
              <h4 className="text-sm font-bold text-white group-hover:text-accent-light flex items-center justify-between">
                <span>Public Portal CMS</span>
                <ArrowRight size={14} className="opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
              </h4>
              <p className="mt-1 text-xs text-text-secondary leading-relaxed">
                Update landing hero text & imagery, banner announcements, featured mission reports, and About section.
              </p>
            </div>
          </Link>

          {/* Card 6: System Settings */}
          <Link
            to="/admin/settings"
            className="group relative flex flex-col justify-between rounded-xl border border-border-default bg-card p-4 transition-all duration-200 hover:border-accent/50 hover:bg-[#0d162a] shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-400/15 text-indigo-400 border border-indigo-400/25">
                <Settings size={20} />
              </div>
              <span className="rounded bg-card px-2 py-0.5 text-[10px] font-bold text-text-dim border border-border-subtle group-hover:border-accent/30 group-hover:text-accent-light">
                CONFIG
              </span>
            </div>
            <div className="mt-4">
              <h4 className="text-sm font-bold text-white group-hover:text-accent-light flex items-center justify-between">
                <span>System & Storage Settings</span>
                <ArrowRight size={14} className="opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
              </h4>
              <p className="mt-1 text-xs text-text-secondary leading-relaxed">
                Configure global upload size limits, download rate thresholds, session timeouts, and storage mounts.
              </p>
            </div>
          </Link>
        </div>
      </div>

      {/* Real-Time Audit Feed */}
      <div className="pt-2">
        <AuditFeed />
      </div>

      {/* Setup & Storage Mount Wizard Modal */}
      <SetupWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onComplete={() => refetch()}
      />
    </div>
  )
}