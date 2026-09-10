import { useState, useMemo } from 'react'
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
      window.open(`${import.meta.env.VITE_API_URL}/files/${fileId}/download`, '_blank')
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

  // Filtered notices for modal
  const filteredNotices = useMemo(() => {
    if (!overview?.notices) return []
    if (selectedNoticeType === 'ALL') return overview.notices
    return overview.notices.filter((n) => n.type === selectedNoticeType)
  }, [overview?.notices, selectedNoticeType])

  // Max spacecraft count for bar chart heights
  const maxSpacecraftCount = useMemo(() => {
    if (!overview?.spacecraftBreakdown?.length) return 1
    return Math.max(1, ...overview.spacecraftBreakdown.map((s) => s.count))
  }, [overview?.spacecraftBreakdown])

  // Real Spacecraft list from breakdown
  const availableSpacecraftList = useMemo(() => {
    const list = new Set<string>()
    overview?.spacecraftBreakdown?.forEach((s) => {
      if (s.spacecraft && s.spacecraft !== 'General') list.add(s.spacecraft)
    })
    return Array.from(list)
  }, [overview?.spacecraftBreakdown])

  return (
    <div className="w-full space-y-6 pb-20 text-text-primary">
      {/* 1. ADMIN FAST-SWITCH NOTIFICATION BANNER */}
      {isAdmin && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-accent/40 bg-gradient-to-r from-accent/15 via-[#0b1730] to-accent/15 p-4 shadow-md">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-accent-light border border-accent/30">
              <Shield size={18} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Administrator Mode Active
              </h4>
              <p className="text-xs text-text-secondary">
                You have elevated privileges across User Approvals, Master Files, Department Permissions, and CMS.
              </p>
            </div>
          </div>

          <Link
            to="/admin"
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white shadow-lg shadow-accent/25 hover:bg-accent-light transition-all shrink-0"
          >
            <span>Open Admin Center</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* 2. DASHBOARD TOP HEADER & ACTIVE SPACECRAFT SELECTOR */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-border-subtle pb-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-accent/40 bg-accent/10 text-accent-light shadow-inner mt-0.5">
            <Radio size={22} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Mission Reports Repository
              </h1>
              <span className="rounded-full bg-nominal/15 border border-nominal/30 px-2.5 py-0.5 text-[10px] font-bold text-nominal uppercase">
                Live Station Telemetry
              </span>
            </div>
            <p className="text-xs text-text-secondary mt-0.5">
              {brandTitle}{brandHighlight} • {brandSubtitle || 'Secure Mission Data Portal'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-border-default bg-card px-3 py-1.5 shadow-sm">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-dim">
              Filter Spacecraft:
            </span>
            <select
              value={selectedSpacecraft}
              onChange={(e) => setSelectedSpacecraft(e.target.value)}
              className="bg-transparent text-xs font-bold text-accent-light outline-none cursor-pointer border-0 pr-2"
            >
              <option value="ALL" className="bg-[#060c18] text-white">
                All Spacecraft ({overview?.metrics.totalReports ?? 0})
              </option>
              {availableSpacecraftList.map((sat) => (
                <option key={sat} value={sat} className="bg-[#060c18] text-white">
                  {sat}
                </option>
              ))}
            </select>
          </div>

          <Link
            to="/dashboard/events"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-[#080f1d] px-3.5 py-2 text-xs font-bold text-white hover:border-accent transition-all shadow-sm"
          >
            <Calendar size={14} className="text-accent-light" />
            <span>Passes & Events</span>
          </Link>

          <Link
            to="/dashboard/files"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-[#080f1d] px-3.5 py-2 text-xs font-bold text-white hover:border-accent transition-all shadow-sm"
          >
            <HardDrive size={14} className="text-nominal" />
            <span>Division Files</span>
          </Link>
        </div>
      </div>

      {/* 3. TOP 4 EXECUTIVE METRIC CARDS (REAL DATABASE DATA) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border-default bg-card p-4 shadow-sm hover:border-accent/40 transition-all flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-dim block">
              Total Telemetry Files
            </span>
            <p className="num text-2xl font-black text-white">
              {isLoading ? '—' : overview?.metrics.totalReports.toLocaleString() ?? '0'}
            </p>
            <span className="text-[11px] text-text-secondary block">Active in Repositories</span>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/15 border border-accent/30 text-accent-light">
            <FileText size={22} strokeWidth={2.2} />
          </div>
        </div>

        <div className="rounded-xl border border-border-default bg-card p-4 shadow-sm hover:border-nominal/40 transition-all flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-dim block">
              Today's Uploads
            </span>
            <p className="num text-2xl font-black text-nominal">
              {isLoading ? '—' : overview?.metrics.todaysUploads.toLocaleString() ?? '0'}
            </p>
            <span className="text-[11px] text-text-secondary block">
              {new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-nominal/15 border border-nominal/30 text-nominal">
            <CloudUpload size={22} strokeWidth={2.2} />
          </div>
        </div>

        <div className="rounded-xl border border-border-default bg-card p-4 shadow-sm hover:border-purple-500/40 transition-all flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-dim block">
              Storage Volume
            </span>
            <p className="num text-2xl font-black text-purple-400">
              {isLoading ? '—' : formatFileSize(overview?.metrics.totalStorageBytes || 0)}
            </p>
            <span className="text-[11px] text-text-secondary block">Physical Disk Storage</span>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400">
            <Database size={22} strokeWidth={2.2} />
          </div>
        </div>

        <div className="rounded-xl border border-border-default bg-card p-4 shadow-sm hover:border-accent-light/40 transition-all flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-dim block">
              Authorized Divisions
            </span>
            <p className="num text-2xl font-black text-white">
              {isLoading ? '—' : `${accessibleDepartments.length} Cleared`}
            </p>
            <span className="text-[11px] text-text-secondary block">Access Clearance Active</span>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0066FF]/15 border border-[#0066FF]/30 text-[#0066FF]">
            <Building2 size={22} strokeWidth={2.2} />
          </div>
        </div>
      </div>

      {/* 4. VISUAL METRICS CHARTS ROW (REAL DATABASE DISTRIBUTIONS) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Spacecraft Distribution */}
        <div className="rounded-xl border border-border-default bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Radio size={15} className="text-accent-light" />
                <span>Reports by Spacecraft</span>
              </h3>
              <p className="text-[11px] text-text-dim">Distribution of telemetry files across spacecraft missions</p>
            </div>
            <span className="text-xs font-mono text-accent-light font-bold">
              {selectedSpacecraft === 'ALL' ? 'All Missions' : selectedSpacecraft}
            </span>
          </div>

          {overview?.spacecraftBreakdown && overview.spacecraftBreakdown.length > 0 ? (
            <div className="h-56 flex items-end justify-between gap-3 pt-6 pb-2 px-2 border-b border-border-subtle relative">
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-15">
                <div className="border-b border-dashed border-white w-full" />
                <div className="border-b border-dashed border-white w-full" />
                <div className="border-b border-dashed border-white w-full" />
                <div className="border-b border-dashed border-white w-full" />
              </div>

              {overview.spacecraftBreakdown.map((item) => {
                const heightPercent = Math.max(14, Math.min(100, (item.count / maxSpacecraftCount) * 100))
                const isSelected =
                  selectedSpacecraft === 'ALL' ||
                  selectedSpacecraft.toUpperCase() === item.spacecraft.toUpperCase()

                return (
                  <div
                    key={item.spacecraft}
                    onClick={() => setSelectedSpacecraft(item.spacecraft === selectedSpacecraft ? 'ALL' : item.spacecraft)}
                    className={`flex flex-col items-center flex-1 h-full justify-end group cursor-pointer transition-all duration-200 ${
                      isSelected ? 'opacity-100' : 'opacity-35 hover:opacity-80'
                    }`}
                  >
                    <span className="num text-[11px] font-bold text-white mb-1.5 transition-transform group-hover:-translate-y-1">
                      {item.count}
                    </span>
                    <div
                      style={{
                        height: `${heightPercent}%`,
                        backgroundColor: item.color,
                      }}
                      className="w-full max-w-[48px] rounded-t-md shadow-lg transition-all duration-300 group-hover:brightness-125"
                    />
                    <span className="text-[10px] font-semibold text-text-secondary mt-2 truncate max-w-[65px] text-center" title={item.spacecraft}>
                      {item.spacecraft}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center text-xs text-text-dim">
              No spacecraft telemetry records found.
            </div>
          )}
        </div>

        {/* Category Breakdown */}
        <div className="rounded-xl border border-border-default bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Layers size={15} className="text-nominal" />
                <span>Reports by Category</span>
              </h3>
              <p className="text-[11px] text-text-dim">Operational report classification distribution</p>
            </div>
            <span className="num text-xs text-nominal font-bold">100% Ingested</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center pt-2">
            <div className="relative flex items-center justify-center">
              <svg className="w-44 h-44 transform -rotate-90" viewBox="0 0 100 100">
                {overview?.categoryBreakdown?.map((cat, idx) => {
                  const circumference = 2 * Math.PI * 38 // 238.76
                  const strokeDash = (cat.percentage / 100) * circumference
                  const prevPercentages = overview.categoryBreakdown
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
                <span className="num text-lg font-black text-white">
                  {overview?.metrics.totalReports ?? 0}
                </span>
                <span className="text-[10px] text-text-dim uppercase font-bold">Total Files</span>
              </div>
            </div>

            <div className="space-y-2">
              {(overview?.categoryBreakdown || []).map((cat) => (
                <div key={cat.category} className="flex items-center justify-between text-xs py-0.5">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="text-text-secondary font-medium">{cat.label}</span>
                  </div>
                  <span className="num font-bold text-white">{cat.count} files ({cat.percentage}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 5. NOTICE BOARD & MISSION BULLETINS (REAL DATABASE NOTIFICATIONS) */}
      <div className="rounded-xl border border-border-default bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-default bg-surface/50">
          <div className="flex items-center gap-2">
            <BellRing size={16} className="text-accent-light animate-bounce" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary">
              Mission Notice Board & Broadcasts
            </h3>
            <span className="num font-bold text-[10px] text-accent-light rounded-full bg-accent/15 border border-accent/30 px-2 py-0.5">
              Live Station Feed
            </span>
          </div>

          <div className="flex items-center gap-3">
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
              className="text-xs font-bold text-text-secondary hover:text-white flex items-center gap-1 cursor-pointer"
            >
              <span>View All ({overview?.notices?.length || 0})</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-border-subtle">
          {(overview?.notices?.slice(0, 4) || []).map((notice) => {
            const isCritical = notice.category === 'CRITICAL' || notice.type === 'EMERGENCY'
            const isMaint = notice.category === 'MAINTENANCE' || notice.type === 'MAINTENANCE'
            const isPass = notice.type === 'PASS'

            return (
              <div key={notice.id} className="p-4 space-y-2 hover:bg-card-hover transition-colors">
                <div className="flex items-center justify-between">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                      isCritical
                        ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                        : isMaint
                        ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30'
                        : isPass
                        ? 'bg-accent/15 text-accent-light border border-accent/30'
                        : 'bg-nominal/15 text-nominal border border-nominal/30'
                    }`}
                  >
                    {notice.type}
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
      <div className="rounded-xl border border-border-default bg-card shadow-sm overflow-hidden space-y-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-5 py-4 border-b border-border-default bg-surface/50 gap-2">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary flex items-center gap-2">
              <Building2 size={16} className="text-accent-light" />
              <span>Authorized Operational Divisions ({accessibleDepartments.length} Cleared)</span>
            </h3>
            <p className="text-xs text-text-dim mt-0.5">
              Only operational divisions cleared for your credentials are displayed below. Expand any division to inspect and download files.
            </p>
          </div>

          <Link
            to="/dashboard/files"
            className="text-xs font-bold text-accent-light hover:underline flex items-center gap-1 shrink-0"
          >
            <span>Open Repositories</span>
            <ExternalLink size={13} />
          </Link>
        </div>

        {accessibleDepartments.length === 0 ? (
          <div className="p-8 text-center space-y-2 bg-surface/20">
            <Building2 size={28} className="mx-auto text-text-dim opacity-50" />
            <p className="text-sm font-bold text-white">No Assigned Operational Divisions</p>
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
                    className={`w-full flex items-center justify-between p-4 text-left hover:bg-card-hover transition-colors cursor-pointer ${
                      isExpanded ? 'bg-surface/80 border-b border-border-subtle' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/30 bg-accent/10 text-accent-light font-bold text-xs num">
                        {dept.code || 'DIV'}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-white truncate">
                            {dept.name}
                          </span>
                          <span className="rounded bg-nominal/15 border border-nominal/30 px-2 py-0.5 text-[10px] font-bold text-nominal uppercase flex items-center gap-1">
                            <Check size={10} />
                            <span>Cleared Access</span>
                          </span>
                          <span className="rounded bg-surface border border-border-subtle px-2 py-0.5 text-[10px] text-text-dim">
                            {dept.accessLevel === 'READ_WRITE' ? 'READ & WRITE' : 'READ ONLY'}
                          </span>
                        </div>
                        <p className="text-xs text-text-secondary truncate mt-0.5">
                          {dept.description || 'Ground telemetry downlink processing and operational analysis.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 pl-3">
                      <div className="hidden sm:flex flex-col items-end">
                        <span className="text-xs font-bold text-white">{dept.leadOfficer}</span>
                        <span className="text-[10px] text-text-dim">{dept.leadRole}</span>
                      </div>

                      <span className="num font-bold text-xs text-accent-light rounded-full bg-accent/15 border border-accent/30 px-2.5 py-1">
                        {dept.fileCount} Files
                      </span>

                      <div className="h-7 w-7 rounded-lg border border-border-default bg-surface flex items-center justify-center text-text-secondary">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="p-5 bg-[#060c18] space-y-4 border-b border-border-subtle animate-in fade-in-50 duration-200">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 rounded-xl border border-border-subtle bg-surface/50">
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-white">
                            Division Workspace: <span className="text-accent-light">{dept.name}</span>
                          </p>
                          <p className="text-xs text-text-secondary">
                            Officer in Charge: <strong>{dept.leadOfficer}</strong> ({dept.leadRole}) · Access Verified
                          </p>
                        </div>

                        <Link
                          to={`/dashboard/files/${dept.id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-accent-light transition-all shrink-0"
                        >
                          <FolderOpen size={13} />
                          <span>Open Full Division Repository</span>
                        </Link>
                      </div>

                      {dept.files && dept.files.length > 0 ? (
                        <div className="overflow-x-auto rounded-lg border border-border-subtle bg-card">
                          <table className="w-full text-left border-collapse min-w-[650px]">
                            <thead>
                              <tr className="border-b border-border-subtle bg-surface text-[10px] font-bold text-text-dim uppercase tracking-wider">
                                <th className="px-4 py-2.5">File Name</th>
                                <th className="px-4 py-2.5">Format</th>
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
                                      <span className="font-bold text-white truncate max-w-xs">{f.name}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <span className="rounded bg-surface border border-border-subtle px-1.5 py-0.5 text-[10px] font-mono text-text-dim uppercase">
                                      {f.extension || 'DAT'}
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
                                        className="inline-flex items-center gap-1 rounded border border-border-default bg-surface px-2 py-1 text-[11px] font-bold text-accent-light hover:border-accent cursor-pointer"
                                      >
                                        <Eye size={12} />
                                        <span>Preview</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleDownload(f.id, f.name)}
                                        className="inline-flex items-center gap-1 rounded border border-border-default bg-surface px-2 py-1 text-[11px] font-bold text-nominal hover:border-nominal cursor-pointer"
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
      <div className="rounded-xl border border-border-default bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border-subtle pb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-2">
            <Search size={14} className="text-accent-light" />
            <span>Search & Filter Telemetry Reports</span>
          </h3>

          <button
            type="button"
            onClick={handleResetFilters}
            className="text-xs text-text-dim hover:text-white flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw size={12} />
            <span>Reset Filters</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-text-dim uppercase mb-1">Spacecraft</label>
            <select
              value={selectedSpacecraft}
              onChange={(e) => setSelectedSpacecraft(e.target.value)}
              className="w-full rounded-lg border border-border-default bg-[#060c18] px-3 py-2 text-xs text-white outline-none focus:border-accent cursor-pointer"
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
            <label className="block text-[11px] font-bold text-text-dim uppercase mb-1">Date From</label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="w-full rounded-lg border border-border-default bg-[#060c18] px-3 py-2 text-xs text-white outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-text-dim uppercase mb-1">Date To</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="w-full rounded-lg border border-border-default bg-[#060c18] px-3 py-2 text-xs text-white outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-text-dim uppercase mb-1">Category</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full rounded-lg border border-border-default bg-[#060c18] px-3 py-2 text-xs text-white outline-none focus:border-accent cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              <option value="DAILY_REPORT">Daily Operations</option>
              <option value="ANOMALY">Anomaly Report</option>
              <option value="HEALTH">Subsystem Health</option>
              <option value="EVENT">Flight Event</option>
              <option value="PAYLOAD">Payload Science</option>
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
              className="w-full rounded-lg border border-border-default bg-[#060c18] pl-9 pr-3 py-2 text-xs text-white placeholder:text-text-dim outline-none focus:border-accent"
            />
          </div>
        </div>
      </div>

      {/* 8. RECENT TELEMETRY REPORTS TABLE (FULL WIDTH HIGH-DENSITY) */}
      <div className="rounded-xl border border-border-default bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-default bg-surface/50">
          <div className="flex items-center gap-2">
            <FileText size={15} className="text-accent-light" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary">
              Active Telemetry Reports ({selectedSpacecraft === 'ALL' ? 'All Missions' : selectedSpacecraft})
            </h3>
            <span className="num font-bold text-xs text-accent-light rounded-full bg-accent/15 border border-accent/30 px-2 py-0.5">
              {filteredRecentReports.length} Files
            </span>
          </div>

          <Link
            to="/dashboard/files"
            className="text-xs font-bold text-accent-light hover:underline flex items-center gap-1"
          >
            <span>Browse Full Catalog</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs text-text-dim">
            Loading telemetry records…
          </div>
        ) : filteredRecentReports.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <p className="text-sm font-bold text-white">No Reports Matching Filter</p>
            <p className="text-xs text-text-dim">Try adjusting your active spacecraft or search criteria above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead>
                <tr className="border-b border-border-default bg-surface text-[10px] font-bold text-text-dim uppercase tracking-wider">
                  <th className="px-4 py-3">Report Title</th>
                  <th className="px-4 py-3">Spacecraft</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Division</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3">Date Added</th>
                  <th className="px-4 py-3">Author</th>
                  <th className="px-4 py-3 text-right">Actions</th>
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
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileIcon nodeType="FILE" mimeType={file.mimeType} size={16} />
                        <span className="font-bold text-white truncate max-w-[240px]" title={file.title}>
                          {file.title}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-accent/10 border border-accent/30 px-2 py-0.5 text-[10px] font-bold text-accent-light">
                        {file.spacecraft}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-surface border border-border-subtle px-2 py-0.5 text-[10px] text-text-secondary">
                        {file.category.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-dim">
                      {file.departmentCode}
                    </td>
                    <td className="px-4 py-3 num text-text-dim">
                      {formatFileSize(Number(file.sizeBytes))}
                    </td>
                    <td className="px-4 py-3 num text-text-dim">
                      {formatDateIST(file.reportDate)} IST
                    </td>
                    <td className="px-4 py-3 text-text-secondary truncate max-w-[120px]">
                      {file.author}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
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
              className="rounded-lg border border-border-default bg-[#060c18] px-2.5 py-1 text-xs text-white outline-none focus:border-accent cursor-pointer"
            >
              <option value="ALL">All Types</option>
              <option value="PASS">Satellite Passes</option>
              <option value="SYSTEM">System Alerts</option>
              <option value="BROADCAST">Broadcasts</option>
              <option value="MAINTENANCE">Maintenance</option>
            </select>
          </div>
          <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
            {filteredNotices.map((notice) => (
              <div key={notice.id} className="p-3.5 rounded-xl border border-border-default bg-surface/50 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="rounded bg-accent/15 border border-accent/30 px-2 py-0.5 text-[10px] font-bold text-accent-light uppercase">
                    {notice.type}
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
