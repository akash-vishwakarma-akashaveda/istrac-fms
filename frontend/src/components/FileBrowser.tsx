import { useState, useMemo } from 'react'
import {
  LayoutGrid,
  List,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Upload,
  Eye,
  Download,
  Clock,
  Lock,
  Search,
  Star,
  Layers,
  RotateCcw,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useDeptFiles, useBulkDeleteFiles, useBulkTagFiles } from '../hooks/useDeptFiles'
import { useUIStore } from '../store/uiStore'
import { useAuthStore } from '../store/authStore'
import { useToastStore } from '../store/toastStore'
import { formatFileSize } from '../lib/formatFileSize'
import { formatDateTimeIST, formatDateIST } from '../lib/formatDate'
import { api } from '../lib/axios'

import { FileIcon } from './FileIcon'
import { BulkActionBar } from './BulkActionBar'
import { TagModal } from './TagModal'
import { VersionHistoryPanel } from './VersionHistoryPanel'
import { UploadVersionModal } from './UploadVersionModal'
import { FilePreviewModal } from './FilePreviewModal'
import { ConfirmFeatureModal } from './ConfirmFeatureModal'
import { Button } from '.'
import { Panel } from './Panel'
import type { FileNode, SortField, SortDirection } from '../types/file'

interface FileBrowserProps {
  deptId: string
  parentId?: string | null
}

const SORT_LABELS: Record<SortField, string> = {
  name: 'Name',
  sizeBytes: 'Size',
  createdAt: 'Date',
}

export function FileBrowser({ deptId, parentId = null }: FileBrowserProps) {
  const user = useAuthStore((state) => state.user)
  const queryClient = useQueryClient()
  const isAdmin = user?.role === 'ADMIN'
  const canWrite = isAdmin || Boolean(
    user?.departmentAccess?.some(
      (da: any) =>
        (da.departmentId === deptId || da.department?.id === deptId) &&
        da.accessLevel === 'READ_WRITE'
    )
  )

  const { fileViewMode, setFileViewMode } = useUIStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [filterFeatured, setFilterFeatured] = useState(false)
  const [confirmFeatureFile, setConfirmFeatureFile] = useState<FileNode | null>(null)
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [tagModalOpen, setTagModalOpen] = useState(false)
  const [versionPanelFile, setVersionPanelFile] = useState<FileNode | null>(null)
  const [uploadVersionFile, setUploadVersionFile] = useState<FileNode | null>(null)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [previewFile, setPreviewFile] = useState<FileNode | null>(null)

  const { data: filesData, isLoading } = useDeptFiles({
    deptId,
    parentId,
    sortField,
    sortDirection,
  })

  const bulkDelete = useBulkDeleteFiles()
  const bulkTag = useBulkTagFiles()
  const addToast = useToastStore((s) => s.addToast)

  function toggleSort(field: SortField) {
    if (field === sortField) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  function toggleSelect(id: string) {
    if (!canWrite) return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleBulkDelete() {
    if (!canWrite) return
    bulkDelete.mutate(Array.from(selectedIds), {
      onSuccess: () => {
        addToast({ message: `${selectedIds.size} file(s) deleted`, variant: 'success' })
        setSelectedIds(new Set())
      },
      onError: () => addToast({ message: 'Bulk delete failed', variant: 'error' }),
    })
  }

  function handleBulkTag(tags: string[]) {
    if (!canWrite) return
    bulkTag.mutate(
      { fileIds: Array.from(selectedIds), tags },
      {
        onSuccess: () => {
          addToast({ message: 'Tags applied', variant: 'success' })
          setSelectedIds(new Set())
          setTagModalOpen(false)
        },
        onError: () => addToast({ message: 'Bulk tag failed', variant: 'error' }),
      },
    )
  }

  function handleFileNameClick(e: React.MouseEvent, file: FileNode) {
    e.stopPropagation()
    if (file.nodeType === 'FILE') setPreviewFile(file)
  }

  function handleVersionClick(e: React.MouseEvent, file: FileNode) {
    e.stopPropagation()
    setVersionPanelFile(file)
  }

  async function handleDownload(e: React.MouseEvent, file: FileNode) {
    e.stopPropagation()
    try {
      const response = await api.get(`/files/${file.id}/download`, {
        responseType: 'blob',
      })
      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.download = file.name
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      window.open(`${import.meta.env.VITE_API_URL}/files/${file.id}/download`, '_blank')
    }
  }

  const [selectedFormat, setSelectedFormat] = useState('ALL')
  const [selectedSpacecraft, setSelectedSpacecraft] = useState('ALL')
  const [selectedCategory, setSelectedCategory] = useState('ALL')
  const [dateFilter, setDateFilter] = useState('ALL')

  // Extract unique filter options from dataset
  const availableFormats = useMemo(() => {
    if (!filesData) return []
    const set = new Set<string>()
    filesData.forEach((f) => {
      const ext = f.name.split('.').pop()?.toUpperCase()
      if (ext && ext.length <= 6) set.add(ext)
    })
    return Array.from(set).sort()
  }, [filesData])

  const availableSpacecraft = useMemo(() => {
    if (!filesData) return []
    const set = new Set<string>()
    filesData.forEach((f) => {
      if (f.spacecraft) set.add(f.spacecraft)
    })
    return Array.from(set).sort()
  }, [filesData])

  const availableCategories = useMemo(() => {
    if (!filesData) return []
    const set = new Set<string>()
    filesData.forEach((f) => {
      if (f.category) set.add(f.category)
    })
    return Array.from(set).sort()
  }, [filesData])

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    filterFeatured ||
    selectedFormat !== 'ALL' ||
    selectedSpacecraft !== 'ALL' ||
    selectedCategory !== 'ALL' ||
    dateFilter !== 'ALL'

  const resetAllFilters = () => {
    setSearchQuery('')
    setFilterFeatured(false)
    setSelectedFormat('ALL')
    setSelectedSpacecraft('ALL')
    setSelectedCategory('ALL')
    setDateFilter('ALL')
  }

  // Multi-attribute Filter & Multi-criteria Sort (with Folder pinning)
  const filteredFiles = useMemo(() => {
    if (!filesData) return []
    const now = Date.now()

    return filesData.filter((file) => {
      if (filterFeatured && !file.isFeatured) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesName = file.name.toLowerCase().includes(q)
        const matchesSat = file.spacecraft?.toLowerCase().includes(q)
        const matchesCat = file.category?.toLowerCase().includes(q)
        if (!matchesName && !matchesSat && !matchesCat) return false
      }

      if (selectedFormat !== 'ALL') {
        const ext = file.name.split('.').pop()?.toUpperCase()
        if (ext !== selectedFormat) return false
      }

      if (selectedSpacecraft !== 'ALL') {
        if (selectedSpacecraft === 'General') {
          if (file.spacecraft && file.spacecraft !== 'General') return false
        } else if (file.spacecraft !== selectedSpacecraft) {
          return false
        }
      }

      if (selectedCategory !== 'ALL') {
        if (file.category !== selectedCategory) return false
      }

      if (dateFilter !== 'ALL') {
        const fileTime = new Date(file.createdAt).getTime()
        if (dateFilter === 'today') {
          if (now - fileTime > 24 * 60 * 60 * 1000) return false
        } else if (dateFilter === '7days') {
          if (now - fileTime > 7 * 24 * 60 * 60 * 1000) return false
        } else if (dateFilter === '30days') {
          if (now - fileTime > 30 * 24 * 60 * 60 * 1000) return false
        }
      }

      return true
    }).sort((a, b) => {
      if (a.nodeType !== b.nodeType) {
        return a.nodeType === 'FOLDER' ? -1 : 1
      }
      const dir = sortDirection === 'asc' ? 1 : -1
      if (sortField === 'name') return a.name.localeCompare(b.name) * dir
      if (sortField === 'sizeBytes') return ((a.sizeBytes ?? 0) - (b.sizeBytes ?? 0)) * dir
      return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir
    })
  }, [filesData, filterFeatured, searchQuery, selectedFormat, selectedSpacecraft, selectedCategory, dateFilter, sortField, sortDirection])

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border-subtle bg-card p-8 shadow-card text-center">
        <p className="num text-xs text-text-dim">Loading division telemetry repository…</p>
      </div>
    )
  }

  const isEmpty = !filteredFiles || filteredFiles.length === 0

  return (
    <div className="space-y-4">
      {/* Search & Clearance Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 rounded-xl border border-border-default bg-card shadow-sm">
        {/* Search within current directory */}
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            type="text"
            placeholder="Search datasets in this repository…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-border-default bg-[#060c18] pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-text-dim outline-none focus:border-accent"
          />
        </div>

        {/* Featured Filter Toggle */}
        <button
          type="button"
          onClick={() => setFilterFeatured(!filterFeatured)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer shrink-0 ${
            filterFeatured
              ? 'bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-500/20'
              : 'bg-[#060c18] border-border-default text-text-dim hover:text-amber-400 hover:border-amber-500/40'
          }`}
          title="Filter Featured Mission Reports (Appearing in public showcase)"
        >
          <Star size={12} className={filterFeatured ? 'fill-white' : 'fill-amber-400 text-amber-400'} />
          <span>{filterFeatured ? 'Featured Only' : 'Filter Featured'}</span>
        </button>

        {/* Action Controls & Clearance Status */}
        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
          {canWrite ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setUploadVersionFile(null)
                setIsUploadModalOpen(true)
              }}
              className="font-bold shadow-md shadow-accent/20 cursor-pointer"
            >
              <Upload size={13} strokeWidth={2} />
              <span>Upload File</span>
            </Button>
          ) : (
            <span className="flex items-center gap-1.5 rounded-lg border border-border-default bg-[#080e1b] px-3 py-1.5 text-xs font-semibold text-text-dim">
              <Lock size={12} className="text-accent-light" />
              <span>READ-ONLY CLEARANCE</span>
            </span>
          )}

          {/* Segmented Grid / List View Toggle */}
          <div className="flex overflow-hidden rounded-lg border border-border-default bg-[#060c18]">
            <button
              type="button"
              onClick={() => setFileViewMode('grid')}
              aria-label="Grid view"
              aria-pressed={fileViewMode === 'grid'}
              className={`p-2 transition-colors duration-150 ${
                fileViewMode === 'grid'
                  ? 'bg-accent/20 text-accent-light'
                  : 'text-text-muted hover:text-text-primary'
              }`}
              title="Card Grid View"
            >
              <LayoutGrid size={14} strokeWidth={1.8} />
            </button>

            <span aria-hidden="true" className="w-px bg-border-default" />

            <button
              type="button"
              onClick={() => setFileViewMode('list')}
              aria-label="List view"
              aria-pressed={fileViewMode === 'list'}
              className={`p-2 transition-colors duration-150 ${
                fileViewMode === 'list'
                  ? 'bg-accent/20 text-accent-light'
                  : 'text-text-muted hover:text-text-primary'
              }`}
              title="Table View"
            >
              <List size={14} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </div>

      {/* Comprehensive Filter & Sort Toolbar */}
      <div className="p-3 rounded-xl border border-border-default bg-card shadow-sm space-y-2.5">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
          {/* Format Filter */}
          <div>
            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value)}
              className="w-full rounded-lg border border-border-default bg-[#060c18] px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent cursor-pointer"
            >
              <option value="ALL">All Formats</option>
              {availableFormats.map((fmt) => (
                <option key={fmt} value={fmt}>{fmt}</option>
              ))}
            </select>
          </div>

          {/* Spacecraft Filter */}
          <div>
            <select
              value={selectedSpacecraft}
              onChange={(e) => setSelectedSpacecraft(e.target.value)}
              className="w-full rounded-lg border border-border-default bg-[#060c18] px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent cursor-pointer"
            >
              <option value="ALL">All Spacecraft</option>
              {availableSpacecraft.map((sat) => (
                <option key={sat} value={sat}>{sat}</option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full rounded-lg border border-border-default bg-[#060c18] px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              {availableCategories.map((cat) => (
                <option key={cat} value={cat}>{cat.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          {/* Date Range Filter */}
          <div>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full rounded-lg border border-border-default bg-[#060c18] px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent cursor-pointer"
            >
              <option value="ALL">All Dates</option>
              <option value="today">Uploaded Today</option>
              <option value="7days">Uploaded in Last 7 Days</option>
              <option value="30days">Uploaded in Last 30 Days</option>
            </select>
          </div>

          {/* Sort By Dropdown */}
          <div className="col-span-2 sm:col-span-1">
            <select
              value={`${sortField}-${sortDirection}`}
              onChange={(e) => {
                const [f, d] = e.target.value.split('-') as [SortField, SortDirection]
                setSortField(f)
                setSortDirection(d)
              }}
              className="w-full rounded-lg border border-border-default bg-[#060c18] px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent cursor-pointer font-medium"
            >
              <option value="createdAt-desc">Date Added: Newest ↓</option>
              <option value="createdAt-asc">Date Added: Oldest ↑</option>
              <option value="sizeBytes-desc">File Size: Largest ↓</option>
              <option value="sizeBytes-asc">File Size: Smallest ↑</option>
              <option value="name-asc">File Name: A → Z ↑</option>
              <option value="name-desc">File Name: Z → A ↓</option>
            </select>
          </div>
        </div>

        {/* Filter Summary & Reset Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border-subtle/50 text-[11px] font-mono text-text-dim">
          <div className="flex items-center gap-2">
            <span className="text-accent-light font-bold">{filteredFiles?.length ?? 0}</span>
            <span>datasets in repository</span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="inline-flex items-center gap-1 text-[10px] text-text-dim hover:text-white px-2 py-0.5 rounded border border-border-subtle bg-surface cursor-pointer ml-2"
              >
                <RotateCcw size={10} />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <Panel
        flush
        title="Sort datasets by"
        meta={
          <span className="flex items-center gap-3">
            {(['name', 'sizeBytes', 'createdAt'] as SortField[]).map((field) => (
              <button
                key={field}
                type="button"
                onClick={() => toggleSort(field)}
                aria-pressed={sortField === field}
                className={`inline-flex items-center gap-1 text-xs transition-colors duration-150 ${
                  sortField === field
                    ? 'text-accent-light font-bold'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {SORT_LABELS[field]}
                {sortField === field &&
                  (sortDirection === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
              </button>
            ))}
          </span>
        }
      >
        {isEmpty && (
          <div className="px-4 py-14 text-center space-y-2">
            <p className="num text-sm text-text-dim">—</p>
            <p className="text-sm font-bold text-white">No Telemetry Datasets Found</p>
            <p className="text-xs text-text-muted">
              {searchQuery ? 'No files match your search query.' : 'This division repository is currently empty.'}
            </p>
          </div>
        )}

        {/* CARD / GRID VIEW */}
        {!isEmpty && fileViewMode === 'grid' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
            {filteredFiles?.map((file) => (
              <div
                key={file.id}
                onClick={(e) => handleFileNameClick(e, file)}
                className={`group relative rounded-xl border p-4 transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                  selectedIds.has(file.id)
                    ? 'border-accent bg-accent/[0.08] shadow-md shadow-accent/15'
                    : 'border-border-default bg-[#060c18] hover:border-accent hover:bg-card-hover'
                }`}
              >
                {canWrite && (
                  <input
                    type="checkbox"
                    checked={selectedIds.has(file.id)}
                    onChange={() => toggleSelect(file.id)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Select ${file.name}`}
                    className="absolute top-3 right-3 h-4 w-4 accent-accent z-10 cursor-pointer"
                  />
                )}

                <div>
                  {/* Top Format & MIME Icon */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2.5 rounded-lg border border-border-subtle bg-surface text-accent-light group-hover:scale-105 transition-transform">
                      <FileIcon nodeType={file.nodeType} mimeType={file.mimeType} size={24} />
                    </div>
                    <div className="min-w-0 flex-1 flex items-center gap-1.5 flex-wrap">
                      <span className="rounded bg-accent/15 border border-accent/30 px-2 py-0.5 text-[9px] font-bold text-accent-light uppercase">
                        {file.name.split('.').pop() || 'FILE'}
                      </span>
                      {file.spacecraft && (
                        <span className="rounded bg-sky-500/15 border border-sky-500/30 px-1.5 py-0.5 text-[9px] font-bold text-sky-300 uppercase truncate max-w-[110px]" title={`Spacecraft: ${file.spacecraft}`}>
                          {file.spacecraft}
                        </span>
                      )}
                      {file.isFeatured && (
                        <span className="rounded bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 text-[9px] font-bold text-amber-300 uppercase flex items-center gap-1">
                          <Star size={9} className="fill-amber-300" />
                          <span>Featured</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* File Name */}
                  <h4
                    className="text-xs font-bold text-white group-hover:text-accent-light transition-colors line-clamp-2 leading-relaxed"
                    title={file.name}
                  >
                    {file.name}
                  </h4>
                </div>

                {/* Card Footer with Meta & Actions */}
                <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-between gap-2">
                  <div className="min-w-0 text-[10px] font-mono text-text-dim leading-tight">
                    <span className="font-semibold text-text-secondary">{formatFileSize(file.sizeBytes)}</span>
                    <div className="flex items-center gap-1 text-[9px] text-text-muted mt-0.5" title={`Uploaded at ${formatDateTimeIST(file.createdAt)}`}>
                      <Clock size={9} className="text-accent-light shrink-0" />
                      <span>{formatDateIST(file.createdAt)}</span>
                    </div>
                  </div>

                  {/* Hover Quick Action Buttons */}
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {canWrite && file.nodeType === 'FILE' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setConfirmFeatureFile(file)
                        }}
                        className={`p-1 rounded-md border transition-all ${
                          file.isFeatured
                            ? 'border-amber-500/50 bg-amber-500/20 text-amber-400'
                            : 'border-border-subtle bg-surface text-text-dim hover:border-amber-500/50 hover:text-amber-400'
                        }`}
                        title={file.isFeatured ? 'Featured Mission Report (Click to unfeature)' : 'Feature in Public Mission Reports'}
                      >
                        <Star size={12} className={file.isFeatured ? 'fill-amber-400' : ''} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleFileNameClick(e, file)}
                      className="p-1 rounded-md border border-border-subtle bg-surface text-text-muted hover:border-accent hover:text-white transition-all"
                      title="Preview Dataset"
                    >
                      <Eye size={12} className="text-accent-light" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleDownload(e, file)}
                      className="p-1 rounded-md border border-border-subtle bg-surface text-text-muted hover:border-nominal hover:text-nominal transition-all"
                      title="Download File"
                    >
                      <Download size={12} />
                    </button>

                    {file.nodeType === 'FILE' && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => handleVersionClick(e, file)}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-border-default bg-surface text-text-secondary hover:border-accent hover:text-accent-light transition-all font-mono text-[10px] font-bold cursor-pointer"
                          title={`Version history (${file.versionLabel || `v${file.versionCount ?? 1}`})`}
                        >
                          <Layers size={10} />
                          <span>{file.versionLabel || `v${file.versionCount ?? 1}`}</span>
                          {(file.versionCount ?? 1) > 1 && (
                            <span className="text-[9px] opacity-75 font-normal">({file.versionCount})</span>
                          )}
                        </button>

                        {canWrite && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setUploadVersionFile(file)
                            }}
                            className="p-1 rounded-md border border-border-subtle bg-surface text-text-muted hover:border-accent hover:text-accent-light transition-all cursor-pointer"
                            title="Upload New Version"
                          >
                            <Upload size={11} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* LIST / TABLE VIEW */}
        {!isEmpty && fileViewMode === 'list' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-border-default bg-surface text-[11px] font-bold text-text-dim uppercase tracking-wider">
                  {canWrite && <th className="w-8 px-3 py-2.5" />}
                  <th className="w-10 px-2 py-2.5 text-center" title="Featured Mission Report">
                    <Star size={12} className="inline text-amber-400 fill-amber-400/20" />
                  </th>
                  <th
                    className="px-4 py-2.5 cursor-pointer select-none hover:text-white transition-colors"
                    onClick={() => toggleSort('name')}
                    title="Click to sort by File Name"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>File Name</span>
                      {sortField === 'name' ? (
                        sortDirection === 'asc' ? <ArrowUp size={12} className="text-accent-light" /> : <ArrowDown size={12} className="text-accent-light" />
                      ) : (
                        <ArrowUpDown size={11} className="text-text-dim opacity-50" />
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-2.5">Format</th>
                  <th
                    className="px-4 py-2.5 text-right cursor-pointer select-none hover:text-white transition-colors"
                    onClick={() => toggleSort('sizeBytes')}
                    title="Click to sort by File Size"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Size</span>
                      {sortField === 'sizeBytes' ? (
                        sortDirection === 'asc' ? <ArrowUp size={12} className="text-accent-light" /> : <ArrowDown size={12} className="text-accent-light" />
                      ) : (
                        <ArrowUpDown size={11} className="text-text-dim opacity-50" />
                      )}
                    </div>
                  </th>
                  <th
                    className="px-4 py-2.5 text-right cursor-pointer select-none hover:text-white transition-colors"
                    onClick={() => toggleSort('createdAt')}
                    title="Click to sort by Upload Timestamp"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Date Added</span>
                      {sortField === 'createdAt' ? (
                        sortDirection === 'asc' ? <ArrowUp size={12} className="text-accent-light" /> : <ArrowDown size={12} className="text-accent-light" />
                      ) : (
                        <ArrowUpDown size={11} className="text-text-dim opacity-50" />
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-2.5 text-center">Version</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-xs">
                {filteredFiles?.map((file) => (
                  <tr
                    key={file.id}
                    className={`hover:bg-card-hover transition-colors group cursor-pointer ${
                      selectedIds.has(file.id) ? 'bg-accent/[0.04]' : ''
                    }`}
                    onClick={(e) => handleFileNameClick(e, file)}
                  >
                    {canWrite && (
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(file.id)}
                          onChange={() => toggleSelect(file.id)}
                          aria-label={`Select ${file.name}`}
                          className="h-3.5 w-3.5 accent-accent cursor-pointer"
                        />
                      </td>
                    )}

                    {/* Featured Star in Front */}
                    <td className="w-10 px-2 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      {canWrite ? (
                        <button
                          type="button"
                          onClick={() => setConfirmFeatureFile(file)}
                          className={`p-1 rounded-md border transition-all cursor-pointer ${
                            file.isFeatured
                              ? 'border-amber-500/50 bg-amber-500/20 text-amber-400 shadow-sm'
                              : 'border-transparent text-text-dim/40 hover:text-amber-400 hover:border-amber-500/40 hover:bg-surface'
                          }`}
                          title={
                            file.isFeatured
                              ? '⭐ Featured in Public Mission Reports (Click to unfeature)'
                              : 'Feature in Public Mission Reports'
                          }
                        >
                          <Star size={13} className={file.isFeatured ? 'fill-amber-400 text-amber-400' : ''} />
                        </button>
                      ) : file.isFeatured ? (
                        <span className="p-1 inline-block text-amber-400" title="Featured Mission Report">
                          <Star size={13} className="fill-amber-400 text-amber-400" />
                        </span>
                      ) : (
                        <span className="p-1 inline-block text-text-dim/20">
                          <Star size={13} />
                        </span>
                      )}
                    </td>

                    {/* Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileIcon nodeType={file.nodeType} mimeType={file.mimeType} size={18} />
                        <span className="font-semibold text-white group-hover:text-accent-light transition-colors truncate">
                          {file.name}
                        </span>
                        {file.spacecraft && (
                          <span className="shrink-0 rounded bg-sky-500/15 border border-sky-500/30 px-1.5 py-0.5 text-[9px] font-bold text-sky-300 uppercase">
                            {file.spacecraft}
                          </span>
                        )}
                        {file.isFeatured && (
                          <span className="shrink-0 rounded bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 text-[9px] font-bold text-amber-300 uppercase flex items-center gap-1">
                            <Star size={9} className="fill-amber-300" />
                            <span>Featured</span>
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Format */}
                    <td className="px-4 py-3">
                      <span className="rounded bg-accent/15 border border-accent/30 px-2 py-0.5 text-[10px] font-bold text-accent-light uppercase">
                        {file.name.split('.').pop() || 'FILE'}
                      </span>
                    </td>

                    {/* Size */}
                    <td className="px-4 py-3 text-right num text-text-secondary font-mono">
                      {formatFileSize(file.sizeBytes)}
                    </td>

                    {/* Date (IST) */}
                    <td className="px-4 py-3 text-right num text-text-dim font-mono">
                      <div className="flex items-center justify-end gap-1 text-text-secondary">
                        <Clock size={11} className="text-accent-light shrink-0" />
                        <span>{formatDateTimeIST(file.createdAt)}</span>
                      </div>
                    </td>

                    {/* Version */}
                    <td className="px-4 py-3 text-center num font-mono">
                      {file.nodeType === 'FILE' ? (
                        <button
                          type="button"
                          onClick={(e) => handleVersionClick(e, file)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-border-default bg-surface text-text-secondary hover:border-accent hover:text-accent-light text-[10px] font-bold transition-all cursor-pointer"
                          title="Click to view version history"
                        >
                          <Layers size={10} />
                          <span>{file.versionLabel || `v${file.versionCount ?? 1}`}</span>
                          {(file.versionCount ?? 1) > 1 && (
                            <span className="text-[9px] opacity-75 font-normal">({file.versionCount})</span>
                          )}
                        </button>
                      ) : (
                        <span className="text-text-dim text-xs">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {canWrite && file.nodeType === 'FILE' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setConfirmFeatureFile(file)
                            }}
                            className={`p-1.5 rounded-lg border transition-all ${
                              file.isFeatured
                                ? 'border-amber-500/50 bg-amber-500/20 text-amber-400'
                                : 'border-border-default bg-[#0c1424] text-text-muted hover:border-amber-500/50 hover:text-amber-400'
                            }`}
                            title={file.isFeatured ? 'Featured Mission Report (Click to unfeature)' : 'Feature in Public Mission Reports'}
                          >
                            <Star size={13} className={file.isFeatured ? 'fill-amber-400' : ''} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => handleFileNameClick(e, file)}
                          className="p-1.5 rounded-lg border border-border-default bg-[#0c1424] text-text-muted hover:border-accent hover:text-white transition-all"
                          title="Preview Dataset"
                        >
                          <Eye size={13} className="text-accent-light" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleDownload(e, file)}
                          className="p-1.5 rounded-lg border border-border-default bg-[#0c1424] text-text-muted hover:border-nominal hover:text-nominal transition-all"
                          title="Download Dataset"
                        >
                          <Download size={13} />
                        </button>

                        {canWrite && file.nodeType === 'FILE' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setUploadVersionFile(file)
                            }}
                            className="p-1.5 rounded-lg border border-border-default bg-[#0c1424] text-text-muted hover:border-accent hover:text-accent-light transition-all cursor-pointer"
                            title="Upload New Version"
                          >
                            <Upload size={13} />
                          </button>
                        )}

                        {file.nodeType === 'FILE' && (
                          <button
                            type="button"
                            onClick={(e) => handleVersionClick(e, file)}
                            className="p-1.5 rounded-lg border border-border-default bg-[#0c1424] text-text-muted hover:border-accent hover:text-accent-light transition-all font-mono text-[11px] cursor-pointer"
                            title="Version History"
                          >
                            <Clock size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Bulk Action Bar (Only for users with WRITE permissions) */}
      {canWrite && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          onDelete={handleBulkDelete}
          onTag={() => setTagModalOpen(true)}
          onClear={() => setSelectedIds(new Set())}
        />
      )}


      {/* Tag Modal */}
      {canWrite && (
        <TagModal
          isOpen={tagModalOpen}
          onClose={() => setTagModalOpen(false)}
          onConfirm={handleBulkTag}
          isSubmitting={bulkTag.isPending}
        />
      )}

      {/* Version History Panel */}
      {versionPanelFile && (
        <VersionHistoryPanel
          fileId={versionPanelFile.id}
          fileName={versionPanelFile.name}
          fileDetails={{
            id: versionPanelFile.id,
            name: versionPanelFile.name,
            title: versionPanelFile.title || versionPanelFile.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
            description: versionPanelFile.description || '',
            departmentId: deptId,
            spacecraft: versionPanelFile.spacecraft || 'General',
            category: versionPanelFile.category || 'DAILY_REPORT',
            sizeBytes: versionPanelFile.sizeBytes,
            createdAt: versionPanelFile.createdAt,
            versionCount: versionPanelFile.versionCount,
            versionLabel: versionPanelFile.versionLabel,
          }}
          canWrite={canWrite}
          onClose={() => setVersionPanelFile(null)}
          onOpenUploadVersion={() => {
            setUploadVersionFile(versionPanelFile)
          }}
        />
      )}

      {/* Upload Modal (For Both New Files and File Revisions) */}
      <UploadVersionModal
        isOpen={uploadVersionFile !== null || isUploadModalOpen}
        onClose={() => {
          setUploadVersionFile(null)
          setIsUploadModalOpen(false)
        }}
        file={uploadVersionFile}
        defaultDeptId={deptId}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['dept-files', deptId] })
        }}
      />

      {/* File Preview Modal */}
      <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />

      {/* Confirmation Modal to Add / Remove Featured status */}
      <ConfirmFeatureModal
        isOpen={confirmFeatureFile !== null}
        file={confirmFeatureFile}
        onClose={() => setConfirmFeatureFile(null)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['dept-files', deptId] })
        }}
      />
    </div>
  )
}
