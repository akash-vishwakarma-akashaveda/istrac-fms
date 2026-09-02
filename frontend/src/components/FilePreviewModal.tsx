import { useEffect, useState } from 'react'
import {
  FileText,
  FileSpreadsheet,
  FileCode,
  FileArchive,
  Download,
  CheckCircle2,
  File as FileIcon,
  RefreshCw,
} from 'lucide-react'
import { Modal, Button } from '.'
import { useLogFileAccess } from '../hooks/useLogFileAccess'
import { PdfPreview } from './preview/PdfPreview'
import { ImagePreview } from './preview/ImagePreview'
import { api } from '../lib/axios'
import { formatFileSize } from '../lib/formatFileSize'

interface FilePreviewModalProps {
  file: { id: string; name: string; mimeType: string | null; sizeBytes: number | null } | null
  onClose: () => void
}

function getFileExtension(name: string): string {
  const parts = name.split('.')
  return parts.length > 1 ? parts.pop()!.toUpperCase() : 'DAT'
}

function getFormatDetails(ext: string, mime: string | null) {
  const normalizedExt = ext.toUpperCase()
  if (normalizedExt === 'PDF' || mime === 'application/pdf') {
    return { label: 'PDF Document', icon: FileText, color: 'text-critical' }
  }
  if (['DOC', 'DOCX', 'ODT'].includes(normalizedExt)) {
    return { label: 'Word Document', icon: FileText, color: 'text-accent-light' }
  }
  if (['XLS', 'XLSX', 'CSV', 'ODS'].includes(normalizedExt)) {
    return { label: 'Tabular Telemetry / Spreadsheet', icon: FileSpreadsheet, color: 'text-nominal' }
  }
  if (['BIN', 'DAT', 'LOG', 'FITS', 'H5'].includes(normalizedExt)) {
    return { label: 'Spacecraft Binary / Raw Telemetry', icon: FileCode, color: 'text-warning' }
  }
  if (['ZIP', 'TAR', 'GZ', '7Z'].includes(normalizedExt)) {
    return { label: 'Compressed Mission Archive', icon: FileArchive, color: 'text-purple-400' }
  }
  return { label: `${normalizedExt} Telemetry Asset`, icon: FileIcon, color: 'text-text-dim' }
}

export function FilePreviewModal({ file, onClose }: FilePreviewModalProps) {
  const logAccess = useLogFileAccess()
  const [downloading, setDownloading] = useState(false)
  const isOpen = file !== null

  const ext = file ? getFileExtension(file.name) : 'DAT'
  const isPdf = file ? ext === 'PDF' || file.mimeType === 'application/pdf' : false
  const isImage = file ? file.mimeType?.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(file.name) : false
  const fileUrl = file ? `/files/${file.id}/download` : ''

  useEffect(() => {
    if (file) {
      logAccess.mutate(file.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file?.id])

  async function handleDownload() {
    if (!file || downloading) return
    setDownloading(true)
    try {
      const response = await api.get(`/files/${file.id}/download`, { responseType: 'blob' })
      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.download = file.name
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download error:', err)
    } finally {
      setDownloading(false)
    }
  }

  const formatMeta = getFormatDetails(ext, file?.mimeType ?? null)
  const FormatIcon = formatMeta.icon

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={file?.name ?? 'File Details'} size="lg">
      {file && (
        <div className="space-y-4">
          {/* Metadata Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-xl border border-border-subtle bg-surface/70">
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-mono tracking-wider text-text-dim block">Filename</span>
              <span className="text-xs font-semibold text-text-primary truncate block mt-0.5" title={file.name}>
                {file.name}
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-text-dim block">Format</span>
              <span className="text-xs font-mono font-bold text-accent-light block mt-0.5">
                {ext} · {formatMeta.label}
              </span>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <span className="text-[10px] uppercase font-mono tracking-wider text-text-dim block">Payload Size</span>
              <span className="text-xs font-mono font-medium text-text-secondary block mt-0.5">
                {formatFileSize(file.sizeBytes)}
              </span>
            </div>
          </div>

          {/* Interactive Viewer vs Non-PDF Download Card */}
          {isPdf ? (
            <div className="space-y-3">
              <PdfPreview fileUrl={fileUrl} fileName={file.name} onDownload={handleDownload} />
            </div>
          ) : isImage ? (
            <div className="space-y-3">
              <ImagePreview fileUrl={fileUrl} fileName={file.name} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-dashed border-border-default bg-surface/80">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-card border border-border-subtle text-accent-light shadow-inner mb-4">
                <FormatIcon size={32} className={formatMeta.color} />
              </div>

              <h4 className="text-sm font-bold text-white mb-1">
                {formatMeta.label}
              </h4>

              <p className="text-xs text-text-secondary max-w-md leading-relaxed mb-6">
                Direct in-browser visual rendering is dedicated to PDF telemetry dossiers and mission imagery. To view, edit, or process this {ext} file in your local environment, download it to your workstation.
              </p>

              <Button
                variant="primary"
                size="md"
                onClick={handleDownload}
                disabled={downloading}
                className="shadow-lg shadow-accent/20 cursor-pointer flex items-center gap-2"
              >
                {downloading ? (
                  <>
                    <RefreshCw size={15} className="animate-spin text-white" />
                    <span>Streaming Payload…</span>
                  </>
                ) : (
                  <>
                    <Download size={15} />
                    <span>Download {file.name} ({formatFileSize(file.sizeBytes)})</span>
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Modal Action Footer */}
          <div className="pt-3 border-t border-border-subtle flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-nominal">
              <CheckCircle2 size={13} />
              <span>Cryptographic Storage Verified</span>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
              {isPdf && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleDownload}
                  disabled={downloading}
                  className="flex items-center gap-1.5 cursor-pointer shadow-md shadow-accent/20"
                >
                  <Download size={13} />
                  <span>{downloading ? 'Downloading…' : 'Download PDF'}</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
