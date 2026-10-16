import { useState, useMemo } from 'react'
import { CategoryOptions, useCategoryLabel } from '../components/CategoryOptions'
import { Link } from 'react-router-dom'
import {
  Shield,
  ArrowRight,
  HardDrive,
  Building2,
  Search,
  Radio,
  FileText,
  Eye,
  Download,
  Layers,
  ChevronDown,
  ChevronUp,
  BellRing,
  CloudUpload,
  Database,
  ExternalLink,
  RotateCcw,
  Check,
  FolderOpen,
  Calendar,
} from 'lucide-react'

import { useMissionOverview } from '../hooks/useUserHome'
import { useAuthStore } from '../store/authStore'
import { useCms } from '../context/cmsContext'
import { Button, Modal } from '../components'
import { FileIcon } from '../components/FileIcon'
import { FilePreviewModal } from '../components/FilePreviewModal'
import { formatFileSize } from '../lib/formatFileSize'
import { formatDateTimeIST, formatDateIST } from '../lib/formatDate'
import { api } from '../lib/axios'

const NOTICE_TYPE_LABELS: Record<string, string> = {
  ALL: 'All Types',
  EVENT: 'Mission Events',
  PASS: 'Satellite Passes',
  SYSTEM: 'System Alerts',
  BROADCAST: 'Broadcasts',
  MAINTENANCE: 'Maintenance',
  CRITICAL: 'Critical Alerts',
  EMERGENCY: 'Emergency Bulletins',
  FILE_UPLOAD: 'File Operations',
  NOTICE: 'General Notices',
}

function getNoticeTypeLabel(type: string): string {
  const upper = type.toUpperCase()
  if (NOTICE_TYPE_LABELS[upper]) return NOTICE_TYPE_LABELS[upper]
  return upper.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

export function UserHome() {
  const user = useAuthStore((state) => state.user)
  const isAdmin = user?.role === 'ADMIN'
  const { cmsBlocks } = useCms()

  const navData =
    (cmsBlocks['nav_header'] as any) ||
    (cmsBlocks['nav_footer'] as any)

  const brandTitle = navData?.brandTitle || 'ISTRAC'
  const brandHighlight = navData?.brandHighlight !== undefined ? navData.brandHighlight : '-SIMS'
  const brandSubtitle = navData?.brandSubtitle || 'ISRO Ground Network'

  // Fetch complete mission overview payload from real DB
  const { data: overview, isLoading } = useMissionOverview()
  console.log('Mission Overview:', overview)
  const categoryLabel = useCategoryLabel()
  // Selected Spacecraft Filter
  const [selectedSpacecraft, setSelectedSpacecraft] = useState<string>('ALL')

  // Search & Filter state for Quick Search Panel
  const [searchKeywords, setSearchKeywords] = useState('')
  const [filterCategory, setFilterCategory] = useState('ALL')
  const [filterClassification, setFilterClassification] = useState('ALL')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  // Accordion open/close state for departments
  const [expandedDeptId, setExpandedDeptId] = useState<string | null>(null)

  // Notice board modal
  const [showAllNoticesModal, setShowAllNoticesModal] = useState(false)
  const [selectedNoticeType, setSelectedNoticeType] = useState<string>('ALL')

  // Preview file modal state
  const [previewingFile, setPreviewingFile] = useState<{
    id: string
    name: string
    mimeType: string | null
    sizeBytes: number | null
  } | null>(null)

  // Download Handler
  async function handleDownload(fileId: string, fileName: string) {
    try {
      const response = await api.get(`/files/${fileId}/download`, {
        responseType: 'blob',
      })
      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      const baseUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '')
      window.open(`${baseUrl}/files/${fileId}/download`, '_blank')
    }
  }

  // Toggle department accordion
  const toggleDeptAccordion = (deptId: string) => {
    setExpandedDeptId((prev) => (prev === deptId ? null : deptId))
  }

  // Filtered operational divisions based strictly on access
  const accessibleDepartments = useMemo(() => {
    if (!overview?.departments) return []
    return overview.departments.filter((dept) => isAdmin || dept.isAssigned)
  }, [overview?.departments, isAdmin])

  // Filtered recent reports
  const filteredRecentReports = useMemo(() => {
    if (!overview?.recentFiles) return []
    return overview.recentFiles.filter((item) => {
      // Exclude files with no spacecraft or associated to "General"
      if (!item.spacecraft || item.spacecraft.toUpperCase() === 'GENERAL' || item.spacecraft.toUpperCase().includes('GENERAL')) {
        return false
      }
      // Spacecraft filter
      if (selectedSpacecraft !== 'ALL') {
        const itemSat = (item.spacecraft || '').toUpperCase()
        const targetSat = selectedSpacecraft.toUpperCase()
        if (!itemSat.includes(targetSat) && !targetSat.includes(itemSat)) {
          return false
        }
      }
      // Category filter
      if (filterCategory !== 'ALL' && item.category !== filterCategory) {
        return false
      }
      // Classification filter
      if (filterClassification !== 'ALL' && item.classification !== filterClassification) {
        return false
      }
      // Date Range filters
      if (filterDateFrom && new Date(item.reportDate) < new Date(filterDateFrom)) {
        return false
      }
      if (filterDateTo && new Date(item.reportDate) > new Date(filterDateTo + 'T23:59:59')) {
        return false
      }
      // Keyword search
      if (searchKeywords.trim()) {
        const query = searchKeywords.toLowerCase()
        const matchTitle = item.title.toLowerCase().includes(query)
        const matchName = item.name.toLowerCase().includes(query)
        const matchAuthor = item.author.toLowerCase().includes(query)
        const matchSat = item.spacecraft.toLowerCase().includes(query)
        const matchDept = item.departmentName.toLowerCase().includes(query)
        if (!matchTitle && !matchName && !matchAuthor && !matchSat && !matchDept) {
          return false
        }
      }
      return true
    })
  }, [
    overview?.recentFiles,
    selectedSpacecraft,
    filterCategory,
    filterClassification,
    filterDateFrom,
    filterDateTo,
    searchKeywords,
  ])

  // Reset Quick Search Filters
  const handleResetFilters = () => {
    setSelectedSpacecraft('ALL')
    setSearchKeywords('')
    setFilterCategory('ALL')
    setFilterClassification('ALL')
    setFilterDateFrom('')
    setFilterDateTo('')
  }

  // Dynamic notice types derived from actual records in overview
  const availableNoticeTypes = useMemo(() => {
    if (!overview?.notices?.length) return []
    const typeSet = new Set<string>()
    overview.notices.forEach((n) => {
      if (n.type) typeSet.add(n.type.toUpperCase())
    })
    return Array.from(typeSet).sort()
  }, [overview?.notices])

  // Filtered notices for modal
  const filteredNotices = useMemo(() => {
    if (!overview?.notices) return []
    if (selectedNoticeType === 'ALL') return overview.notices
    const target = selectedNoticeType.toUpperCase()
    return overview.notices.filter((n) => (n.type || '').toUpperCase() === target)
  }, [overview?.notices, selectedNoticeType])

  // Max spacecraft count for bar chart heights
  const maxSpacecraftCount = useMemo(() => {
    if (!overview?.spacecraftBreakdown?.length) return 1
    return Math.max(1, ...overview.spacecraftBreakdown.map((s) => s.count))
  }, [overview?.spacecraftBreakdown])

  // Real Spacecraft list from breakdown (only active spacecraft with non-archived telemetry)
  const availableSpacecraftList = useMemo(() => {
    const list = new Set<string>()
    overview?.spacecraftBreakdown?.forEach((s) => {
      if (s.spacecraft && s.spacecraft.toUpperCase() !== 'GENERAL' && !s.spacecraft.toUpperCase().includes('GENERAL') && s.count > 0) list.add(s.spacecraft)
    })
    return Array.from(list).sort()
  }, [overview?.spacecraftBreakdown])

  return (
    <div className="w-full space-y-6 pb-20 text-text-primary">
      {/* 1. ADMIN FAST-SWITCH NOTIFICATION BANNER */}
      {isAdmin && (
        <div className="flex flex-col gap-3 rounded-2xl border border-saffron/25 bg-saffron-soft p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-card text-saffron-text">
              <Shield size={18} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-text-primary">
                Administrator Mode Active
              </h4>
              <p className="text-xs text-text-secondary">
                You have elevated privileges across User Approvals, Master Files, Department Permissions, and CMS.
              </p>
            </div>
          </div>

          <Link
            to="/admin"
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-[10px] bg-saffron px-4 text-sm font-bold text-white transition-colors hover:bg-saffron-hover"
          >
            <span>Open Admin Center</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* 2. DASHBOARD TOP HEADER & ACTIVE SPACECRAFT SELECTOR */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-border-subtle pb-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-blue-soft text-accent-light mt-0.5">
            <Radio size={20} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="display text-2xl font-bold leading-tight tracking-tight text-text-primary sm:text-[28px]">
                Mission Reports Repository
              </h1>
            </div>
            <p className="text-xs text-text-secondary mt-0.5 truncate">
              {brandTitle}{brandHighlight} • {brandSubtitle || 'Secure Mission Data Portal'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto">
          <div className="flex min-h-10 items-center justify-between gap-2 rounded-[10px] bg-page-soft px-3 sm:justify-start">
            <span className="shrink-0 text-[13px] font-semibold text-text-muted">
              Filter Spacecraft:
            </span>
            <select
              value={selectedSpacecraft}
              onChange={(e) => setSelectedSpacecraft(e.target.value)}
              className="bg-transparent text-sm font-semibold text-text-primary outline-none cursor-pointer border-0 pr-2 truncate max-w-[180px] sm:max-w-none"
            >
              <option value="ALL" className="bg-card text-text-primary">
                All Spacecraft ({overview?.metrics.totalReports ?? 0})
              </option>
              {availableSpacecraftList.map((sat) => (
                <option key={sat} value={sat} className="bg-card text-text-primary">
                  {sat}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Link
              to="/dashboard/events"
              className="flex-1 sm:flex-initial inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[10px] bg-saffron-soft px-4 text-sm font-semibold text-saffron-text transition-colors hover:bg-saffron-soft-hover"
            >
              <Calendar size={15} />
              <span>Passes & Events</span>
            </Link>

            <Link
              to="/dashboard/files"
              className="flex-1 sm:flex-initial inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[10px] bg-saffron-soft px-4 text-sm font-semibold text-saffron-text transition-colors hover:bg-saffron-soft-hover"
            >
              <HardDrive size={15} />
              <span>Division Files</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 3. TOP 4 EXECUTIVE METRIC CARDS (REAL DATABASE DATA) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-border-subtle bg-card shadow-card flex items-center justify-between p-5">
          <div className="space-y-1">
            <span className="block text-[13px] font-semibold text-text-muted">
              Total Telemetry Files
            </span>
            <p className="num text-[28px] font-bold leading-tight tracking-tight text-text-primary">
              {isLoading ? '—' : overview?.metrics.totalReports.toLocaleString() ?? '0'}
            </p>
            <span className="block text-[13px] text-text-secondary">Active in Repositories</span>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-blue-soft text-accent-light">
            <FileText size={22} strokeWidth={2.2} />
          </div>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-card shadow-card flex items-center justify-between p-5">
          <div className="space-y-1">
            <span className="block text-[13px] font-semibold text-text-muted">
              Today's Uploads
            </span>
            <p className="num text-[28px] font-bold leading-tight tracking-tight text-text-primary">
              {isLoading ? '—' : overview?.metrics.todaysUploads.toLocaleString() ?? '0'}
            </p>
            <span className="block text-[13px] text-text-secondary">
              {new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-blue-soft text-accent-light">
            <CloudUpload size={22} strokeWidth={2.2} />
          </div>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-card shadow-card flex items-center justify-between p-5">
          <div className="space-y-1">
            <span className="block text-[13px] font-semibold text-text-muted">
              Storage Volume
            </span>
            <p className="num text-[28px] font-bold leading-tight tracking-tight text-text-primary">
              {isLoading ? '—' : formatFileSize(overview?.metrics.totalStorageBytes || 0)}
            </p>
            <span className="block text-[13px] text-text-secondary">Physical Disk Storage</span>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-blue-soft text-accent-light">
            <Database size={22} strokeWidth={2.2} />
          </div>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-card shadow-card flex items-center justify-between p-5">
          <div className="space-y-1">
            <span className="block text-[13px] font-semibold text-text-muted">
              Authorized Divisions
            </span>
            <p className="num text-[28px] font-bold leading-tight tracking-tight text-text-primary">
              {isLoading ? '—' : `${accessibleDepartments.length} Cleared`}
            </p>
            <span className="block text-[13px] text-text-secondary">Access Clearance Active</span>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-blue-soft text-accent-light">
            <Building2 size={22} strokeWidth={2.2} />
          </div>
        </div>
      </div>

      {/* 4. VISUAL METRICS CHARTS ROW (REAL DATABASE DISTRIBUTIONS) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Spacecraft Distribution */}
        <div className="rounded-2xl border border-border-subtle bg-card shadow-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border-subtle pb-3 gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 truncate">
                <Radio size={15} className="text-accent-light shrink-0" />
                <span>Reports by Spacecraft</span>
              </h3>
              <p className="text-[11px] text-text-dim truncate">Distribution of telemetry files across spacecraft missions</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="sm:hidden text-[10px] text-text-dim font-mono">Scroll →</span>
              <span className="text-[13px] font-semibold text-text-muted">
                {selectedSpacecraft === 'ALL' ? 'All Missions' : selectedSpacecraft}
              </span>
            </div>
          </div>

          {overview?.spacecraftBreakdown && overview.spacecraftBreakdown.filter((item) => item.count > 0).length > 0 ? (
            <div className="overflow-x-auto pb-2 -mx-2 px-2 scrollbar-none touch-pan-x">
              <div className="h-56 min-w-[480px] sm:min-w-0 flex items-end justify-between gap-3 pt-6 pb-2 px-2 border-b border-border-subtle relative">
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-15">
                  <div className="border-b border-dashed border-border-bright w-full" />
                  <div className="border-b border-dashed border-border-bright w-full" />
                  <div className="border-b border-dashed border-border-bright w-full" />
                  <div className="border-b border-dashed border-border-bright w-full" />
                </div>

                {overview.spacecraftBreakdown.filter((item) => item.count > 0).map((item) => {
                  const heightPercent = Math.max(14, Math.min(100, (item.count / maxSpacecraftCount) * 100))
                  const isSelected =
                    selectedSpacecraft === 'ALL' ||
                    selectedSpacecraft.toUpperCase() === item.spacecraft.toUpperCase()

                  return (
                    <div
                      key={item.spacecraft}
                      onClick={() => setSelectedSpacecraft(item.spacecraft === selectedSpacecraft ? 'ALL' : item.spacecraft)}
                      className={`flex flex-col items-center flex-1 min-w-[48px] sm:min-w-0 h-full justify-end group cursor-pointer transition-all duration-200 ${
                        isSelected ? 'opacity-100' : 'opacity-35 hover:opacity-80'
                      }`}
                    >
                      <span className="num text-[11px] font-bold text-text-primary mb-1.5 transition-transform group-hover:-translate-y-1">
                        {item.count}
                      </span>
                      <div
                        style={{
                          height: `${heightPercent}%`,
                          backgroundColor: item.color,
                        }}
                        className="w-full max-w-[44px] rounded-t-md shadow-md transition-all duration-300 group-hover:brightness-125"
                      />
                      <span className="text-[10px] font-semibold text-text-secondary mt-2 truncate max-w-[62px] text-center" title={item.spacecraft}>
                        {item.spacecraft}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center text-xs text-text-dim">
              No active spacecraft telemetry records found.
            </div>
          )}
        </div>

        {/* Category Breakdown */}
        <div className="rounded-2xl border border-border-subtle bg-card shadow-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <div>
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <Layers size={15} className="text-accent-light" />
                <span>Reports by Category</span>
              </h3>
              <p className="text-[11px] text-text-dim">Operational report classification distribution</p>
            </div>
            <span className="num text-[13px] text-text-muted">100% ingested</span>
          </div>

          {overview?.categoryBreakdown && overview.categoryBreakdown.filter((c) => c.count > 0).length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 items-center pt-2">
              <div className="relative flex items-center justify-center">
                <svg className="w-36 h-36 sm:w-44 sm:h-44 transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="transparent"
                    stroke="currentColor"
                    className="text-border-subtle"
                    strokeWidth="18"
                  />
                  {overview.categoryBreakdown.filter((c) => c.percentage > 0 && c.count > 0).map((cat, idx, activeCats) => {
                    const circumference = 2 * Math.PI * 38 // 238.76
                    const strokeDash = (cat.percentage / 100) * circumference
                    const prevPercentages = activeCats
                      .slice(0, idx)
                      .reduce((acc, curr) => acc + curr.percentage, 0)
                    const offset = -(prevPercentages / 100) * circumference

                    return (
                      <circle
                        key={cat.category}
                        cx="50"
                        cy="50"
                        r="38"
                        fill="transparent"
                        stroke={cat.color}
                        strokeWidth="18"
                        strokeDasharray={`${strokeDash} ${circumference}`}
                        strokeDashoffset={offset}
                      />
                    )
                  })}
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="num text-lg font-black text-text-primary">
                    {overview?.metrics.totalReports ?? 0}
                  </span>
                  <span className="text-[10px] text-text-dim uppercase font-bold">Total Files</span>
                </div>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {overview.categoryBreakdown.filter((c) => c.count > 0).map((cat) => (
                  <div key={cat.category} className="flex items-center justify-between text-xs py-0.5 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="text-text-secondary font-medium truncate">{cat.label}</span>
                    </div>
                    <span className="num font-bold text-text-primary shrink-0 pl-1">{cat.count} ({cat.percentage}%)</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center text-xs text-text-dim">
              No active report categories found.
            </div>
          )}
        </div>
      </div>

      {/* 5. NOTICE BOARD & MISSION BULLETINS (REAL DATABASE NOTIFICATIONS) */}
      <div className="rounded-2xl border border-border-subtle bg-card shadow-card overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 sm:px-5 py-3 sm:py-3.5 border-b border-border-default bg-surface/50 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <BellRing size={16} className="text-accent-light shrink-0" />
            <h3 className="text-sm font-semibold text-text-primary truncate">
              Mission Notice Board & Broadcasts
            </h3>
            <span className="hidden sm:inline-flex num font-bold text-[10px] text-accent-light rounded-full bg-accent/15 border border-accent/30 px-2 py-0.5 shrink-0">
              Live Station Feed
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
            <Link
              to="/notifications"
              className="text-xs font-bold text-accent-light hover:underline flex items-center gap-1"
            >
              <span>Alerts Center</span>
              <ExternalLink size={12} />
            </Link>

            <button
              type="button"
              onClick={() => setShowAllNoticesModal(true)}
              className="text-xs font-bold text-text-secondary hover:text-text-primary flex items-center gap-1 cursor-pointer"
            >
              <span>View All ({overview?.notices?.length || 0})</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-border-subtle">
          {(overview?.notices?.slice(0, 4) || []).map((notice) => {
            const kind = String(notice.type || '').toUpperCase()
            const isCritical = notice.category === 'CRITICAL' || kind === 'EMERGENCY' || kind === 'CRITICAL'
            const isMaint = notice.category === 'MAINTENANCE' || notice.type === 'MAINTENANCE'
            const isPass = notice.type === 'PASS'

            return (
              <div key={notice.id} className="p-3.5 sm:p-4 space-y-2 hover:bg-card-hover transition-colors">
                <div className="flex items-center justify-between">
                  <span
                    className={`rounded-md px-2 py-0.5 text-[11px] font-bold uppercase ${
                      isCritical
                        ? 'bg-critical-bg text-critical'
                        : isMaint
                        ? 'bg-warning-bg text-warning'
                        : isPass
                        ? 'bg-blue-soft text-accent-light'
                        : 'bg-page-soft text-text-secondary'
                    }`}
                  >
                    {String(notice.type || 'NOTICE').replace(/_/g, ' ')}
                  </span>
                  <span className="num text-[10px] text-text-dim">
                    {new Date(notice.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <p className="text-xs font-medium text-text-secondary leading-relaxed line-clamp-3">
                  {notice.message}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* 6. INTERACTIVE DEPARTMENT ACCORDION (FILTERED STRICTLY BY USER ACCESS) */}
      <div className="rounded-2xl border border-border-subtle bg-card shadow-card overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 sm:px-5 py-3.5 sm:py-4 border-b border-border-default bg-surface/50 gap-2">
          <div>
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Building2 size={16} className="text-accent-light" />
              <span>Authorized Operational Divisions ({accessibleDepartments.length} Cleared)</span>
            </h3>
            <p className="text-xs text-text-dim mt-0.5">
              Only operational divisions cleared for your credentials are displayed below. Expand any division to inspect and download files.
            </p>
          </div>

          <Link
            to="/dashboard/files"
            className="text-xs font-bold text-accent-light hover:underline flex items-center gap-1 shrink-0 self-start sm:self-center"
          >
            <span>Open Repositories</span>
            <ExternalLink size={13} />
          </Link>
        </div>

        {accessibleDepartments.length === 0 ? (
          <div className="p-8 text-center space-y-2 bg-surface/20">
            <Building2 size={28} className="mx-auto text-text-dim opacity-50" />
            <p className="text-sm font-bold text-text-primary">No Assigned Operational Divisions</p>
            <p className="text-xs text-text-dim max-w-md mx-auto">
              Your user account has not been assigned to any operational division yet. Please contact your Mission Operations Lead.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {accessibleDepartments.map((dept) => {
              const isExpanded = expandedDeptId === dept.id
              return (
                <div key={dept.id} className="transition-colors">
                  <button
                    type="button"
                    onClick={() => toggleDeptAccordion(dept.id)}
                    className={`w-full flex items-center justify-between p-3.5 sm:p-4 text-left hover:bg-card-hover transition-colors cursor-pointer gap-2 ${
                      isExpanded ? 'bg-surface/80 border-b border-border-subtle' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-blue-soft font-mono text-xs font-bold text-accent-light">
                        {dept.code || 'DIV'}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <span className="text-xs sm:text-sm font-bold text-text-primary truncate max-w-[170px] sm:max-w-none">
                            {dept.name}
                          </span>
                          <span className="flex shrink-0 items-center gap-1 rounded-md bg-nominal-bg px-1.5 py-0.5 text-[11px] font-bold text-nominal">
                            <Check size={10} />
                            <span>Cleared</span>
                          </span>
                          <span className="shrink-0 rounded-md bg-page-soft px-1.5 py-0.5 text-[11px] font-semibold text-text-secondary">
                            {dept.accessLevel === 'READ_WRITE' ? 'READ & WRITE' : 'READ ONLY'}
                          </span>
                        </div>
                        <p className="text-xs text-text-secondary truncate mt-0.5">
                          {dept.description || 'Ground telemetry downlink processing and operational analysis.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 sm:gap-4 shrink-0 pl-2">
                      <div className="hidden sm:flex flex-col items-end">
                        <span className="text-xs font-bold text-text-primary">{dept.leadOfficer}</span>
                        <span className="text-[10px] text-text-dim">{dept.leadRole}</span>
                      </div>

                      <span className="num shrink-0 rounded-full bg-page-soft px-2.5 py-1 text-xs font-semibold text-text-secondary">
                        {dept.fileCount} {dept.fileCount === 1 ? 'file' : 'files'}
                      </span>

                      <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-lg border border-border-default bg-surface flex items-center justify-center text-text-secondary shrink-0">
                        {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="p-4 sm:p-5 bg-page-soft/60 space-y-4 border-b border-border-subtle animate-in fade-in-50 duration-200">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 rounded-xl border border-border-subtle bg-surface/50">
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-text-primary">
                            Division Workspace: <span className="text-accent-light">{dept.name}</span>
                          </p>
                          <p className="text-xs text-text-secondary">
                            Officer in Charge: <strong>{dept.leadOfficer}</strong> ({dept.leadRole}) · Access Verified
                          </p>
                        </div>

                        <Link
                          to={`/dashboard/files/${dept.id}`}
                          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-[10px] bg-saffron px-4 text-sm font-bold text-white transition-colors hover:bg-saffron-hover"
                        >
                          <FolderOpen size={13} />
                          <span>Open Full Division Repository</span>
                        </Link>
                      </div>

                      {dept.files && dept.files.length > 0 ? (
                        <div className="overflow-x-auto rounded-lg border border-border-subtle bg-card touch-pan-x">
                          <table className="w-full text-left border-collapse min-w-[620px]">
                            <thead>
                              <tr className="border-b border-border-subtle bg-surface text-[10px] font-bold text-text-dim uppercase tracking-wider">
                                <th className="px-4 py-2.5">File Name</th>
                                <th className="px-4 py-2.5">Format</th>
                                <th className="px-4 py-2.5">Report Category</th>
                                <th className="px-4 py-2.5">Size</th>
                                <th className="px-4 py-2.5">Date Added</th>
                                <th className="px-4 py-2.5 text-right">Quick Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border-subtle text-xs">
                              {dept.files.map((f) => (
                                <tr key={f.id} className="hover:bg-card-hover transition-colors">
                                  <td className="px-4 py-2.5">
                                    <div className="flex items-center gap-2.5">
                                      <FileIcon nodeType="FILE" mimeType={f.mimeType} size={16} />
                                      <span className="font-bold text-text-primary truncate max-w-xs">{f.name}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <span className="rounded bg-surface border border-border-subtle px-1.5 py-0.5 text-[10px] font-mono text-text-dim uppercase">
                                      {f.extension || 'DAT'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <span className="rounded-md bg-blue-soft px-2 py-0.5 text-[11px] font-semibold text-accent-light">
                                      {categoryLabel(f.category) || 'GENERAL'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2.5 num text-text-dim">
                                    {formatFileSize(Number(f.sizeBytes))}
                                  </td>
                                  <td className="px-4 py-2.5 num text-text-dim">
                                    {formatDateTimeIST(f.createdAt)}
                                  </td>
                                  <td className="px-4 py-2.5 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setPreviewingFile({
                                            id: f.id,
                                            name: f.name,
                                            mimeType: f.mimeType,
                                            sizeBytes: Number(f.sizeBytes),
                                          })
                                        }
                                        className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-lg bg-saffron-soft px-2.5 text-xs font-semibold text-saffron-text transition-colors hover:bg-saffron-soft-hover"
                                      >
                                        <Eye size={12} />
                                        <span>Preview</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleDownload(f.id, f.name)}
                                        className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-lg bg-saffron-soft px-2.5 text-xs font-semibold text-saffron-text transition-colors hover:bg-saffron-soft-hover"
                                      >
                                        <Download size={12} />
                                        <span>Download</span>
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-xs text-text-dim italic p-3 text-center">
                          No active physical files found in this division repository yet.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 7. QUICK SEARCH & FILTER CONTROL PANEL */}
      <div className="rounded-2xl border border-border-subtle bg-card shadow-card p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-border-subtle pb-3">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Search size={14} className="text-accent-light" />
            <span>Search & Filter Telemetry Reports</span>
          </h3>

          <button
            type="button"
            onClick={handleResetFilters}
            className="text-xs text-text-dim hover:text-text-primary flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw size={12} />
            <span>Reset Filters</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-text-muted">Spacecraft</label>
            <select
              value={selectedSpacecraft}
              onChange={(e) => setSelectedSpacecraft(e.target.value)}
              className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-base sm:text-xs text-text-primary outline-none focus:border-accent cursor-pointer"
            >
              <option value="ALL">All Spacecraft</option>
              {availableSpacecraftList.map((sat) => (
                <option key={sat} value={sat}>
                  {sat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-text-muted">Date From</label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-base sm:text-xs text-text-primary outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-text-muted">Date To</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-base sm:text-xs text-text-primary outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-text-muted">Category</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-base sm:text-xs text-text-primary outline-none focus:border-accent cursor-pointer"
            >
              <CategoryOptions onlyActiveWithFiles={true} />
            </select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
          <div className="relative flex-1 w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
            <input
              type="text"
              placeholder="Search by report title, author, spacecraft, or file name…"
              value={searchKeywords}
              onChange={(e) => setSearchKeywords(e.target.value)}
              className="w-full rounded-lg border border-border-default bg-surface pl-9 pr-3 py-2 text-base sm:text-xs text-text-primary placeholder:text-text-dim outline-none focus:border-accent"
            />
          </div>
        </div>
      </div>

      {/* 8. RECENT TELEMETRY REPORTS TABLE (FULL WIDTH HIGH-DENSITY) */}
      <div className="rounded-2xl border border-border-subtle bg-card shadow-card overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 sm:px-5 py-3 sm:py-3.5 border-b border-border-default bg-surface/50 gap-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <FileText size={15} className="text-accent-light shrink-0" />
            <h3 className="text-sm font-semibold text-text-primary truncate">
              Active Telemetry Reports ({selectedSpacecraft === 'ALL' ? 'All Missions' : selectedSpacecraft})
            </h3>
            <span className="num shrink-0 rounded-full bg-page-soft px-2.5 py-0.5 text-xs font-semibold text-text-secondary">
              {filteredRecentReports.length} {filteredRecentReports.length === 1 ? 'file' : 'files'}
            </span>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
            <span className="sm:hidden text-[10px] text-text-dim font-mono">Scroll table →</span>
            <Link
              to="/dashboard/files"
              className="text-xs font-bold text-accent-light hover:underline flex items-center gap-1"
            >
              <span>Browse Full Catalog</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs text-text-dim">
            Loading telemetry records…
          </div>
        ) : filteredRecentReports.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <p className="text-sm font-bold text-text-primary">No Reports Matching Filter</p>
            <p className="text-xs text-text-dim">Try adjusting your active spacecraft or search criteria above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto touch-pan-x">
            <table className="w-full text-left border-collapse min-w-[720px]">
              <thead>
                <tr className="border-b border-border-default bg-surface text-[10px] font-bold text-text-dim uppercase tracking-wider">
                  <th className="px-3 sm:px-4 py-2.5 sm:py-3">Report Title</th>
                  <th className="px-3 sm:px-4 py-2.5 sm:py-3">Spacecraft</th>
                  <th className="px-3 sm:px-4 py-2.5 sm:py-3">Category</th>
                  <th className="px-3 sm:px-4 py-2.5 sm:py-3">Division</th>
                  <th className="px-3 sm:px-4 py-2.5 sm:py-3">Size</th>
                  <th className="px-3 sm:px-4 py-2.5 sm:py-3">Date Added</th>
                  <th className="px-3 sm:px-4 py-2.5 sm:py-3">Author</th>
                  <th className="px-3 sm:px-4 py-2.5 sm:py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-xs">
                {filteredRecentReports.map((file) => (
                  <tr
                    key={file.id}
                    className="hover:bg-card-hover transition-colors group cursor-pointer"
                    onClick={() =>
                      setPreviewingFile({
                        id: file.id,
                        name: file.name,
                        mimeType: file.mimeType,
                        sizeBytes: Number(file.sizeBytes),
                      })
                    }
                  >
                    <td className="px-3 sm:px-4 py-2.5 sm:py-3">
                      <div className="flex items-center gap-2">
                        <FileIcon nodeType="FILE" mimeType={file.mimeType} size={15} />
                        <span className="font-bold text-text-primary truncate max-w-[200px] sm:max-w-[240px]" title={file.title}>
                          {file.title}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 sm:px-4 py-2.5 sm:py-3">
                      <span className="rounded bg-accent/10 border border-accent/30 px-2 py-0.5 text-[10px] font-bold text-accent-light">
                        {file.spacecraft}
                      </span>
                    </td>
                    <td className="px-3 sm:px-4 py-2.5 sm:py-3">
                      <span className="rounded-md bg-blue-soft px-2 py-0.5 text-[11px] font-semibold text-accent-light">
                        {categoryLabel(file.category) || 'GENERAL'}
                      </span>
                    </td>
                    <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-text-dim">
                      {file.departmentCode}
                    </td>
                    <td className="px-3 sm:px-4 py-2.5 sm:py-3 num text-text-dim">
                      {formatFileSize(Number(file.sizeBytes))}
                    </td>
                    <td className="px-3 sm:px-4 py-2.5 sm:py-3 num text-text-dim">
                      {formatDateIST(file.reportDate)} IST
                    </td>
                    <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-text-secondary truncate max-w-[100px] sm:max-w-[120px]">
                      {file.author}
                    </td>
                    <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewingFile({
                              id: file.id,
                              name: file.name,
                              mimeType: file.mimeType,
                              sizeBytes: Number(file.sizeBytes),
                            })
                          }
                          className="p-1 rounded text-text-dim hover:text-accent-light hover:bg-surface cursor-pointer"
                          title="Preview Report"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownload(file.id, file.name)}
                          className="p-1 rounded text-text-dim hover:text-nominal hover:bg-surface cursor-pointer"
                          title="Download File"
                        >
                          <Download size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* NOTICES MODAL */}
      <Modal
        isOpen={showAllNoticesModal}
        onClose={() => setShowAllNoticesModal(false)}
        title="Mission Operations Notice Board & Bulletins"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-border-subtle pb-3">
            <span className="text-xs text-text-secondary">Filter announcements and upcoming passes:</span>
            <select
              value={selectedNoticeType}
              onChange={(e) => setSelectedNoticeType(e.target.value)}
              className="rounded-lg border border-border-default bg-card px-2.5 py-1 text-xs text-text-primary outline-none focus:border-accent cursor-pointer"
            >
              <option value="ALL">All Types ({overview?.notices?.length || 0})</option>
              {availableNoticeTypes.map((type) => {
                const count = overview?.notices?.filter(
                  (n) => (n.type || '').toUpperCase() === type
                ).length || 0
                return (
                  <option key={type} value={type}>
                    {getNoticeTypeLabel(type)} ({count})
                  </option>
                )
              })}
            </select>
          </div>
          <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
            {filteredNotices.map((notice) => (
              <div key={notice.id} className="p-3.5 rounded-xl border border-border-default bg-surface/50 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="rounded-md bg-blue-soft px-2 py-0.5 text-[11px] font-semibold text-accent-light">
                    {String(notice.type || 'NOTICE').replace(/_/g, ' ')}
                  </span>
                  <span className="num text-[11px] text-text-dim">
                    {new Date(notice.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {notice.message}
                </p>
              </div>
            ))}
          </div>
          <div className="pt-2 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowAllNoticesModal(false)}>
              <span>Close Notice Board</span>
            </Button>
          </div>
        </div>
      </Modal>

      {/* 1-CLICK FILE PREVIEW MODAL */}
      <FilePreviewModal
        file={previewingFile}
        onClose={() => setPreviewingFile(null)}
      />
    </div>
  )
}
