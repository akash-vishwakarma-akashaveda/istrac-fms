import { useState } from 'react'
import { LayoutGrid, List, ArrowUp, ArrowDown, Upload } from 'lucide-react'
import { useDeptFiles, useBulkDeleteFiles, useBulkTagFiles } from '../hooks/useDeptFiles'
import { useUIStore } from '../store/uiStore'
import { useToastStore } from '../store/toastStore'
import { formatFileSize } from '../lib/formatFileSize'

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
  const { fileViewMode, setFileViewMode } = useUIStore()
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [tagModalOpen, setTagModalOpen] = useState(false)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [versionPanelFile, setVersionPanelFile] = useState<{ id: string; name: string } | null>(null)
  const [previewFile, setPreviewFile] = useState<FileNode | null>(null)

  const { data: filesData, isLoading } = useDeptFiles({ deptId, parentId, sortField, sortDirection })


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
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleBulkDelete() {
    bulkDelete.mutate(Array.from(selectedIds), {
      onSuccess: () => {
        addToast({ message: `${selectedIds.size} file(s) deleted`, variant: 'success' })
        setSelectedIds(new Set())
      },
      onError: () => addToast({ message: 'Bulk delete failed', variant: 'error' }),
    })
  }

  function handleBulkTag(tags: string[]) {
    bulkTag.mutate(
      { fileIds: Array.from(selectedIds), tags },
      {
        onSuccess: () => {
          addToast({ message: 'Tags applied', variant: 'success' })
          setSelectedIds(new Set())
          setTagModalOpen(false)
        },
        onError: () => addToast({ message: 'Bulk tag failed', variant: 'error' }),
      }
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

  if (isLoading)
    return (
      <div className="rounded-xl border border-border-subtle bg-card p-4 shadow-card">
        <p className="num text-xs text-text-dim">Loading files…</p>
      </div>
    )

  const isEmpty = filesData?.length === 0

  return (
    <div className="space-y-4">
      <Panel
        flush
        actions={
          <>
            <Button variant="primary" size="sm" onClick={() => setUploadModalOpen(true)}>
              <Upload size={13} strokeWidth={2} />
              Upload
            </Button>

            {/* Segmented view control — one hairline frame, two states. */}
            <div className="flex overflow-hidden rounded-md border border-border-default">
              <button
                type="button"
                onClick={() => setFileViewMode('grid')}
                aria-label="Grid view"
                aria-pressed={fileViewMode === 'grid'}
                className={`p-1.5 transition-colors duration-150 ${
                  fileViewMode === 'grid'
                    ? 'bg-card-hover text-accent-light'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <LayoutGrid size={14} strokeWidth={1.8} />
              </button>

              <span aria-hidden="true" className="w-px bg-border-default" />

              <button
                type="button"
                onClick={() => setFileViewMode('list')}
                aria-label="List view"
                aria-pressed={fileViewMode === 'list'}
                className={`p-1.5 transition-colors duration-150 ${
                  fileViewMode === 'list'
                    ? 'bg-card-hover text-accent-light'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <List size={14} strokeWidth={1.8} />
              </button>
            </div>
          </>
        }
        title="Sort by"
        meta={
          <span className="flex items-center gap-3">
            {(['name', 'sizeBytes', 'createdAt'] as SortField[]).map((field) => (
              <button
                key={field}
                type="button"
                onClick={() => toggleSort(field)}
                aria-pressed={sortField === field}
                className={`inline-flex items-center gap-1 transition-colors duration-150 ${
                  sortField === field
                    ? 'text-accent-light'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {SORT_LABELS[field]}
                {sortField === field &&
                  (sortDirection === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
              </button>
            ))}
          </span>
        }
      >
        {isEmpty && (
          <div className="px-4 py-14 text-center">
            <p className="num text-sm text-text-dim">—</p>
            <p className="mt-2 text-[13px] text-text-muted">This folder is empty.</p>
          </div>
        )}

        {!isEmpty && fileViewMode === 'grid' && (
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-5">
            {filesData?.map((file) => (
              <div
                key={file.id}
                className={`group relative rounded-lg border p-3 transition-colors duration-150 ${
                  selectedIds.has(file.id)
                    ? 'border-accent bg-accent/[0.06]'
                    : 'border-border-subtle bg-surface hover:border-border-bright hover:bg-card-hover'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(file.id)}
                  onChange={() => toggleSelect(file.id)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Select ${file.name}`}
                  className="absolute top-2.5 right-2.5 h-3.5 w-3.5 accent-accent"
                />

                <div className="flex flex-col items-center gap-2.5 py-3">
                  <FileIcon nodeType={file.nodeType} mimeType={file.mimeType} size={22} />

                  <button
                    type="button"
                    className="w-full truncate px-1 text-center text-xs text-text-primary transition-colors duration-150 hover:text-accent-light"
                    onClick={(e) => handleFileNameClick(e, file)}
                  >
                    {file.name}
                  </button>
                </div>

                {/* Machine facts on a hairline foot. */}
                <div className="flex items-center justify-between gap-2 border-t border-border-subtle pt-2.5">
                  <span className="num truncate text-[10px] text-text-dim">
                    {formatFileSize(file.sizeBytes)}
                  </span>

                  {file.nodeType === 'FILE' && (
                    <button
                      type="button"
                      onClick={(e) => handleVersionClick(e, file)}
                      className="num shrink-0 text-[10px] text-text-dim transition-colors duration-150 hover:text-accent-light"
                      aria-label={`Version history for ${file.name}`}
                    >
                      v{file.versionCount ?? 1}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {!isEmpty && fileViewMode === 'list' && (
          <div>
            {/* Column headers, so the mono columns to the right have meaning. */}
            <div className="flex items-center gap-3 border-b border-border-default bg-surface px-4 py-2">
              <span className="w-3.5 shrink-0" aria-hidden="true" />
              <span className="w-4 shrink-0" aria-hidden="true" />
              <span className="col-label flex-1">Name</span>
              <span className="col-label hidden w-20 text-right sm:block">Size</span>
              <span className="col-label w-24 text-right">Date</span>
              <span className="col-label w-8 text-right">Ver</span>
            </div>

            <div className="divide-y divide-border-subtle">
              {filesData?.map((file) => (
                <div
                  key={file.id}
                  className={`flex items-center gap-3 px-4 py-2.5 transition-colors duration-150 ${
                    selectedIds.has(file.id)
                      ? 'bg-accent/[0.06]'
                      : 'hover:bg-card-hover'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(file.id)}
                    onChange={() => toggleSelect(file.id)}
                    aria-label={`Select ${file.name}`}
                    className="h-3.5 w-3.5 shrink-0 accent-accent"
                  />

                  <FileIcon nodeType={file.nodeType} mimeType={file.mimeType} />

                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left text-[13px] text-text-primary transition-colors duration-150 hover:text-accent-light"
                    onClick={(e) => handleFileNameClick(e, file)}
                  >
                    {file.name}
                  </button>

                  <span className="num hidden w-20 shrink-0 text-right text-[11px] text-text-dim sm:block">
                    {formatFileSize(file.sizeBytes)}
                  </span>

                  <span className="num w-24 shrink-0 text-right text-[11px] text-text-dim">
                    {new Date(file.createdAt).toLocaleDateString()}
                  </span>

                  {file.nodeType === 'FILE' ? (
                    <button
                      type="button"
                      onClick={(e) => handleVersionClick(e, file)}
                      className="num w-8 shrink-0 text-right text-[11px] text-text-dim transition-colors duration-150 hover:text-accent-light"
                      aria-label={`Version history for ${file.name}`}
                    >
                      v{file.versionCount ?? 1}
                    </button>
                  ) : (
                    <span className="num w-8 shrink-0 text-right text-[11px] text-text-dim">—</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </Panel>

      <BulkActionBar
        selectedCount={selectedIds.size}
        onDelete={handleBulkDelete}
        onTag={() => setTagModalOpen(true)}
        onClear={() => setSelectedIds(new Set())}
      />

      <TagModal
        isOpen={tagModalOpen}
        onClose={() => setTagModalOpen(false)}
        onConfirm={handleBulkTag}
        isSubmitting={bulkTag.isPending}
      />

      <UploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        departmentId={deptId}
        parentId={parentId}
      />

      <VersionHistoryPanel
        fileId={versionPanelFile?.id ?? null}
        fileName={versionPanelFile?.name ?? ''}
        onClose={() => setVersionPanelFile(null)}
      />

      <FilePreviewModal
        file={previewFile}
        onClose={() => setPreviewFile(null)}
      />
    </div>
  )
}
