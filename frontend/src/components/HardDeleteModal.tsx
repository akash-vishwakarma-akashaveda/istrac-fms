import { useState } from 'react'
import { HardDrive, Database, Flame, ShieldAlert, Check } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Modal, Button } from '.'
import { filesApi } from '../api/files.api'
import { useToastStore } from '../store/toastStore'
import { formatFileSize } from '../lib/formatFileSize'

export type HardDeleteMode = 'BOTH' | 'STORAGE_ONLY' | 'DATABASE_ONLY'

interface HardDeleteModalProps {
  isOpen: boolean
  file: {
    id: string
    name: string
    sizeBytes?: string | number | bigint
    department?: { name?: string | null; code?: string | null } | null
    report?: { spacecraft?: string | null } | null
    versionCount?: number
  } | null
  onClose: () => void
  onSuccess: () => void
}

export function HardDeleteModal({ isOpen, file, onClose, onSuccess }: HardDeleteModalProps) {
  const queryClient = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  const [mode, setMode] = useState<HardDeleteMode>('BOTH')
  const [confirmed, setConfirmed] = useState(false)
  const [loading, setLoading] = useState(false)

  if (!file) return null

  const sizeStr = formatFileSize(Number(file.sizeBytes) || 0)

  async function handleExecute() {
    if (!file || !confirmed) return
    setLoading(true)
    try {
      const res = await filesApi.hardDeleteFile(file.id, mode)
      queryClient.invalidateQueries({ queryKey: ['admin-files'] })
      queryClient.invalidateQueries({ queryKey: ['dept-files'] })
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
      queryClient.invalidateQueries({ queryKey: ['mission-overview'] })
      queryClient.invalidateQueries({ queryKey: ['recent-files'] })
      queryClient.invalidateQueries({ queryKey: ['user-departments'] })
      queryClient.invalidateQueries({ queryKey: ['featured-reports'] })
      queryClient.invalidateQueries({ queryKey: ['file-versions'] })
      queryClient.invalidateQueries({ queryKey: ['file-detail'] })

      addToast({
        title: 'Permanent Deletion Completed',
        message: res.message || `File "${file.name}" has been processed.`,
        variant: 'success',
      })
      setConfirmed(false)
      onSuccess()
      onClose()
    } catch (err: any) {
      addToast({
        title: 'Hard Delete Failed',
        message: err.response?.data?.error?.message || err.message || 'Could not permanently delete file',
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Permanent Hard Delete"
      size="md"
    >
      <div className="space-y-4">
        {/* Warning Banner */}
        <div className="flex items-start gap-3 p-3 rounded-lg border border-red-500/30 bg-red-950/20 text-red-200">
          <div className="p-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 shrink-0">
            <ShieldAlert size={20} />
          </div>
          <div className="text-xs space-y-1">
            <h4 className="font-bold text-red-300 text-sm">Irreversible Administrative Action</h4>
            <p className="text-text-secondary leading-relaxed">
              Hard deletion permanently purges datasets. Unlike moving to Trash, this action cannot be undone. Select your intended deletion scope below.
            </p>
          </div>
        </div>

        {/* Target File Summary Card */}
        <div className="rounded-lg border border-border-default bg-[#070d18] p-3 text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-text-dim uppercase tracking-wider">Target File</span>
            <span className="font-mono text-[11px] text-accent-light">{sizeStr}</span>
          </div>
          <div className="font-bold text-white text-sm truncate" title={file.name}>
            {file.name}
          </div>
          <div className="flex flex-wrap gap-2 pt-1 text-[11px] text-text-muted">
            <span>Dept: <strong className="text-text-primary">{file.department?.code || file.department?.name || '—'}</strong></span>
            <span>•</span>
            <span>Spacecraft: <strong className="text-text-primary">{file.report?.spacecraft || '—'}</strong></span>
            <span>•</span>
            <span>Versions: <strong className="text-text-primary">{file.versionCount || 1}</strong></span>
          </div>
        </div>

        {/* 3 Scope Options */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-text-dim block">
            Select Deletion Scope
          </label>

          {/* Option 1: BOTH */}
          <div
            onClick={() => setMode('BOTH')}
            className={`cursor-pointer rounded-xl border p-3 transition-all ${
              mode === 'BOTH'
                ? 'border-red-500 bg-red-950/25 ring-1 ring-red-500/40'
                : 'border-border-default bg-surface hover:border-red-500/40'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-md ${mode === 'BOTH' ? 'bg-red-500/20 text-red-400' : 'bg-surface-elevated text-text-muted'}`}>
                  <Flame size={16} />
                </div>
                <div>
                  <div className="font-bold text-white text-xs flex items-center gap-2">
                    <span>Full Purge (Database & Storage HDD)</span>
                    <span className="rounded bg-red-500/20 text-red-300 border border-red-500/40 px-1.5 py-0.2 text-[9px] font-mono">
                      RECOMMENDED
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Completely destroys the physical file bytes from disk to free storage AND removes all catalog records from the database.
                  </p>
                </div>
              </div>
              <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors mt-0.5 ${
                mode === 'BOTH' ? 'border-red-500 bg-red-500 text-black' : 'border-border-default'
              }`}>
                {mode === 'BOTH' && <Check size={10} className="stroke-[3]" />}
              </div>
            </div>
          </div>

          {/* Option 2: STORAGE_ONLY */}
          <div
            onClick={() => setMode('STORAGE_ONLY')}
            className={`cursor-pointer rounded-xl border p-3 transition-all ${
              mode === 'STORAGE_ONLY'
                ? 'border-amber-500 bg-amber-950/25 ring-1 ring-amber-500/40'
                : 'border-border-default bg-surface hover:border-amber-500/40'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-md ${mode === 'STORAGE_ONLY' ? 'bg-amber-500/20 text-amber-400' : 'bg-surface-elevated text-text-muted'}`}>
                  <HardDrive size={16} />
                </div>
                <div>
                  <div className="font-bold text-white text-xs flex items-center gap-2">
                    <span>Storage HDD Only (Reclaim Disk Space)</span>
                    <span className="rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 text-[9px] font-mono">
                      FREE STORAGE
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Deletes physical binary bytes from the hard drive to free disk capacity, while preserving metadata and SHA-256 for audit history.
                  </p>
                </div>
              </div>
              <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors mt-0.5 ${
                mode === 'STORAGE_ONLY' ? 'border-amber-500 bg-amber-500 text-black' : 'border-border-default'
              }`}>
                {mode === 'STORAGE_ONLY' && <Check size={10} className="stroke-[3]" />}
              </div>
            </div>
          </div>

          {/* Option 3: DATABASE_ONLY */}
          <div
            onClick={() => setMode('DATABASE_ONLY')}
            className={`cursor-pointer rounded-xl border p-3 transition-all ${
              mode === 'DATABASE_ONLY'
                ? 'border-blue-500 bg-blue-950/25 ring-1 ring-blue-500/40'
                : 'border-border-default bg-surface hover:border-blue-500/40'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-md ${mode === 'DATABASE_ONLY' ? 'bg-blue-500/20 text-blue-400' : 'bg-surface-elevated text-text-muted'}`}>
                  <Database size={16} />
                </div>
                <div>
                  <div className="font-bold text-white text-xs flex items-center gap-2">
                    <span>Database Record Only (Unregister Catalog)</span>
                    <span className="rounded bg-blue-500/20 text-blue-300 border border-blue-500/40 px-1.5 py-0.2 text-[9px] font-mono">
                      KEEP DISK
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Deletes metadata and version records from the database, while leaving the raw binary file intact on physical storage.
                  </p>
                </div>
              </div>
              <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors mt-0.5 ${
                mode === 'DATABASE_ONLY' ? 'border-blue-500 bg-blue-500 text-black' : 'border-border-default'
              }`}>
                {mode === 'DATABASE_ONLY' && <Check size={10} className="stroke-[3]" />}
              </div>
            </div>
          </div>
        </div>

        {/* Confirmation Checkbox */}
        <label className="flex items-start gap-2.5 p-3 rounded-lg border border-border-default bg-surface/50 cursor-pointer text-xs select-none">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 rounded border-border-default text-red-500 focus:ring-red-500/50"
          />
          <span className="text-text-secondary leading-normal">
            I confirm that I understand this deletion is <strong className="text-red-400">permanent and non-recoverable</strong>. This action will be recorded in the security audit logs.
          </span>
        </label>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={handleExecute}
            disabled={!confirmed || loading}
          >
            {loading ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <span>Deleting Permanently…</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <Flame size={14} />
                <span>Execute Hard Delete</span>
              </span>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
