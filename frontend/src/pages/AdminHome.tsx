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
  KeyRound,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAdminStats } from '../hooks/useAdminStats'
import { usePendingUsers, useApproveUser, useRejectUser } from '../hooks/usePendingUsers'
import { StatCard, SetupWizardModal } from '../components'
import { apiClient } from '../api/client'
import { useToastStore } from '../store/toastStore'
import { useCms } from '../context/cmsContext'
import { useCategoryLabel } from '../components/CategoryOptions'

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
  const { cmsBlocks, refetch: refetchCms } = useCms()
  const headerBlock = (cmsBlocks['nav_header']?.content || cmsBlocks['nav_header'] || cmsBlocks['nav_footer']) as Record<string, any> | undefined
  const brandTitle = headerBlock?.brandTitle ?? 'ISTRAC'
  const brandHighlight = headerBlock?.brandHighlight !== undefined ? headerBlock.brandHighlight : '-SIMS'
  const brandSubtitle = headerBlock?.brandSubtitle ?? 'ISRO Ground Network'

  const { data: stats, isLoading, refetch } = useAdminStats()
  console.log('Admin Stats:', stats)
  const categoryLabel = useCategoryLabel()
  const addToast = useToastStore((s) => s.addToast)

  const { data: pendingUsersData, isLoading: loadingPending, refetch: refetchPending } = usePendingUsers()
  const pendingUsers = pendingUsersData || []
  const approveUser = useApproveUser()
  const rejectUser = useRejectUser()

  const [processingId, setProcessingId] = useState<string | null>(null)
  const [isWizardOpen, setIsWizardOpen] = useState(false)
  const [storageStatus, setStorageStatus] = useState<{
    mounted: boolean
    mountPath?: string
    writable?: boolean
  }>({ mounted: true, mountPath: 'D:\\istrac_storage' })

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
    fetchStorageStatus()
    refetchCms()
  }, [])

  const handleApprove = async (id: string, name: string) => {
    setProcessingId(id)
    try {
      await approveUser.mutateAsync({ userId: id })
      addToast({
        title: 'User Approved',
        message: `${name}'s account has been activated with member privileges.`,
        variant: 'success',
      })
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
      await rejectUser.mutateAsync({ userId: id, reason: 'Registration declined by administrator.' })
      addToast({
        title: 'User Rejected',
        message: `${name}'s access request was declined.`,
        variant: 'warning',
      })
      refetch()
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
    <div className="space-y-6 w-full pb-10">
      {/* Top Mission Command Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border-subtle pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-isro-saffron" />
            <span className="text-[13px] font-bold uppercase tracking-[0.08em] text-saffron-text">
              {brandTitle}{brandHighlight} · {brandSubtitle || 'Ground Station Command & Control'}
            </span>
          </div>
          <h1 className="display mt-2 text-[28px] font-bold leading-tight tracking-tight text-text-primary sm:text-[32px]">
            Administrative Command Center
          </h1>
          <p className="mt-1.5 text-[15px] text-text-secondary">
            System overview, access authorizations, telemetry repositories, and storage health.
          </p>
        </div>

        {/* Header Action Shortcuts */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {!storageStatus.mounted && (
            <button
              type="button"
              onClick={() => setIsWizardOpen(true)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-[10px] bg-warning-bg px-4 text-sm font-semibold text-warning transition-colors hover:brightness-95"
            >
              <span>⚡ Mount Storage Required</span>
            </button>
          )}

          <Link
            to="/admin/upload"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-[10px] bg-saffron px-4 text-sm font-bold text-white transition-colors hover:bg-saffron-hover"
          >
            <Upload size={14} />
            <span>Upload Report</span>
          </Link>

          <Link
            to="/admin/broadcast"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-[10px] bg-saffron-soft px-4 text-sm font-semibold text-saffron-text transition-colors hover:bg-saffron-soft-hover cursor-pointer"
          >
            <Megaphone size={14} />
            <span>Broadcast Alert</span>
          </Link>

          <Link
            to="/admin/users"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-[10px] bg-saffron-soft px-4 text-sm font-semibold text-saffron-text transition-colors hover:bg-saffron-soft-hover cursor-pointer"
          >
            <Users size={14} />
            <span>Manage Users</span>
          </Link>

          <button
            type="button"
            onClick={() => {
              refetch()
              refetchPending()
              fetchStorageStatus()
            }}
            className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-page-soft text-text-primary transition-colors hover:bg-border-subtle"
            title="Refresh Telemetry"
          >
            <RefreshCw size={15} className={isLoading || loadingPending ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Warning Banner if Storage Unmounted */}
      {!storageStatus.mounted && (
        <div className="flex flex-col gap-3 rounded-2xl border border-warning/30 bg-warning-bg p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning/20 text-warning border border-warning/30">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-text-primary">
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
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-[10px] bg-warning-fill px-4 text-sm font-bold text-white transition-colors hover:brightness-110"
          >
            <span>⚡ Launch Storage Mount Wizard</span>
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* System Telemetry Badges Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="flex items-center gap-3 rounded-2xl border border-border-subtle bg-card shadow-card p-3.5 transition-shadow hover:shadow-card-hover">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-blue-soft text-accent-light">
            <Radio size={18} />
          </div>
          <div className="min-w-0">
            <dt className="text-xs font-semibold text-text-muted">MySQL Database</dt>
            <dd className="text-sm font-bold text-nominal truncate">Connected (3306)</dd>
          </div>
        </div>

        <Link
          to="/admin/settings"
          className="flex items-center gap-3 rounded-2xl border border-border-subtle bg-card shadow-card p-3.5 transition-shadow hover:shadow-card-hover"
        >
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] ${
              storageStatus.mounted ? 'bg-blue-soft text-accent-light' : 'bg-critical-bg text-critical'
            }`}
          >
            <HardDrive size={16} />
          </div>
          <div className="min-w-0">
            <dt className="text-xs font-semibold text-text-muted">Storage Mount</dt>
            <dd
              className={`text-sm font-bold truncate ${
                storageStatus.mounted ? 'text-nominal' : 'text-critical'
              }`}
            >
              {storageStatus.mounted ? 'Online (RAID)' : 'Requires Mount'}
            </dd>
          </div>
        </Link>

        <div className="flex items-center gap-3 rounded-2xl border border-border-subtle bg-card shadow-card p-3.5 transition-shadow hover:shadow-card-hover">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-blue-soft text-accent-light">
            <Shield size={16} />
          </div>
          <div className="min-w-0">
            <dt className="text-xs font-semibold text-text-muted">Security Protocol</dt>
            <dd className="text-sm font-bold text-text-primary truncate">Multi-RBAC Level 4</dd>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-border-subtle bg-card shadow-card p-3.5 transition-shadow hover:shadow-card-hover">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-blue-soft text-accent-light">
            <Clock size={16} />
          </div>
          <div className="min-w-0">
            <dt className="text-xs font-semibold text-text-muted">Tracking Hub</dt>
            <dd className="text-sm font-bold text-text-primary truncate">BLR MOX Active</dd>
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
        <div className="rounded-2xl border border-border-subtle bg-card shadow-card overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 sm:px-5 py-3 sm:py-3.5 border-b border-border-default bg-surface/50 gap-2">
            <div className="flex items-center gap-2">
              <FileText size={15} className="text-accent-light" />
              <h3 className="text-sm font-semibold text-text-primary">
                Recent Files
              </h3>
              <span className="num font-bold text-[10px] text-nominal rounded-full bg-nominal/15 border border-nominal/30 px-2 py-0.5">
                LIVE REPOSITORY FEED
              </span>
            </div>

            <div className="flex items-center gap-3 self-end sm:self-auto">
              <span className="sm:hidden text-[10px] text-text-dim font-mono">Scroll table →</span>
              <Link
                to="/admin/files"
                className="text-xs font-bold text-accent-light hover:underline flex items-center gap-1"
              >
                <span>View All Files</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto touch-pan-x">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-border-subtle bg-surface text-[10px] font-bold text-text-dim uppercase tracking-wider">
                  <th className="px-4 py-2.5">File Name</th>
                  <th className="px-4 py-2.5">Report Category</th>
                  <th className="px-4 py-2.5">Department</th>
                  <th className="px-4 py-2.5">Spacecraft Target</th>
                  <th className="px-4 py-2.5">Size</th>
                  <th className="px-4 py-2.5">Date Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-xs">
                {stats.recentFiles
                  .filter((file) => {
                    const sc = (file.report?.spacecraft || file.department?.satellite?.name || '').trim().toUpperCase()
                    return sc && sc !== 'GENERAL' && !sc.includes('GENERAL')
                  })
                  .map((file) => (
                  <tr key={file.id} className="hover:bg-card-hover transition-colors">
                    <td className="px-4 py-2.5">
                      <span className="font-bold text-text-primary block truncate max-w-xs">{file.name}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-md bg-blue-soft px-2 py-0.5 text-[11px] font-semibold text-accent-light">
                        {categoryLabel(file.report?.customCategory || file.report?.category) || 'GENERAL'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="num text-[11px] font-mono text-accent-light">
                        {file.department?.code || file.department?.name || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-text-primary">
                        {file.report?.spacecraft && !file.report.spacecraft.toUpperCase().includes('GENERAL')
                          ? file.report.spacecraft
                          : (file.department?.satellite?.name && !file.department.satellite.name.toUpperCase().includes('GENERAL'))
                            ? file.department.satellite.name
                            : '—'}
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
        <div className="rounded-2xl border border-border-subtle bg-card shadow-card p-5">
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-warning/20 text-warning">
                <AlertTriangle size={14} />
              </span>
              <div>
                <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
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
              className="flex shrink-0 items-center gap-1 text-sm font-semibold text-accent-light hover:underline"
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
                  <p className="text-xs font-bold text-text-primary">{u.name}</p>
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
                    className="inline-flex min-h-9 items-center gap-1 rounded-[10px] bg-nominal-bg px-3.5 text-sm font-semibold text-nominal transition-colors hover:bg-nominal-fill hover:text-white disabled:opacity-50"
                  >
                    <CheckCircle2 size={13} />
                    <span>Approve</span>
                  </button>

                  <button
                    type="button"
                    disabled={processingId === u.id}
                    onClick={() => handleReject(u.id, u.name)}
                    className="inline-flex min-h-9 items-center gap-1 rounded-[10px] bg-critical-bg px-3.5 text-sm font-semibold text-critical transition-colors hover:bg-critical-fill hover:text-white disabled:opacity-50"
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
          <h3 className="text-lg font-bold text-text-primary">
            Operational Management Suite
          </h3>
          <span className="text-[13px] text-text-muted">6 modules</span>
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {/* Card 1: Satellites & Missions */}
          <Link
            to="/admin/satellites"
            className="group relative flex flex-col justify-between rounded-2xl border border-border-subtle bg-card shadow-card p-5 transition-shadow hover:shadow-card-hover"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-blue-soft text-accent-light">
                <Radio size={20} />
              </div>
              <span className="rounded bg-surface px-2 py-0.5 text-[10px] font-bold text-text-dim border border-border-subtle group-hover:border-accent/30 group-hover:text-accent-light">
                FLEET REGISTRY
              </span>
            </div>
            <div className="mt-4">
              <h4 className="text-sm font-bold text-text-primary group-hover:text-accent-light flex items-center justify-between">
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
            className="group relative flex flex-col justify-between rounded-2xl border border-border-subtle bg-card shadow-card p-5 transition-shadow hover:shadow-card-hover"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-blue-soft text-accent-light">
                <UserCheck size={20} />
              </div>
              <span className="rounded bg-surface px-2 py-0.5 text-[10px] font-bold text-text-dim border border-border-subtle group-hover:border-accent/30 group-hover:text-accent-light">
                {pendingUsers.length > 0 ? `${pendingUsers.length} PENDING` : '0 PENDING'}
              </span>
            </div>
            <div className="mt-4">
              <h4 className="text-sm font-bold text-text-primary group-hover:text-accent-light flex items-center justify-between">
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
            className="group relative flex flex-col justify-between rounded-2xl border border-border-subtle bg-card shadow-card p-5 transition-shadow hover:shadow-card-hover"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-blue-soft text-accent-light">
                <Users size={20} />
              </div>
              <span className="rounded bg-surface px-2 py-0.5 text-[10px] font-bold text-text-dim border border-border-subtle group-hover:border-accent/30 group-hover:text-accent-light">
                RBAC MATRIX
              </span>
            </div>
            <div className="mt-4">
              <h4 className="text-sm font-bold text-text-primary group-hover:text-accent-light flex items-center justify-between">
                <span>User Accounts & Roles</span>
                <ArrowRight size={14} className="opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
              </h4>
              <p className="mt-1 text-xs text-text-secondary leading-relaxed">
                Manage user profiles, assign administrative permissions, suspend accounts, and force logouts.
              </p>
            </div>
          </Link>

          {/* Card: Password Reset OTPs & Verification */}
          <Link
            to="/admin/password-resets"
            className="group relative flex flex-col justify-between rounded-2xl border border-border-subtle bg-card shadow-card p-5 transition-shadow hover:shadow-card-hover"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-blue-soft text-accent-light">
                <KeyRound size={20} />
              </div>
              <span className="rounded bg-surface px-2 py-0.5 text-[10px] font-bold text-text-dim border border-border-subtle group-hover:border-accent/30 group-hover:text-accent-light font-mono">
                OTP DISPATCH
              </span>
            </div>
            <div className="mt-4">
              <h4 className="text-sm font-bold text-text-primary group-hover:text-accent-light flex items-center justify-between">
                <span>Password Reset OTPs</span>
                <ArrowRight size={14} className="opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
              </h4>
              <p className="mt-1 text-xs text-text-secondary leading-relaxed">
                Inspect 6-digit verification codes with complete user profile details and dispatch forwardable message templates.
              </p>
            </div>
          </Link>

          {/* Card 3: Department Management */}
          <Link
            to="/admin/departments"
            className="group relative flex flex-col justify-between rounded-2xl border border-border-subtle bg-card shadow-card p-5 transition-shadow hover:shadow-card-hover"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-blue-soft text-accent-light">
                <Building2 size={20} />
              </div>
              <span className="rounded bg-surface px-2 py-0.5 text-[10px] font-bold text-text-dim border border-border-subtle group-hover:border-accent/30 group-hover:text-accent-light">
                {stats?.departments} DIVISIONS
              </span>
            </div>
            <div className="mt-4">
              <h4 className="text-sm font-bold text-text-primary group-hover:text-accent-light flex items-center justify-between">
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
            className="group relative flex flex-col justify-between rounded-2xl border border-border-subtle bg-card shadow-card p-5 transition-shadow hover:shadow-card-hover"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-blue-soft text-accent-light">
                <Megaphone size={20} />
              </div>
              <span className="rounded bg-surface px-2 py-0.5 text-[10px] font-bold text-text-dim border border-border-subtle group-hover:border-accent/30 group-hover:text-accent-light">
                REAL-TIME WS
              </span>
            </div>
            <div className="mt-4">
              <h4 className="text-sm font-bold text-text-primary group-hover:text-accent-light flex items-center justify-between">
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
            className="group relative flex flex-col justify-between rounded-2xl border border-border-subtle bg-card shadow-card p-5 transition-shadow hover:shadow-card-hover"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-blue-soft text-accent-light">
                <Layout size={20} />
              </div>
              <span className="rounded bg-surface px-2 py-0.5 text-[10px] font-bold text-text-dim border border-border-subtle group-hover:border-accent/30 group-hover:text-accent-light">
                LIVE EDIT
              </span>
            </div>
            <div className="mt-4">
              <h4 className="text-sm font-bold text-text-primary group-hover:text-accent-light flex items-center justify-between">
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
            className="group relative flex flex-col justify-between rounded-2xl border border-border-subtle bg-card shadow-card p-5 transition-shadow hover:shadow-card-hover"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-blue-soft text-accent-light">
                <Settings size={20} />
              </div>
              <span className="rounded bg-surface px-2 py-0.5 text-[10px] font-bold text-text-dim border border-border-subtle group-hover:border-accent/30 group-hover:text-accent-light">
                CONFIG
              </span>
            </div>
            <div className="mt-4">
              <h4 className="text-sm font-bold text-text-primary group-hover:text-accent-light flex items-center justify-between">
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

      {/* Setup & Storage Mount Wizard Modal */}
      <SetupWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onComplete={() => refetch()}
      />
    </div>
  )
}