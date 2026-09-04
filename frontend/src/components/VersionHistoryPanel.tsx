import { useState } from 'react'
import {
  X,
  Download,
  Loader2,
  Upload,
  Eye,
  Layers,
  FileText,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useFileVersions } from '../hooks/useFileVersions'
import { formatFileSize } from '../lib/formatFileSize'
import { formatDateTimeIST } from '../lib/formatDate'
import { api } from '../lib/axios'
import { filesApi } from '../api/files.api'
import { useAuthStore } from '../store/authStore'
import { useToastStore } from '../store/toastStore'
import { FilePreviewModal } from './FilePreviewModal'

export interface VersionHistoryFileDetails {
  id?: string
  name?: string
  title?: string | null
  description?: string | null
  departmentId?: string
  departmentName?: string
  departmentCode?: string
  spacecraft?: string | null
  category?: string | null
  classificationLevel?: string | null
  sizeBytes?: number | string | null
  sha256?: string | null
  createdAt?: string
  uploader?: string | null
  uploaderName?: string | null
  versionCount?: number
  versionLabel?: string | null
  extension?: string | null
  mimeType?: string | null
}

interface VersionHistoryPanelProps {
  fileId: string | null
  fileName: string
  fileDetails?: VersionHistoryFileDetails | null
  canWrite?: boolean
  onClose: () => void
  onOpenUploadVersion?: () => void
  onPreview?: (file: { id: string; name: string; mimeType?: string | null; sizeBytes?: number | null }) => void
}

/**
 * Slide-over log of a file's revisions.
 * Clean, compact dataset card with instant preview and download for each version.
 */
export function VersionHistoryPanel({
  fileId,
  fileName,
  fileDetails,
  canWrite = false,
  onClose,
  onOpenUploadVersion,
  onPreview,
}: VersionHistoryPanelProps) {
  const user = useAuthStore((state) => state.user)
  const isAdmin = user?.role === 'ADMIN'
  const queryClient = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  const { data, isLoading } = useFileVersions(fileId)
  const versions = Array.isArray(data) ? data : data?.versions || []
  const fetchedFile = !Array.isArray(data) ? data?.file : null

  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [previewTarget, setPreviewTarget] = useState<{
    id: string
    name: string
    mimeType: string | null
    sizeBytes: number | null
  } | null>(null)

  const isOpen = fileId !== null

  // Merge parent fileDetails with backend fetchedFile
  const effectiveFile: VersionHistoryFileDetails = {
    ...fetchedFile,
    ...fileDetails,
    name: fileName || fileDetails?.name || fetchedFile?.name || 'DATASET',
    title:
      fileDetails?.title ||
      fetchedFile?.title ||
      fileName.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
    spacecraft: fileDetails?.spacecraft || fetchedFile?.spacecraft || 'General',
    category: fileDetails?.category || fetchedFile?.category || 'DAILY_REPORT',
    uploader:
      fileDetails?.uploader ||
      fileDetails?.uploaderName ||
      fetchedFile?.uploaderName ||
      'Authorized Officer',
    sizeBytes: fileDetails?.sizeBytes ?? fetchedFile?.sizeBytes ?? versions[0]?.sizeBytes ?? 0,
    createdAt: fileDetails?.createdAt || fetchedFile?.createdAt || versions[0]?.createdAt,
    sha256: fileDetails?.sha256 || fetchedFile?.sha256 || versions[0]?.sha256,
    description: fileDetails?.description || fetchedFile?.description || '',
    departmentCode: fileDetails?.departmentCode || fetchedFile?.departmentCode,
    departmentName: fileDetails?.departmentName || fetchedFile?.departmentName,
    classificationLevel: fileDetails?.classificationLevel || fetchedFile?.classificationLevel || 'RESTRICTED',
  }

  const fileExtension = (
    effectiveFile.extension ||
    effectiveFile.name?.split('.').pop() ||
    'FILE'
  ).toUpperCase()

  const handleOpenPreview = (target: {
    id: string
    name: string
    mimeType?: string | null
    sizeBytes?: number | string | null
    downloadUrl?: string
  }) => {
    const formatted = {
      id: target.id,
      name: target.name || 'DATASET',
      mimeType: target.mimeType ?? null,
      sizeBytes: typeof target.sizeBytes === 'number' ? target.sizeBytes : null,
      downloadUrl: target.downloadUrl,
    }
    if (onPreview) {
      onPreview(formatted)
    } else {
      setPreviewTarget(formatted)
    }
  }

  async function handleDownload(versionId: string, downloadName?: string | null) {
    if (!fileId || downloadingId) return

    setDownloadingId(versionId)

    try {
      const response = await api.get(
        `/files/${fileId}/versions/${versionId}/download`,
        {
          responseType: 'blob',
        },
      )

      const targetFilename = downloadName || fileName
      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.download = targetFilename
      document.body.appendChild(link)
      link.click()
      link.remove()

      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error: any) {
      console.error('Failed to download file version:', error)
      const msg = error?.response?.data?.message || 'Failed to download file version'
      addToast({ message: msg, variant: 'error' })
    } finally {
      setDownloadingId(null)
    }
  }

  async function handleToggleVisibility(versionId: string, currentVisible: boolean, label: string) {
    if (!fileId || togglingId) return

    setTogglingId(versionId)
    const newVisibility = !currentVisible

    try {
      await filesApi.toggleVersionVisibility(fileId, versionId, newVisibility)
      await queryClient.invalidateQueries({ queryKey: ['file-versions', fileId] })
      await queryClient.invalidateQueries({ queryKey: ['dept-files'] })

      addToast({
        message: `Version ${label} is now ${newVisibility ? 'visible' : 'hidden'} to members`,
        variant: 'success',
      })
    } catch (err: any) {
      console.error('Failed to toggle version visibility:', err)
      const msg = err?.response?.data?.message || 'Failed to change visibility'
      addToast({ message: msg, variant: 'error' })
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-page/85 backdrop-blur-[2px] transition-opacity duration-300 ${
          isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Slide-over Panel */}
      <div
        role="dialog"
        aria-label="Version history"
        aria-hidden={!isOpen}
        className={`fixed top-0 right-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border-default bg-[#070d19] transition-transform duration-300 shadow-2xl ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border-subtle bg-surface px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md border border-accent/30 bg-accent/10 text-accent-light">
              <Layers size={15} />
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-text-primary">
                Version History
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-text-muted transition-colors hover:bg-card-hover hover:text-white cursor-pointer"
            aria-label="Close version history"
          >
            <X size={16} strokeWidth={1.8} />
          </button>
        </header>

        {/* DATASET OVERVIEW - SIMPLE COMPACT CARD */}
        <div className="p-3.5 border-b border-border-subtle bg-[#0a1224]/90 space-y-2.5 shrink-0">
          <div className="flex items-start justify-between gap-2.5">
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="rounded bg-accent/15 border border-accent/30 px-1.5 py-0.2 text-[9px] font-bold text-accent-light uppercase">
                  {fileExtension}
                </span>

                {effectiveFile.spacecraft && effectiveFile.spacecraft !== 'General' && (
                  <span className="rounded bg-sky-500/15 border border-sky-500/30 px-1.5 py-0.2 text-[9px] font-bold text-sky-300">
                    {effectiveFile.spacecraft}
                  </span>
                )}

                {effectiveFile.departmentCode && (
                  <span className="rounded bg-purple-500/15 border border-purple-500/30 px-1.5 py-0.2 text-[9px] font-bold text-purple-300">
                    {effectiveFile.departmentCode}
                  </span>
                )}
              </div>

              <h3 className="text-xs sm:text-sm font-bold text-white leading-tight truncate" title={effectiveFile.title || undefined}>
                {effectiveFile.title}
              </h3>

              <p className="font-mono text-[10px] text-text-dim truncate" title={effectiveFile.name || ''}>
                {effectiveFile.name}
              </p>
            </div>

            {/* Quick Actions: Preview & Upload */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() =>
                  handleOpenPreview({
                    id: effectiveFile.id || fileId || '',
                    name: effectiveFile.name || 'DATASET',
                    mimeType: effectiveFile.mimeType,
                    sizeBytes: Number(effectiveFile.sizeBytes) || null,
                  })
                }
                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border-default bg-surface text-text-secondary hover:border-accent hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                title="Preview this file"
              >
                <Eye size={12} className="text-accent-light" />
                <span>Preview</span>
              </button>

              {canWrite && onOpenUploadVersion && (
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    onOpenUploadVersion()
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded border border-accent bg-accent text-white hover:bg-accent-hover text-xs font-bold transition-colors cursor-pointer shadow-sm"
                  title="Upload a new version"
                >
                  <Upload size={11} />
                  <span>Upload</span>
                </button>
              )}
            </div>
          </div>

          {/* Clean metadata summary line */}
          <div className="flex items-center gap-2 text-[10px] text-text-dim font-mono border-t border-border-subtle/50 pt-2 flex-wrap">
            <span>By <strong className="text-text-secondary font-sans">{effectiveFile.uploader}</strong></span>
            <span>•</span>
            <span>{formatDateTimeIST(effectiveFile.createdAt)}</span>
            <span>•</span>
            <span className="text-white font-semibold">{formatFileSize(Number(effectiveFile.sizeBytes) || 0)}</span>
            <span>•</span>
            <span className="text-accent-light font-bold">{versions.length || 1} Revisions</span>
          </div>
        </div>

        {/* Versions List */}
        <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-2.5">
          <div className="flex items-center justify-between text-[10px] font-bold text-text-dim uppercase tracking-wider">
            <span>Historical Versions ({versions.length})</span>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center p-8 text-xs text-text-dim gap-2">
              <Loader2 size={13} className="animate-spin text-accent-light" />
              <span>Loading versions…</span>
            </div>
          )}

          {!isLoading && (!versions || versions.length === 0) && (
            <div className="px-4 py-10 text-center rounded-xl border border-dashed border-border-subtle">
              <p className="num text-sm text-text-dim">—</p>
              <p className="mt-1 text-xs text-text-muted">No revision history found.</p>
            </div>
          )}

          <div className="space-y-2">
            {versions?.map((version, index) => {
              const isDownloading = downloadingId === version.id
              const isToggling = togglingId === version.id
              const isLatest = index === 0

              const verFileName = version.name || effectiveFile.name || fileName || 'File'

              return (
                <div
                  key={version.id}
                  className={`rounded-xl border p-3 space-y-2 transition-colors ${
                    isLatest
                      ? 'border-accent/40 bg-accent/[0.04]'
                      : 'border-border-subtle bg-surface/50 hover:border-border-default'
                  }`}
                >
                  {/* Version Badge & Quick Actions */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="rounded bg-accent/20 border border-accent/40 px-2 py-0.5 text-xs font-mono font-bold text-accent-light num">
                        {version.versionLabel || `V${version.versionNum}.0`}
                      </span>

                      <span className="text-[10px] font-mono text-text-dim">
                        rev.{version.versionNum}
                      </span>

                      {isLatest && (
                        <span className="text-[8px] font-bold uppercase tracking-wider px-1 py-0.2 rounded bg-nominal/15 text-nominal border border-nominal/30">
                          Latest
                        </span>
                      )}

                      {!version.isVisible && (
                        <span className="text-[8px] font-bold uppercase px-1 py-0.2 rounded bg-warning/15 text-warning border border-warning/30">
                          Hidden
                        </span>
                      )}
                    </div>

                    {/* Actions: Preview & Download */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenPreview({
                            id: version.id,
                            name: verFileName,
                            mimeType: version.mimeType || effectiveFile.mimeType,
                            sizeBytes: version.sizeBytes,
                            downloadUrl: `/files/${fileId}/versions/${version.id}/download`,
                          })
                        }
                        className="p-1 rounded border border-border-subtle bg-surface text-text-muted hover:border-accent hover:text-white transition-colors cursor-pointer"
                        title="Preview this version"
                      >
                        <Eye size={12} className="text-accent-light" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDownload(version.id, verFileName)}
                        disabled={downloadingId !== null}
                        className="p-1 rounded border border-border-subtle bg-surface text-text-muted hover:border-nominal hover:text-nominal transition-colors disabled:opacity-40 cursor-pointer"
                        title="Download this version"
                      >
                        {isDownloading ? (
                          <Loader2 size={12} className="animate-spin text-nominal" />
                        ) : (
                          <Download size={12} />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Version Filename - Always shown clearly */}
                  <div className="flex items-center gap-1.5 min-w-0" title={verFileName}>
                    <FileText size={12} className="text-accent-light shrink-0" />
                    <span className="text-[11px] font-mono font-medium text-white truncate">
                      {verFileName}
                    </span>
                  </div>

                  {/* Metadata line: Officer • Date • Size */}
                  <div className="flex items-center gap-1.5 text-[10px] text-text-dim font-mono flex-wrap">
                    <span className="text-text-secondary font-sans">{version.uploaderName || version.uploadedBy}</span>
                    <span>•</span>
                    <span>{formatDateTimeIST(version.createdAt)}</span>
                    <span>•</span>
                    <span className="text-white font-semibold">{formatFileSize(version.sizeBytes)}</span>
                  </div>

                  {/* Notes if provided */}
                  {version.changeLog && (
                    <div className="text-[11px] text-text-secondary bg-surface/60 border border-border-subtle/50 px-2 py-1 rounded leading-relaxed">
                      <span className="text-[9px] font-bold text-text-dim uppercase mr-1">Notes:</span>
                      {version.changeLog}
                    </div>
                  )}

                  {/* Checkbox (Admin Only) */}
                  {isAdmin && (
                    <div className="pt-1.5 border-t border-border-subtle/40 flex items-center justify-between">
                      <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-text-secondary hover:text-white select-none">
                        <input
                          type="checkbox"
                          checked={version.isVisible}
                          disabled={isToggling}
                          onChange={() =>
                            handleToggleVisibility(
                              version.id,
                              version.isVisible,
                              version.versionLabel || `v${version.versionNum}`
                            )
                          }
                          className="h-3 w-3 rounded border-border-default text-accent focus:ring-accent accent-accent cursor-pointer"
                        />
                        <span>{version.isVisible ? 'Show to regular members' : 'Hidden from regular members'}</span>
                      </label>
                      {isToggling && <Loader2 size={10} className="animate-spin text-accent-light" />}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-border-subtle bg-surface px-3 py-2 text-center shrink-0">
          <p className="text-[10px] text-text-dim font-mono">
            Cryptographically sealed revision tree
          </p>
        </footer>
      </div>

      {/* Internal Preview Modal fallback */}
      <FilePreviewModal
        file={previewTarget}
        onClose={() => setPreviewTarget(null)}
      />
    </>
  )
}
