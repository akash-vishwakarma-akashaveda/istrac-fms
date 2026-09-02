import { useState, useEffect } from 'react'
import {
  HardDrive,
  Search,
  Download,
  Trash2,
  Edit2,
  Megaphone,
  History,
  Eye,
  FileText,
  FileCode,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Upload,
  Copy,
  Check,
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiClient } from '../api/client'
import { useAdminDepartments } from '../hooks/useDepartments'
import { satellitesApi, type Satellite } from '../api/satellites.api'
import { useToastStore } from '../store/toastStore'
import { PageHeader, Button, Modal, Textarea } from '../components'
import { VersionHistoryPanel } from '../components/VersionHistoryPanel'
import { FilePreviewModal } from '../components/FilePreviewModal'
import { formatFileSize } from '../lib/formatFileSize'
import type { FileNode } from '../types/file'

interface AdminFileRecord {
  id: string
  name: string
  nodeType: string
  extension: string
  sizeBytes: string
  sha256: string
  versionCount: number
  status: string
  description?: string | null
  hddPath: string
  department: {
    id: string
    name: string
    code: string
    satellite?: { id: string; name: string; code?: string | null } | null
  }
  report?: {
    id: string
    title: string
    category: string
    spacecraft?: string | null
    classificationLevel?: string | null
  } | null
  uploader?: {
    id: string
    name: string
    email: string
  } | null
  latestVersion?: {
    id: string
    versionNum: number
    sizeBytes: string
    sha256: string
    createdAt: string
  } | null
  createdAt: string
  updatedAt: string
}

const EXT_CONFIG: Record<string, { label: string; badge: string; icon: typeof FileText }> = {
  BIN: { label: 'BIN', badge: 'bg-accent/15 text-accent-light border-accent/30', icon: FileCode },
  DAT: { label: 'DAT', badge: 'bg-nominal/15 text-nominal border-nominal/30', icon: FileCode },
  PDF: { label: 'PDF', badge: 'bg-critical/15 text-critical border-critical/30', icon: FileText },
  CSV: { label: 'CSV', badge: 'bg-warning/15 text-warning border-warning/30', icon: FileSpreadsheet },
  LOG: { label: 'LOG', badge: 'bg-purple-400/15 text-purple-400 border-purple-400/30', icon: FileText },
}

export function AdminFileManager() {
  const addToast = useToastStore((s) => s.addToast)
  const [searchParams, setSearchParams] = useSearchParams()
  const deptIdParam = searchParams.get('deptId')

  const { data: departments } = useAdminDepartments()

  const [files, setFiles] = useState<AdminFileRecord[]>([])
  const [satellites, setSatellites] = useState<Satellite[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedDept, setSelectedDept] = useState(deptIdParam || 'ALL')
  const [selectedExt, setSelectedExt] = useState('ALL')
  const [selectedSat, setSelectedSat] = useState('ALL')

  useEffect(() => {
    if (deptIdParam && deptIdParam !== selectedDept) {
      setSelectedDept(deptIdParam)
    }
  }, [deptIdParam])

  // Modals
  const [versionPanelFile, setVersionPanelFile] = useState<{ id: string; name: string } | null>(null)
  const [previewFile, setPreviewFile] = useState<FileNode | null>(null)
  const [editingFile, setEditingFile] = useState<AdminFileRecord | null>(null)
  const [deletingFile, setDeletingFile] = useState<AdminFileRecord | null>(null)
  const [broadcastingFile, setBroadcastingFile] = useState<AdminFileRecord | null>(null)

  // Edit Metadata Form State
  const [editForm, setEditForm] = useState({
    name: '',
    title: '',
    description: '',
    spacecraft: '',
    category: 'DAILY_REPORT',
    classificationLevel: 'RESTRICTED',
    broadcastAlert: false,
    broadcastMessage: '',
  })
  const [savingEdit, setSavingEdit] = useState(false)

  // Quick Broadcast Form State
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [broadcastUrgency, setBroadcastUrgency] = useState('NORMAL')
  const [broadcasting, setBroadcasting] = useState(false)

  // Delete Action State
  const [deleting, setDeleting] = useState(false)

  // Copy hash state
  const [copiedHashId, setCopiedHashId] = useState<string | null>(null)

  const fetchFiles = async () => {
    setLoading(true)
    try {
      const [filesRes, satsRes] = await Promise.all([
        apiClient.get('/admin/files', {
          params: {
            search: search || undefined,
            departmentId: selectedDept !== 'ALL' ? selectedDept : undefined,
            satelliteId: selectedSat !== 'ALL' ? selectedSat : undefined,
            extension: selectedExt !== 'ALL' ? selectedExt : undefined,
          },
        }),
        satellitesApi.getAllAdminSatellites().catch(() => []),
      ])

      if (filesRes.data?.data) {
        setFiles(filesRes.data.data)
      }
      setSatellites(satsRes || [])
    } catch {
      addToast({ title: 'Error', message: 'Failed to load master file repository', variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFiles()
  }, [search, selectedDept, selectedExt, selectedSat])

  // Open Edit Metadata Modal
  const handleOpenEdit = (file: AdminFileRecord) => {
    setEditingFile(file)
    setEditForm({
      name: file.name,
      title: file.report?.title || file.name,
      description: file.description || '',
      spacecraft: file.report?.spacecraft || file.department?.satellite?.name || '',
      category: file.report?.category || 'DAILY_REPORT',
      classificationLevel: file.report?.classificationLevel || 'RESTRICTED',
      broadcastAlert: false,
      broadcastMessage: `[UPDATE] Telemetry dataset ${file.name} modified in /${file.department?.code || 'OPS'}.`,
    })
  }

  // Save Edit Metadata
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingFile) return

    setSavingEdit(true)
    try {
      await apiClient.put(`/admin/files/${editingFile.id}`, editForm)
      addToast({
        title: 'Metadata Updated',
        message: `Saved modifications for "${editForm.name}"`,
        variant: 'success',
      })
      if (editForm.broadcastAlert) {
        addToast({
          title: 'Broadcast Dispatched',
          message: 'Live bulletin published to landing ticker and mission control.',
          variant: 'info',
        })
      }
      setEditingFile(null)
      fetchFiles()
    } catch (err: any) {
      addToast({
        title: 'Save Failed',
        message: err.response?.data?.error?.message || 'Could not update file record',
        variant: 'error',
      })
    } finally {
      setSavingEdit(false)
    }
  }

  // Quick Broadcast Action
  const handleQuickBroadcast = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!broadcastingFile) return

    setBroadcasting(true)
    try {
      await apiClient.post(`/admin/files/${broadcastingFile.id}/broadcast`, {
        message: broadcastMessage,
        urgency: broadcastUrgency,
      })
      addToast({
        title: 'Notice Broadcasted',
        message: `Published announcement for "${broadcastingFile.name}"`,
        variant: 'success',
      })
      setBroadcastingFile(null)
    } catch {
      addToast({ title: 'Broadcast Failed', message: 'Could not send broadcast notification', variant: 'error' })
    } finally {
      setBroadcasting(false)
    }
  }

  // Confirm Delete / Move to Trash
  const handleConfirmDelete = async () => {
    if (!deletingFile) return

    setDeleting(true)
    try {
      await apiClient.delete(`/files/${deletingFile.id}`)
      addToast({
        title: 'File Moved to Trash',
        message: `Archived "${deletingFile.name}" with its ${deletingFile.versionCount} historical version(s).`,
        variant: 'info',
      })
      setDeletingFile(null)
      fetchFiles()
    } catch {
      addToast({ title: 'Delete Failed', message: 'Could not remove file', variant: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  const handleCopyHash = (id: string, hash: string) => {
    navigator.clipboard.writeText(hash)
    setCopiedHashId(id)
    setTimeout(() => setCopiedHashId(null), 2000)
    addToast({ message: 'SHA-256 Checksum copied to clipboard', variant: 'info' })
  }

  // Calculate Total Bytes
  const totalSizeBytes = files.reduce((acc, f) => acc + (Number(f.sizeBytes) || 0), 0)
  const totalVersions = files.reduce((acc, f) => acc + (f.versionCount || 1), 0)
  const selectedDeptRecord = departments?.find((d) => d.id === selectedDept)

  return (
    <div className="w-full space-y-6 pb-16">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border-subtle pb-5">
        <PageHeader
          eyebrow="Mission Data Management"
          title="Master File Repository & Archives"
          description="Browse, verify, rename, and version-control all ingested telemetry streams, flight ephemeris records, and mission reports."
        />

        <div className="flex items-center gap-2.5 shrink-0">
          <Link to="/admin/upload">
            <Button variant="primary" size="md" className="shadow-md shadow-accent/25">
              <Upload size={14} />
              <span>Upload New File</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-xl border border-border-default bg-card p-4 space-y-1 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-dim flex items-center gap-1.5">
            <HardDrive size={13} className="text-accent-light" />
            <span>Master Files</span>
          </span>
          <p className="num text-xl font-bold text-white">{files.length} Records</p>
          <p className="text-[11px] text-text-secondary">Across all operational divisions</p>
        </div>

        <div className="rounded-xl border border-border-default bg-card p-4 space-y-1 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-dim flex items-center gap-1.5">
            <Sparkles size={13} className="text-nominal" />
            <span>Total Storage Consumed</span>
          </span>
          <p className="num text-xl font-bold text-nominal">{formatFileSize(totalSizeBytes)}</p>
          <p className="text-[11px] text-text-secondary">Physical storage arrays verified</p>
        </div>

        <div className="rounded-xl border border-border-default bg-card p-4 space-y-1 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-dim flex items-center gap-1.5">
            <History size={13} className="text-purple-400" />
            <span>Historical Revisions</span>
          </span>
          <p className="num text-xl font-bold text-purple-300">{totalVersions} Versions</p>
          <p className="text-[11px] text-text-secondary">Zero-overwrite point-in-time snapshots</p>
        </div>

        <div className="rounded-xl border border-border-default bg-card p-4 space-y-1 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-dim flex items-center gap-1.5">
            <CheckCircle2 size={13} className="text-[#FF6B00]" />
            <span>Integrity Checksums</span>
          </span>
          <p className="num text-xl font-bold text-[#FF8533]">SHA-256 Locked</p>
          <p className="text-[11px] text-text-secondary">Cryptographically tamper-evident</p>
        </div>
      </div>

      {/* FILTER & SEARCH TOOLBAR */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 rounded-xl border border-border-default bg-card shadow-sm">
        <div className="relative sm:col-span-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            type="text"
            placeholder="Search by name, hash, parameter…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border-default bg-[#060c18] pl-9 pr-3 py-2 text-xs text-white placeholder:text-text-dim outline-none focus:border-accent"
          />
        </div>

        <div>
          <select
            value={selectedDept}
            onChange={(e) => {
              const val = e.target.value
              setSelectedDept(val)
              if (val !== 'ALL') {
                setSearchParams({ deptId: val })
              } else {
                setSearchParams({})
              }
            }}
            className="w-full rounded-lg border border-border-default bg-[#060c18] px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
          >
            <option value="ALL">All Departments & Divisions</option>
            {departments?.map((d) => (
              <option key={d.id} value={d.id}>
                /{d.code || d.name} — {d.name} {d.archived ? '⚠️ (Archived - Admin Only)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={selectedSat}
            onChange={(e) => setSelectedSat(e.target.value)}
            className="w-full rounded-lg border border-border-default bg-[#060c18] px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
          >
            <option value="ALL">All Spacecraft & Satellites</option>
            {satellites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code || 'ISRO'})
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={selectedExt}
            onChange={(e) => setSelectedExt(e.target.value)}
            className="w-full rounded-lg border border-border-default bg-[#060c18] px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
          >
            <option value="ALL">All File Formats</option>
            <option value="BIN">BIN (Raw Telemetry)</option>
            <option value="DAT">DAT (Ephemeris / Science)</option>
            <option value="PDF">PDF (Mission Reports)</option>
            <option value="CSV">CSV (Separation / State Tables)</option>
            <option value="LOG">LOG (Tracking Logs)</option>
          </select>
        </div>
      </div>

      {/* Archived Department Warning Banner */}
      {selectedDeptRecord?.archived && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-white shadow-md">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-amber-300 uppercase tracking-wider">
                Archived Division — Admin-Only Restricted Archive
              </span>
              <span className="rounded bg-amber-400/20 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-300">
                MEMBER ACCESS REVOKED
              </span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              <strong>{selectedDeptRecord.name}</strong> ({selectedDeptRecord.code || 'DIVISION'}) has been decommissioned. Regular members cannot view, browse, or upload to this repository. All historical telemetry streams, flight datasets, and checksums are preserved in physical RAID storage (<code className="font-mono text-amber-300/80">{selectedDeptRecord.hddPath}</code>) and accessible strictly to System Administrators.
            </p>
          </div>
        </div>
      )}

      {/* MASTER FILES TABLE */}
      {loading ? (
        <div className="h-64 rounded-xl border border-border-subtle bg-card p-10 flex items-center justify-center text-xs text-text-dim">
          Scanning master storage repository…
        </div>
      ) : files.length === 0 ? (
        <div className="rounded-xl border border-border-subtle bg-card p-12 text-center space-y-3">
          <HardDrive size={32} className="mx-auto text-text-dim" />
          <p className="text-sm font-bold text-white">No Datasets Found</p>
          <p className="text-xs text-text-secondary">
            Upload a telemetry file or check your filter criteria.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border-default bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-border-default bg-surface text-[11px] font-bold text-text-dim uppercase tracking-wider">
                  <th className="px-4 py-3.5">Dataset / Filename</th>
                  <th className="px-4 py-3.5">Department</th>
                  <th className="px-4 py-3.5">Spacecraft</th>
                  <th className="px-4 py-3.5">Size</th>
                  <th className="px-4 py-3.5">Version History</th>
                  <th className="px-4 py-3.5">SHA-256 Checksum</th>
                  <th className="px-4 py-3.5">Uploaded</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-xs">
                {files.map((file) => {
                  const extConf = EXT_CONFIG[file.extension] || EXT_CONFIG.BIN
                  const Icon = extConf.icon

                  return (
                    <tr key={file.id} className="hover:bg-card-hover transition-colors">
                      {/* Name & Format */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface border border-border-subtle text-accent-light">
                            <Icon size={16} />
                          </div>
                          <div className="min-w-0">
                            <p
                              onClick={() => setPreviewFile(file as unknown as FileNode)}
                              className="font-bold text-white hover:text-accent-light cursor-pointer truncate max-w-xs transition-colors"
                              title="Click to Preview File"
                            >
                              {file.name}
                            </p>
                            {file.description && (
                              <p className="text-[10px] text-text-dim truncate max-w-xs">
                                {file.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Department */}
                      <td className="px-4 py-3.5">
                        <span className="num font-bold text-accent-light">
                          /{file.department?.code || file.department?.name || 'TTC'}
                        </span>
                      </td>

                      {/* Spacecraft */}
                      <td className="px-4 py-3.5">
                        <span className="font-medium text-text-secondary truncate max-w-[140px] block">
                          {file.report?.spacecraft || file.department?.satellite?.name || 'Primary Fleet'}
                        </span>
                      </td>

                      {/* Size */}
                      <td className="px-4 py-3.5 num text-text-secondary">
                        {formatFileSize(Number(file.sizeBytes) || 0)}
                      </td>

                      {/* Version Badge & Drawer Trigger */}
                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          onClick={() => setVersionPanelFile({ id: file.id, name: file.name })}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-purple-400/40 bg-purple-400/10 text-purple-300 hover:bg-purple-400/20 text-[10px] font-bold num transition-colors"
                          title="Open Revision History Drawer"
                        >
                          <History size={11} />
                          <span>v{file.versionCount || 1} Revisions</span>
                        </button>
                      </td>

                      {/* SHA-256 Checksum */}
                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          onClick={() => handleCopyHash(file.id, file.sha256)}
                          className="flex items-center gap-1.5 num text-[10px] font-mono text-text-dim hover:text-white transition-colors"
                          title="Click to copy full SHA-256 Checksum"
                        >
                          <span>{file.sha256.slice(0, 10)}…</span>
                          {copiedHashId === file.id ? (
                            <Check size={11} className="text-nominal shrink-0" />
                          ) : (
                            <Copy size={11} className="shrink-0" />
                          )}
                        </button>
                      </td>

                      {/* Upload Date & Officer */}
                      <td className="px-4 py-3.5">
                        <div className="text-[11px] text-text-dim num leading-tight">
                          <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                          <span className="block text-[10px] text-text-muted">
                            by {file.uploader?.name || 'Officer'}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Preview */}
                          <button
                            type="button"
                            onClick={() => setPreviewFile(file as unknown as FileNode)}
                            className="p-1.5 rounded-md border border-border-default bg-[#0c1424] text-text-muted hover:border-accent hover:text-white transition-all"
                            title="Preview File"
                          >
                            <Eye size={13} />
                          </button>

                          {/* Download */}
                          <a
                            href={`/api/files/${file.id}/download`}
                            className="p-1.5 rounded-md border border-border-default bg-[#0c1424] text-text-muted hover:border-nominal hover:text-nominal transition-all"
                            title="Download Physical Stream"
                          >
                            <Download size={13} />
                          </a>

                          {/* Edit Metadata & Optional Broadcast */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(file)}
                            className="p-1.5 rounded-md border border-border-default bg-[#0c1424] text-text-muted hover:border-accent hover:text-white transition-all"
                            title="Edit Metadata & Broadcast"
                          >
                            <Edit2 size={13} />
                          </button>

                          {/* Quick Broadcast Notice */}
                          <button
                            type="button"
                            onClick={() => {
                              setBroadcastingFile(file)
                              setBroadcastMessage(
                                `[NOTICE] Spacecraft telemetry archive ${file.name} updated in /${file.department?.code || 'TTC'}.`
                              )
                            }}
                            className="p-1.5 rounded-md border border-border-default bg-[#0c1424] text-text-muted hover:border-[#FF6B00] hover:text-[#FF8533] transition-all"
                            title="Broadcast Alert to Mission Control"
                          >
                            <Megaphone size={13} />
                          </button>

                          {/* Soft Delete with Warning Modal */}
                          <button
                            type="button"
                            onClick={() => setDeletingFile(file)}
                            className="p-1.5 rounded-md border border-border-default bg-[#0c1424] text-text-muted hover:border-critical hover:text-critical transition-all"
                            title="Move File to Trash (Soft Delete)"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: EDIT METADATA & OPTIONAL BROADCAST */}
      <Modal
        isOpen={editingFile !== null}
        onClose={() => setEditingFile(null)}
        title="Edit Dataset Metadata & Security Classification"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Physical Filename *
            </label>
            <input
              type="text"
              required
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="num font-mono w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-xs text-white outline-none focus:border-accent"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Spacecraft / Satellite
              </label>
              <input
                type="text"
                value={editForm.spacecraft}
                onChange={(e) => setEditForm({ ...editForm, spacecraft: e.target.value })}
                placeholder="e.g. Aditya-L1"
                className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-xs text-white outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Classification Level
              </label>
              <select
                value={editForm.classificationLevel}
                onChange={(e) => setEditForm({ ...editForm, classificationLevel: e.target.value })}
                className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-xs text-white outline-none focus:border-accent"
              >
                <option value="RESTRICTED">RESTRICTED</option>
                <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                <option value="SECRET">SECRET / AIR-GAPPED</option>
                <option value="PUBLIC">PUBLIC RELEASE</option>
              </select>
            </div>
          </div>

          <Textarea
            id="file-edit-desc"
            label="Dataset Description & Observation Notes"
            rows={2}
            value={editForm.description}
            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
            placeholder="Enter mission parameters, tracking pass ID, or calibration state..."
          />

          {/* Optional Broadcast Notification Option */}
          <div className="rounded-xl border border-accent/40 bg-accent/[0.04] p-3.5 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-white">
              <input
                type="checkbox"
                checked={editForm.broadcastAlert}
                onChange={(e) => setEditForm({ ...editForm, broadcastAlert: e.target.checked })}
                className="h-4 w-4 rounded border-border-default bg-card text-accent focus:ring-accent"
              />
              <span className="flex items-center gap-1.5">
                <Megaphone size={13} className="text-accent-light" />
                <span>Publish Live Broadcast Bulletin to Mission Banner & Ticker</span>
              </span>
            </label>

            {editForm.broadcastAlert && (
              <div className="pt-2">
                <input
                  type="text"
                  value={editForm.broadcastMessage}
                  onChange={(e) => setEditForm({ ...editForm, broadcastMessage: e.target.value })}
                  placeholder="Enter notice text to display across top announcement ticker..."
                  className="w-full rounded-lg border border-border-default bg-[#060c18] px-3 py-1.5 text-xs text-white outline-none focus:border-accent"
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditingFile(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={savingEdit}>
              {savingEdit ? 'Saving…' : 'Save Modifications'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: QUICK BROADCAST NOTIFICATION */}
      <Modal
        isOpen={broadcastingFile !== null}
        onClose={() => setBroadcastingFile(null)}
        title="Broadcast Live Bulletin for Dataset"
      >
        <form onSubmit={handleQuickBroadcast} className="space-y-4">
          <p className="text-xs text-text-secondary">
            Dispatch an immediate priority bulletin regarding{' '}
            <strong className="text-white">{broadcastingFile?.name}</strong> to the top dynamic alert banner and notification feed.
          </p>

          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Urgency Level
            </label>
            <select
              value={broadcastUrgency}
              onChange={(e) => setBroadcastUrgency(e.target.value)}
              className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-xs text-white outline-none focus:border-accent"
            >
              <option value="NORMAL">NORMAL BULLETIN</option>
              <option value="IMPORTANT">IMPORTANT NOTICE (Saffron Alert)</option>
              <option value="CRITICAL">CRITICAL / ANOMALY (Red Alert)</option>
            </select>
          </div>

          <Textarea
            id="quick-broadcast-text"
            label="Announcement Message *"
            rows={3}
            value={broadcastMessage}
            onChange={(e) => setBroadcastMessage(e.target.value)}
            required
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
            <Button type="button" variant="outline" size="sm" onClick={() => setBroadcastingFile(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={broadcasting} className="shadow-md shadow-accent/25">
              <Megaphone size={13} />
              <span>{broadcasting ? 'Broadcasting…' : 'Dispatch Broadcast'}</span>
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: DELETE / MOVE TO TRASH WARNING MODAL */}
      <Modal
        isOpen={deletingFile !== null}
        onClose={() => setDeletingFile(null)}
        title="Move Dataset to Trash (Warning)"
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-critical/30 bg-critical/10 p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-critical">
              <AlertTriangle size={16} />
              <span>CONFIRM FILE REMOVAL</span>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              Are you sure you want to remove <strong className="text-white font-mono">{deletingFile?.name}</strong>?
            </p>
            <div className="pt-2 text-[11px] text-text-dim space-y-1 num">
              <div>Department: <span className="text-white font-semibold">{deletingFile?.department?.name}</span></div>
              <div>Disk Path: <span className="text-white font-mono">{deletingFile?.hddPath}</span></div>
              <div>Revision History: <span className="text-purple-300 font-bold">{deletingFile?.versionCount} Historical Version(s)</span></div>
            </div>
          </div>

          <p className="text-[11px] text-text-dim">
            The file and all its previous snapshots will be soft-deleted to the staging trash directory and can be restored if necessary.
          </p>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
            <Button type="button" variant="outline" size="sm" onClick={() => setDeletingFile(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={deleting}
              onClick={handleConfirmDelete}
              className="bg-critical hover:bg-critical-hover shadow-md shadow-critical/20"
            >
              <Trash2 size={13} />
              <span>{deleting ? 'Moving to Trash…' : 'Confirm Move to Trash'}</span>
            </Button>
          </div>
        </div>
      </Modal>

      {/* SLIDE-OVER: VERSION HISTORY DRAWER */}
      {versionPanelFile && (
        <VersionHistoryPanel
          fileId={versionPanelFile.id}
          fileName={versionPanelFile.name}
          onClose={() => setVersionPanelFile(null)}
        />
      )}

      {/* MODAL: IN-BROWSER PREVIEW */}
      <FilePreviewModal
        file={previewFile ? {
          id: previewFile.id,
          name: previewFile.name,
          mimeType: previewFile.mimeType,
          sizeBytes: Number(previewFile.sizeBytes) || null,
        } : null}
        onClose={() => setPreviewFile(null)}
      />
    </div>
  )
}
