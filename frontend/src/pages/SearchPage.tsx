import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import {
  Search as SearchIcon,
  History,
  X,
  FolderArchive,
  Download,
  Eye,
  RotateCcw,
  LayoutGrid,
  List,
  Sparkles,
  ExternalLink,
  Database,
  Filter,
  ShieldAlert,
  Lock,
  Building2,
  ArrowRight,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { browseApi, type SearchResultItem } from '../api/browse.api'
import { satellitesApi, type Satellite } from '../api/satellites.api'
import { departmentsApi, type Department } from '../api/departments.api'
import { useSearchHistoryStore } from '../store/searchHistoryStore'
import { FileIcon } from '../components/FileIcon'
import { formatFileSize } from '../lib/formatFileSize'
import { PageHeader, Button } from '../components'
import { FilePreviewModal } from '../components/FilePreviewModal'
import { apiClient } from '../api/client'

export function SearchPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // Primary Query & Facet Filter States
  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [satelliteFilter, setSatelliteFilter] = useState(searchParams.get('satelliteId') ?? 'ALL')
  const [departmentFilter, setDepartmentFilter] = useState(searchParams.get('departmentId') ?? 'ALL')
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') ?? 'ALL')
  const [extensionFilter, setExtensionFilter] = useState(searchParams.get('ext') ?? 'ALL')
  const [classificationFilter, setClassificationFilter] = useState(searchParams.get('class') ?? 'ALL')
  const [datePreset, setDatePreset] = useState(searchParams.get('date') ?? 'ALL')
  const [sortBy, setSortBy] = useState<'updatedAt' | 'createdAt' | 'name' | 'sizeBytes'>('updatedAt')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')

  // UI States
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [showHistory, setShowHistory] = useState(false)
  const [showFilters, setShowFilters] = useState(true)
  const [previewFile, setPreviewFile] = useState<any | null>(null)

  // Data States
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [totalMatches, setTotalMatches] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMeta, setLoadingMeta] = useState(true)
  const [satellites, setSatellites] = useState<Satellite[]>([])
  const [departments, setDepartments] = useState<Department[]>([])

  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'ADMIN'

  const { history, addSearch, clearHistory } = useSearchHistoryStore()

  // Fetch Satellites & Departments for dropdown filters
  useEffect(() => {
    async function loadMeta() {
      setLoadingMeta(true)
      try {
        const [sats, depts] = await Promise.all([
          satellitesApi.getActiveSatellites().catch(() => []),
          isAdmin
            ? departmentsApi.getPublicDepartments().catch(() => [])
            : departmentsApi.getUserDepartments().catch(() => []),
        ])
        setSatellites(sats || [])
        setDepartments(depts || [])
      } catch {
        // silent fallback
      } finally {
        setLoadingMeta(false)
      }
    }
    loadMeta()
  }, [isAdmin])

  const hasNoDeptAccess = !isAdmin && user && !loadingMeta && departments.length === 0

  // Execute Search whenever query or filters change
  useEffect(() => {
    if (hasNoDeptAccess) return
    let active = true

    async function executeSearch() {
      setLoading(true)
      try {
        // Calculate date boundaries if preset selected
        let startDate: string | undefined
        const now = new Date()
        if (datePreset === 'TODAY') {
          const d = new Date()
          d.setHours(0, 0, 0, 0)
          startDate = d.toISOString()
        } else if (datePreset === '7D') {
          startDate = new Date(now.getTime() - 7 * 86400000).toISOString()
        } else if (datePreset === '30D') {
          startDate = new Date(now.getTime() - 30 * 86400000).toISOString()
        } else if (datePreset === '90D') {
          startDate = new Date(now.getTime() - 90 * 86400000).toISOString()
        } else if (datePreset === '1Y') {
          startDate = new Date(now.getTime() - 365 * 86400000).toISOString()
        }

        const res = await browseApi.search({
          q: query.trim(),
          satelliteId: satelliteFilter !== 'ALL' ? satelliteFilter : undefined,
          departmentId: departmentFilter !== 'ALL' ? departmentFilter : undefined,
          category: categoryFilter !== 'ALL' ? categoryFilter : undefined,
          extension: extensionFilter !== 'ALL' ? extensionFilter : undefined,
          classificationLevel: classificationFilter !== 'ALL' ? classificationFilter : undefined,
          startDate,
          sortBy,
          sortOrder,
          page: 1,
          limit: 100,
        })

        if (active) {
          setResults(res.data || [])
          setTotalMatches(res.total || 0)
        }
      } catch (err) {
        console.error('Search failed:', err)
        if (active) setResults([])
      } finally {
        if (active) setLoading(false)
      }
    }

    const timer = setTimeout(executeSearch, 250)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [
    query,
    satelliteFilter,
    departmentFilter,
    categoryFilter,
    extensionFilter,
    classificationFilter,
    datePreset,
    sortBy,
    sortOrder,
  ])

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (query.trim()) {
      addSearch(query.trim())
    }
    setShowHistory(false)
  }

  function resetAllFilters() {
    setQuery('')
    setSatelliteFilter('ALL')
    setDepartmentFilter('ALL')
    setCategoryFilter('ALL')
    setExtensionFilter('ALL')
    setClassificationFilter('ALL')
    setDatePreset('ALL')
    setSortBy('updatedAt')
    setSortOrder('desc')
  }

  const hasActiveFilters =
    query.trim() !== '' ||
    satelliteFilter !== 'ALL' ||
    departmentFilter !== 'ALL' ||
    categoryFilter !== 'ALL' ||
    extensionFilter !== 'ALL' ||
    classificationFilter !== 'ALL' ||
    datePreset !== 'ALL'

  // Calculate total volume stored
  const totalVolumeBytes = useMemo(() => {
    return results.reduce((acc, curr) => acc + (Number(curr.sizeBytes) || 0), 0)
  }, [results])

  const handleDownload = async (file: SearchResultItem, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const response = await apiClient.get(`/files/${file.id}/download`, { responseType: 'blob' })
      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.download = file.name
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download failed:', err)
    }
  }

  return (
    <div className="w-full space-y-6 pb-20 text-text-primary">
      {/* Header */}
      <PageHeader
        eyebrow="Archival Intelligence & Discovery"
        title="Search Mission Repositories"
        description="Full-text and faceted search across all satellite missions, operational telemetry datasets, and flight reports."
        meta={
          <div className="flex items-center gap-2 pt-1">
            <span className="rounded bg-accent/15 border border-accent/30 px-2 py-0.5 text-[10px] font-bold uppercase num text-accent-light flex items-center gap-1.5 font-mono">
              <Database size={11} />
              <span>{totalMatches} Records Ingested</span>
            </span>
            <span className="num text-xs text-text-dim font-mono">
              · {formatFileSize(totalVolumeBytes)} Total Matched Volume
            </span>
          </div>
        }
      />

      {/* No Clearance State for Members */}
      {hasNoDeptAccess ? (
        <div className="rounded-2xl border border-amber-500/40 bg-[#070e1c] p-8 sm:p-12 text-center shadow-2xl max-w-xl mx-auto space-y-5 my-8">
          <div className="h-16 w-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 shadow-inner">
            <ShieldAlert size={32} />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-0.5 text-[11px] font-mono font-bold text-amber-300 uppercase">
              <Lock size={11} />
              Access Restricted
            </div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              No Division Security Clearances Assigned
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed max-w-md mx-auto">
              Under ISRO operational security protocols, all mission archives, flight telemetry, and documents are strictly compartmentalized by division. Your member account currently has no active department clearances assigned.
            </p>
          </div>

          <div className="rounded-xl border border-border-default bg-[#050b16] p-4 text-left space-y-2.5 text-xs">
            <p className="text-text-primary font-bold flex items-center gap-1.5">
              <span>Next Steps to Unlock Archives:</span>
            </p>
            <div className="space-y-2 text-text-dim text-[11px] leading-relaxed">
              <div className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <p>Contact your Division Lead Officer or MOX Flight Director for operational clearance.</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <p>A System Administrator can assign your clearances under User Accounts & Approvals.</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">•</span>
                <p>Once granted, your assigned division repositories will immediately unlock here.</p>
              </div>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/departments" className="w-full sm:w-auto">
              <Button variant="outline" size="sm" className="w-full text-xs font-bold">
                <Building2 size={13} />
                <span>View Public Divisions</span>
              </Button>
            </Link>
            <Link to="/dashboard" className="w-full sm:w-auto">
              <Button variant="primary" size="sm" className="w-full text-xs font-bold">
                <span>Go to Mission Overview</span>
                <ArrowRight size={13} />
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* ============================================================ */}
          {/* 1. HERO SEARCH BAR & PRESET CHIPS */}
          {/* ============================================================ */}
      <div className="space-y-3">
        <form onSubmit={handleSearchSubmit} className="group relative">
          <div className="relative flex items-center">
            <SearchIcon
              size={18}
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 text-text-dim transition-colors group-focus-within:text-accent-light"
            />

            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setShowHistory(true)}
              onBlur={() => setTimeout(() => setShowHistory(false), 200)}
              placeholder="Search reports, telemetry files, spacecraft, authors, or categories…"
              aria-label="Search query"
              className="w-full rounded-xl border border-border-default bg-[#081226] py-3.5 pr-10 pl-11 text-sm text-white shadow-inner outline-none transition-all placeholder:text-text-dim hover:border-accent/40 focus:border-accent focus:bg-[#0c1a36]"
            />

            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3.5 p-1 rounded-md text-text-dim hover:text-white hover:bg-card-hover"
                title="Clear search query"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Search History Dropdown */}
          {showHistory && history.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-30 mt-2 max-h-60 overflow-y-auto rounded-xl border border-border-default bg-card shadow-2xl">
              <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2">
                <span className="text-[11px] font-bold text-text-dim uppercase tracking-wider">Recent Searches</span>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    clearHistory()
                  }}
                  className="text-[10px] text-text-dim hover:text-red-400 font-bold"
                >
                  Clear History
                </button>
              </div>

              {history.slice(0, 8).map((h) => (
                <button
                  key={h}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    setQuery(h)
                    setShowHistory(false)
                  }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left transition-colors hover:bg-card-hover"
                >
                  <History size={13} className="shrink-0 text-text-dim" />
                  <span className="truncate text-xs text-text-secondary">{h}</span>
                </button>
              ))}
            </div>
          )}
        </form>

        {/* Dynamic Spacecraft Quick Filter Chips from Real DB */}
        {satellites.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase text-text-dim shrink-0 flex items-center gap-1">
              <Sparkles size={12} className="text-accent-light" />
              <span>Spacecraft:</span>
            </span>
            {satellites.map((sat) => (
              <button
                key={sat.id}
                type="button"
                onClick={() => setSatelliteFilter(satelliteFilter === sat.id ? 'ALL' : sat.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  satelliteFilter === sat.id
                    ? 'bg-accent text-white border-accent shadow-sm'
                    : 'bg-surface border-border-default hover:border-accent/40 hover:text-accent-light text-text-secondary'
                }`}
              >
                🛰️ {sat.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 2. MULTI-FACET FILTER PANEL */}
      {/* ============================================================ */}
      <div className="rounded-xl border border-border-default bg-card p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-accent-light" />
            <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">
              Multi-Facet Archive Filters
            </span>
          </div>

          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="text-[11px] font-bold text-accent-light hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw size={11} />
                <span>Reset Filters</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="text-[11px] font-bold text-text-dim hover:text-white px-2 py-0.5 rounded border border-border-subtle"
            >
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-1 border-t border-border-subtle/60">
            {/* Spacecraft Filter */}
            <div>
              <label className="block text-[10px] font-bold uppercase text-text-dim mb-1">Spacecraft</label>
              <select
                value={satelliteFilter}
                onChange={(e) => setSatelliteFilter(e.target.value)}
                className="w-full rounded-lg border border-border-default bg-[#060c18] px-2.5 py-1.5 text-xs text-white outline-none focus:border-accent cursor-pointer"
              >
                <option value="ALL">All Spacecraft</option>
                {satellites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Division Filter */}
            <div>
              <label className="block text-[10px] font-bold uppercase text-text-dim mb-1">Division / Dept</label>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-full rounded-lg border border-border-default bg-[#060c18] px-2.5 py-1.5 text-xs text-white outline-none focus:border-accent cursor-pointer"
              >
                <option value="ALL">All Divisions</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} {d.code ? `(${d.code})` : ''}
                    {d.archived || !d.isActive ? ' ⚠️ (Archived - Admin Only)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Report Category Filter */}
            <div>
              <label className="block text-[10px] font-bold uppercase text-text-dim mb-1">Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full rounded-lg border border-border-default bg-[#060c18] px-2.5 py-1.5 text-xs text-white outline-none focus:border-accent cursor-pointer"
              >
                <option value="ALL">All Categories</option>
                <option value="DAILY_REPORT">Daily Ops Report</option>
                <option value="SPECIAL_OPERATIONS">Special Operations</option>
                <option value="ANOMALY">Anomaly Review</option>
                <option value="STUDY">Scientific Study</option>
                <option value="OTHER">Other Archives</option>
              </select>
            </div>

            {/* Format / Extension Filter */}
            <div>
              <label className="block text-[10px] font-bold uppercase text-text-dim mb-1">File Format</label>
              <select
                value={extensionFilter}
                onChange={(e) => setExtensionFilter(e.target.value)}
                className="w-full rounded-lg border border-border-default bg-[#060c18] px-2.5 py-1.5 text-xs text-white outline-none focus:border-accent cursor-pointer"
              >
                <option value="ALL">All Formats</option>
                <option value="pdf">PDF Documents</option>
                <option value="data">CSV / Data (.dat, .csv)</option>
                <option value="telemetry">JSON / Telemetry</option>
                <option value="document">Office Docs (.docx, .txt)</option>
                <option value="png">Images / Plots</option>
                <option value="zip">ZIP / Tarballs</option>
              </select>
            </div>

            {/* Classification Level */}
            <div>
              <label className="block text-[10px] font-bold uppercase text-text-dim mb-1">Security Tier</label>
              <select
                value={classificationFilter}
                onChange={(e) => setClassificationFilter(e.target.value)}
                className="w-full rounded-lg border border-border-default bg-[#060c18] px-2.5 py-1.5 text-xs text-white outline-none focus:border-accent cursor-pointer"
              >
                <option value="ALL">All Tiers</option>
                <option value="ISRO_LEVEL">ISRO Level</option>
                <option value="INTERNAL_ONLY">Internal Division</option>
                <option value="SECRET_MISSION">Secret Mission</option>
                <option value="PUBLIC">Public Archive</option>
              </select>
            </div>

            {/* Date Preset */}
            <div>
              <label className="block text-[10px] font-bold uppercase text-text-dim mb-1">Ingestion Date</label>
              <select
                value={datePreset}
                onChange={(e) => setDatePreset(e.target.value)}
                className="w-full rounded-lg border border-border-default bg-[#060c18] px-2.5 py-1.5 text-xs text-white outline-none focus:border-accent cursor-pointer"
              >
                <option value="ALL">All Time</option>
                <option value="TODAY">Today</option>
                <option value="7D">Past 7 Days</option>
                <option value="30D">Past 30 Days</option>
                <option value="90D">Past 90 Days</option>
                <option value="1Y">Past Year</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 3. RESULTS CONTROL STRIP (VIEW TOGGLE & SORTING) */}
      {/* ============================================================ */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-white">
            {loading ? 'Searching archive database…' : `${totalMatches} Results Matched`}
          </span>
          {hasActiveFilters && (
            <span className="text-[11px] font-semibold text-accent-light bg-accent/10 border border-accent/20 px-2 py-0.5 rounded-full">
              Filtered View
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Sorting */}
          <div className="flex items-center gap-1.5 bg-card border border-border-default rounded-lg px-2.5 py-1">
            <span className="text-[10px] font-bold text-text-dim uppercase">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs text-white outline-none cursor-pointer"
            >
              <option value="updatedAt" className="bg-[#060c18]">Recent Update</option>
              <option value="createdAt" className="bg-[#060c18]">Ingestion Date</option>
              <option value="name" className="bg-[#060c18]">File Name</option>
              <option value="sizeBytes" className="bg-[#060c18]">Payload Size</option>
            </select>
            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="text-[10px] font-mono text-accent-light font-bold hover:underline ml-1"
            >
              {sortOrder.toUpperCase()}
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-card border border-border-default rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'grid' ? 'bg-accent text-white shadow-sm' : 'text-text-dim hover:text-white'
              }`}
              title="Grid Card View"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'table' ? 'bg-accent text-white shadow-sm' : 'text-text-dim hover:text-white'
              }`}
              title="Compact Table View"
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 4. RESULTS DISPLAY */}
      {/* ============================================================ */}
      {loading ? (
        <div className="rounded-xl border border-border-subtle bg-card p-16 text-center space-y-2">
          <div className="h-6 w-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-text-dim pt-2">Querying encrypted storage index…</p>
        </div>
      ) : results.length === 0 ? (
        <div className="rounded-xl border border-border-subtle bg-card p-14 text-center space-y-3 shadow-sm">
          <FolderArchive size={36} className="mx-auto text-text-dim opacity-50" />
          <p className="text-sm font-bold text-white">No Archival Records Found</p>
          <p className="text-xs text-text-dim max-w-md mx-auto">
            No flight reports, telemetry datasets, or logs matched your query and filter criteria.
          </p>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={resetAllFilters} className="mt-2 text-xs">
              Clear All Filters
            </Button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID CARDS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map((file) => {
            const isPdf = file.extension === 'pdf'
            const isData = ['csv', 'dat', 'raw', 'tsv'].includes(file.extension || '')
            const isJson = ['json', 'xml', 'log'].includes(file.extension || '')

            return (
              <div
                key={file.id}
                onClick={() =>
                  setPreviewFile({
                    id: file.id,
                    name: file.name,
                    mimeType: file.mimeType || 'application/octet-stream',
                    sizeBytes: Number(file.sizeBytes) || 0,
                  })
                }
                className="rounded-xl border border-border-default bg-card p-4 shadow-sm hover:border-accent/50 hover:shadow-lg hover:shadow-accent/5 transition-all flex flex-col justify-between space-y-3 cursor-pointer group"
              >
                <div className="space-y-2.5">
                  {/* Top Tags */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {file.satelliteName ? (
                        <span className="rounded bg-accent/15 border border-accent/30 text-accent-light px-1.5 py-0.5 text-[9px] font-bold uppercase num">
                          {file.satelliteName}
                        </span>
                      ) : null}
                      {(file.departmentCode || file.departmentName) ? (
                        <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase border ${
                          file.departmentIsActive === false
                            ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                            : 'bg-surface border-border-subtle text-text-dim'
                        }`}>
                          {file.departmentCode ? `/${file.departmentCode}` : file.departmentName}
                          {file.departmentIsActive === false ? ' ⚠️ ARCHIVED' : ''}
                        </span>
                      ) : null}
                    </div>

                    {file.classificationLevel ? (
                      <span
                        className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded border ${
                          file.classificationLevel === 'SECRET_MISSION'
                            ? 'bg-red-500/15 border-red-500/30 text-red-400'
                            : file.classificationLevel === 'INTERNAL_ONLY'
                              ? 'bg-yellow-500/15 border-yellow-500/30 text-yellow-400'
                              : 'bg-nominal/15 border-nominal/30 text-nominal'
                        }`}
                      >
                        {file.classificationLevel}
                      </span>
                    ) : null}
                  </div>

                  {/* File Title & Icon */}
                  <div className="flex items-start gap-3">
                    <div
                      className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 border ${
                        isPdf
                          ? 'bg-red-500/15 border-red-500/30 text-red-400'
                          : isData
                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                            : isJson
                              ? 'bg-yellow-500/15 border-yellow-500/30 text-yellow-400'
                              : 'bg-accent/15 border-accent/30 text-accent-light'
                      }`}
                    >
                      <FileIcon nodeType="FILE" mimeType={file.mimeType || null} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-white group-hover:text-accent-light transition-colors line-clamp-1">
                        {file.reportTitle || file.name}
                      </p>
                      <p className="text-[11px] text-text-dim font-mono truncate">
                        {file.name}
                      </p>
                    </div>
                  </div>

                  {/* Metadata line */}
                  <div className="flex items-center justify-between text-[10px] text-text-dim pt-1 border-t border-border-subtle/50">
                    <span className="truncate">
                      {file.reportAuthor ? `By ${file.reportAuthor}` : 'Authenticated Ingest'}
                    </span>
                    <span className="num font-mono shrink-0">
                      {formatFileSize(Number(file.sizeBytes) || 0)}
                    </span>
                  </div>
                </div>

                {/* Bottom Actions Bar */}
                <div className="flex items-center justify-between pt-2 border-t border-border-subtle/50">
                  <span className="num text-[10px] text-text-dim font-mono">
                    {new Date(file.createdAt).toLocaleDateString()}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setPreviewFile({
                          id: file.id,
                          name: file.name,
                          mimeType: file.mimeType || 'application/octet-stream',
                          sizeBytes: Number(file.sizeBytes) || 0,
                        })
                      }}
                      className="p-1 rounded bg-surface hover:bg-accent/20 hover:text-accent-light text-text-dim transition-colors"
                      title="Quick Preview"
                    >
                      <Eye size={13} />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleDownload(file, e)}
                      className="p-1 rounded bg-surface hover:bg-accent/20 hover:text-accent-light text-text-dim transition-colors"
                      title="Download Dataset"
                    >
                      <Download size={13} />
                    </button>

                    {file.departmentId && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/departments/${file.departmentId}`)
                        }}
                        className="p-1 rounded bg-surface hover:bg-accent/20 hover:text-accent-light text-text-dim transition-colors"
                        title="Go to Department Hub"
                      >
                        <ExternalLink size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* COMPACT TABLE VIEW */
        <div className="rounded-xl border border-border-default bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-text-secondary">
              <thead className="bg-[#060c18] border-b border-border-default text-[10px] uppercase font-bold text-text-dim">
                <tr>
                  <th className="px-4 py-3">File / Report</th>
                  <th className="px-4 py-3">Spacecraft / Division</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Security</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {results.map((file) => (
                  <tr
                    key={file.id}
                    onClick={() =>
                      setPreviewFile({
                        id: file.id,
                        name: file.name,
                        mimeType: file.mimeType || 'application/octet-stream',
                        sizeBytes: Number(file.sizeBytes) || 0,
                      })
                    }
                    className="hover:bg-card-hover transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <FileIcon nodeType="FILE" mimeType={file.mimeType || null} />
                        <div className="min-w-0">
                          <p className="font-bold text-white truncate max-w-xs">{file.reportTitle || file.name}</p>
                          <p className="text-[10px] text-text-dim font-mono truncate max-w-xs">{file.name}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        <p className="font-bold text-accent-light text-[11px]">{file.satelliteName}</p>
                        <p className="text-[10px] text-text-dim flex items-center gap-1.5">
                          <span>{file.departmentName}</span>
                          {file.departmentIsActive === false && (
                            <span className="rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 px-1 py-0.2 text-[8px] font-bold uppercase">
                              Archived
                            </span>
                          )}
                        </p>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <span className="num text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-surface border border-border-subtle">
                        {file.reportCategory || 'REPORT'}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      {file.classificationLevel ? (
                        <span className="text-[10px] font-bold uppercase text-nominal">
                          {file.classificationLevel}
                        </span>
                      ) : (
                        <span className="text-[10px] text-text-dim">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3 num font-mono text-[11px]">
                      {formatFileSize(Number(file.sizeBytes) || 0)}
                    </td>

                    <td className="px-4 py-3 num font-mono text-[11px] text-text-dim">
                      {new Date(file.createdAt).toLocaleDateString()}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewFile({
                              id: file.id,
                              name: file.name,
                              mimeType: file.mimeType || 'application/octet-stream',
                              sizeBytes: Number(file.sizeBytes) || 0,
                            })
                          }
                          className="p-1 rounded hover:bg-surface text-text-dim hover:text-white"
                          title="Preview"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDownload(file, e)}
                          className="p-1 rounded hover:bg-surface text-text-dim hover:text-white"
                          title="Download"
                        >
                          <Download size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </>
      )}

      {/* Embedded File Preview Modal */}
      {previewFile && (
        <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
      )}
    </div>
  )
}
