import { useState } from 'react'
import {
  LayoutGrid,
  List,
  ArrowUp,
  ArrowDown,
  Upload,
  Eye,
  Download,
  Clock,
  Lock,
  Search,
} from 'lucide-react'
import { useDeptFiles, useBulkDeleteFiles, useBulkTagFiles } from '../hooks/useDeptFiles'
import { useUIStore } from '../store/uiStore'
import { useAuthStore } from '../store/authStore'
import { useToastStore } from '../store/toastStore'
import { formatFileSize } from '../lib/formatFileSize'
import { api } from '../lib/axios'

import { FileIcon } from './FileIcon'
import { BulkActionBar } from './BulkActionBar'
import { TagModal } from './TagModal'
import { UploadModal } from './UploadModal'
import { VersionHistoryPanel } from './VersionHistoryPanel'
import { FilePreviewModal } from './FilePreviewModal'
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
  const isAdmin = user?.role === 'ADMIN'

  const canWrite = isAdmin

  const { fileViewMode, setFileViewMode } = useUIStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [tagModalOpen, setTagModalOpen] = useState(false)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [versionPanelFile, setVersionPanelFile] = useState<{
    id: string
    name: string
  } | null>(null)
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
    setVersionPanelFile({ id: file.id, name: file.name })
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

  // Local Search Filter
  const filteredFiles = filesData?.filter((file) => {
    if (!searchQuery.trim()) return true
    return file.name.toLowerCase().includes(searchQuery.toLowerCase())
  })

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

        {/* Action Controls & Clearance Status */}
        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
          {canWrite ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setUploadModalOpen(true)}
              className="font-bold shadow-md shadow-accent/20"
            >
              <Upload size={13} strokeWidth={2} />
              <span>Upload Dataset</span>
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
                    <div className="min-w-0 flex-1">
                      <span className="rounded bg-accent/15 border border-accent/30 px-2 py-0.5 text-[9px] font-bold text-accent-light uppercase">
                        {file.name.split('.').pop() || 'FILE'}
                      </span>
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
                  <div className="min-w-0 text-[11px] font-mono text-text-dim">
                    <span>{formatFileSize(file.sizeBytes)}</span>
                  </div>

                  {/* Hover Quick Action Buttons */}
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
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
                      <button
                        type="button"
                        onClick={(e) => handleVersionClick(e, file)}
                        className="p-1 rounded-md border border-border-subtle bg-surface text-text-muted hover:border-purple-400 hover:text-purple-300 transition-all font-mono text-[10px]"
                        title={`Version history (v${file.versionCount ?? 1})`}
                      >
                        v{file.versionCount ?? 1}
                      </button>
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
                  <th className="px-4 py-2.5">File Name</th>
                  <th className="px-4 py-2.5">Format</th>
                  <th className="px-4 py-2.5 text-right">Size</th>
                  <th className="px-4 py-2.5 text-right">Date Added</th>
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

                    {/* Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileIcon nodeType={file.nodeType} mimeType={file.mimeType} size={18} />
                        <span className="font-semibold text-white group-hover:text-accent-light transition-colors truncate">
                          {file.name}
                        </span>
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

                    {/* Date */}
                    <td className="px-4 py-3 text-right num text-text-dim font-mono">
                      {new Date(file.createdAt).toLocaleDateString()}
                    </td>

                    {/* Version */}
                    <td className="px-4 py-3 text-center num text-text-dim font-mono">
                      v{file.versionCount ?? 1}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
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

                        {file.nodeType === 'FILE' && (
                          <button
                            type="button"
                            onClick={(e) => handleVersionClick(e, file)}
                            className="p-1.5 rounded-lg border border-border-default bg-[#0c1424] text-text-muted hover:border-purple-400 hover:text-purple-300 transition-all font-mono text-[11px]"
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

      {/* Upload Modal (Only for users with WRITE permissions) */}
      {canWrite && (
        <UploadModal
          isOpen={uploadModalOpen}
          onClose={() => setUploadModalOpen(false)}
          departmentId={deptId}
          parentId={parentId}
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
          onClose={() => setVersionPanelFile(null)}
        />
      )}

      {/* File Preview Modal */}
      <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
    </div>
  )
}
