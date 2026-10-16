import { useState, useEffect } from 'react'
import { HelpTip } from '../components/HelpTip'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  Building2,
  FileText,
  Radio,
  Calendar,
  Search,
  Download,
  Upload,
  Edit2,
  Mail,
  User,
  HardDrive,
  ArrowLeft,
  Sparkles,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react'
import { apiClient } from '../api/client'
import { useCategoryLabel } from '../components/CategoryOptions'
import { useAuthStore } from '../store/authStore'
import { useToastStore } from '../store/toastStore'
import { useDebounce } from '../hooks/useDebounce'
import { Button, Modal, Textarea } from '../components'
import { formatFileSize } from '../lib/formatFileSize'
import { formatDateTimeIST } from '../lib/formatDate'

interface SatelliteItem {
  id: string
  name: string
  code: string
  description?: string
  isActive?: boolean
  deletedAt?: string | null
  status?: string
}

interface DepartmentHubData {
  department: {
    id: string
    name: string
    code: string
    description: string
    hddPath: string
    satellite?: SatelliteItem | null
    satellites?: SatelliteItem[]
    fileCount: number
    pageTitle: string
    pageAbout: string
    pageLeadOfficer: string
    pageLeadRole: string
    pageContact: string
    isPageEnabled: boolean
  }
  files: Array<{
    id: string
    name: string
    nodeType: string
    mimeType: string
    extension: string
    sizeBytes: string
    versionCount: number
    uploader: string
    category?: string | null
    customCategory?: string | null
    createdAt: string
    updatedAt: string
  }>
  reports: Array<{
    id: string
    title: string
    description: string
    category: string
    spacecraft: string
    status: string
    createdBy: string
    createdAt: string
  }>
  events: Array<{
    id: string
    title: string
    eventType: string
    eventDate: string
    location: string
    urgency: string
    status: string
  }>
}

export function DepartmentHub() {
  const { deptId } = useParams<{ deptId: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const addToast = useToastStore((s) => s.addToast)
  const categoryLabel = useCategoryLabel()

  const isAdmin = user?.role === 'ADMIN'

  const [data, setData] = useState<DepartmentHubData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'files' | 'reports' | 'events' | 'satellites'>('files')
  const [satelliteStatusFilter, setSatelliteStatusFilter] = useState<'ACTIVE' | 'DEACTIVATED'>('ACTIVE')
  const [fileSearch, setFileSearch] = useState('')
  const debouncedFileSearch = useDebounce(fileSearch, 300)

  // Edit Page Settings Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [pageSettingsForm, setPageSettingsForm] = useState({
    pageTitle: '',
    pageAbout: '',
    pageLeadOfficer: '',
    pageLeadRole: '',
    pageContact: '',
    isPageEnabled: true,
  })
  const [savingSettings, setSavingSettings] = useState(false)

  const isSatelliteDeactivated = (sat?: SatelliteItem | null) =>
    Boolean(sat?.isActive === false || sat?.deletedAt || sat?.status === 'DECOMMISSIONED' || sat?.status === 'INACTIVE')

  const fetchHubData = async () => {
    if (!deptId) return
    setLoading(true)
    try {
      const res = await apiClient.get(`/departments/${deptId}/hub`, {
        params: { search: debouncedFileSearch || undefined },
      })
      if (res.data?.data) {
        setData(res.data.data)
        const d = res.data.data.department
        setPageSettingsForm({
          pageTitle: d.pageTitle || '',
          pageAbout: d.pageAbout || '',
          pageLeadOfficer: d.pageLeadOfficer || '',
          pageLeadRole: d.pageLeadRole || '',
          pageContact: d.pageContact || '',
          isPageEnabled: d.isPageEnabled ?? true,
        })
      }
    } catch {
      addToast({ title: 'Error', message: 'Failed to load department workspace', variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHubData()
  }, [deptId, debouncedFileSearch])

  const handleSavePageSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!data?.department.id) return

    setSavingSettings(true)
    try {
      await apiClient.put(`/departments/${data.department.id}/page-settings`, pageSettingsForm)
      addToast({
        title: 'Department Page Updated',
        message: 'Showcase details and division overview saved.',
        variant: 'success',
      })
      setIsEditModalOpen(false)
      fetchHubData()
    } catch {
      addToast({ title: 'Save Failed', message: 'Could not update page settings', variant: 'error' })
    } finally {
      setSavingSettings(false)
    }
  }

  if (loading && !data) {
    return (
      <div className="max-w-7xl mx-auto py-12 text-center text-xs text-text-dim">
        Connecting to Department Operations Hub…
      </div>
    )
  }

  if (!data) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center space-y-4">
        <Building2 size={36} className="mx-auto text-text-dim" />
        <h2 className="text-base font-bold text-white">Department Not Found</h2>
        <p className="text-xs text-text-secondary">
          The requested operational division could not be located.
        </p>
        <Button variant="outline" size="sm" onClick={() => navigate('/admin/departments')}>
          <ArrowLeft size={13} />
          <span>Back to Departments</span>
        </Button>
      </div>
    )
  }

  const { department, files, reports, events } = data

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16">
      {/* Top Breadcrumb Nav */}
      <div className="flex items-center justify-between border-b border-border-subtle pb-4">
        <div className="flex items-center gap-2 text-xs text-text-dim">
          <Link to="/admin/departments" className="hover:text-accent-light flex items-center gap-1">
            <Building2 size={13} />
            <span>Departments</span>
          </Link>
          <span>/</span>
          <span className="font-bold text-white">{department.name}</span>
          <span className="num rounded bg-accent/15 px-1.5 py-0.2 text-[10px] font-bold text-accent-light border border-accent/30">
            {department.code || 'DIV'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditModalOpen(true)}
              className="shadow-sm"
            >
              <Edit2 size={13} />
              <span>Configure Department Page</span>
            </Button>
          )}

          {isAdmin && (
            <Link to={`/admin/upload?deptId=${department.id}`}>
              <Button type="button" variant="primary" size="sm" className="shadow-md shadow-accent/25">
                <Upload size={13} />
                <span>Upload to {department.code || department.name}</span>
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* DEPARTMENT SHOWCASE HERO */}
      <div className="rounded-2xl border border-border-default bg-gradient-to-br from-card via-[#0b1322] to-surface p-6 sm:p-8 shadow-card space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="flex items-center gap-2">
              <span className="num text-[11px] font-bold tracking-wider text-[#FF6B00] uppercase flex items-center gap-1">
                <Sparkles size={13} />
                <span>ISRO ISTRAC Division</span>
              </span>
              <span>·</span>
              <span className="text-xs text-text-dim">Operational Command Unit</span>
            </div>

            <h1 className="display text-2xl sm:text-3xl font-extrabold text-white">
              {department.pageTitle || department.name}
            </h1>

            <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
              {department.pageAbout || department.description}
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-text-dim num">
              {isAdmin && (
                <div className="flex items-center gap-1.5">
                  <HardDrive size={14} className="text-accent-light" />
                  <span>Physical Storage Mount:</span>
                  <code className="text-white font-mono text-[11px] bg-[#070d18] px-1.5 py-0.5 rounded border border-border-subtle">
                    {department.hddPath}
                  </code>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <FileText size={14} className="text-nominal" />
                <span>Active Datasets:</span>
                <span className="text-white font-bold">{department.fileCount} files</span>
              </div>

              {department.satellite && (
                <div className="flex items-center gap-1.5">
                  <Radio size={14} className={isSatelliteDeactivated(department.satellite) ? 'text-critical' : 'text-accent-light'} />
                  <span>Spacecraft Fleet:</span>
                  <span className={`font-bold ${isSatelliteDeactivated(department.satellite) ? 'text-critical' : 'text-white'}`}>
                    {department.satellite.name} {isSatelliteDeactivated(department.satellite) ? '(Deactivated)' : ''}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Division Lead Officer Card */}
          <div className="rounded-xl border border-border-subtle bg-[#060c18] p-4.5 min-w-[260px] space-y-3 shadow-inner">
            <div className="flex items-center justify-between border-b border-border-subtle/80 pb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-dim flex items-center gap-1">
                <User size={12} className="text-accent-light" />
                <span>Division Lead</span>
              </span>
              <span className="rounded bg-nominal/15 px-1.5 py-0.5 text-[10px] font-bold text-nominal">
                ACTIVE
              </span>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-bold text-white">{department.pageLeadOfficer}</p>
              <p className="text-xs text-text-secondary">{department.pageLeadRole}</p>
            </div>

            <div className="flex items-center gap-1.5 pt-1 text-xs text-accent-light truncate">
              <Mail size={12} className="shrink-0 text-text-dim" />
              <span className="truncate">{department.pageContact}</span>
            </div>
          </div>
        </div>
      </div>

      {/* DEPARTMENT NAVIGATION TABS */}
      <div className="flex gap-2 overflow-x-auto border-b border-border-subtle pb-px">
        <button
          type="button"
          onClick={() => setActiveTab('files')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all ${
            activeTab === 'files'
              ? 'border-b-accent text-accent-light bg-accent/[0.05] rounded-t-lg'
              : 'border-b-transparent text-text-dim hover:text-text-primary'
          }`}
        >
          <FileText size={14} />
          <span>Files & Datasets ({files.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('reports')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all ${
            activeTab === 'reports'
              ? 'border-b-accent text-accent-light bg-accent/[0.05] rounded-t-lg'
              : 'border-b-transparent text-text-dim hover:text-text-primary'
          }`}
        >
          <Sparkles size={14} />
          <span>Mission Reports ({reports.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('events')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all ${
            activeTab === 'events'
              ? 'border-b-accent text-accent-light bg-accent/[0.05] rounded-t-lg'
              : 'border-b-transparent text-text-dim hover:text-text-primary'
          }`}
        >
          <Calendar size={14} />
          <span>Division Passes & Events ({events.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('satellites')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all ${
            activeTab === 'satellites'
              ? 'border-b-accent text-accent-light bg-accent/[0.05] rounded-t-lg'
              : 'border-b-transparent text-text-dim hover:text-text-primary'
          }`}
        >
          <Radio size={14} />
          <span>Assigned Spacecraft ({department.satellites?.length || (department.satellite ? 1 : 0)})</span>
        </button>
      </div>

      {/* TAB 1: FILES & DATASETS */}
      {activeTab === 'files' && (
        <div className="space-y-4">
          {/* Search Toolbar (STICKY ON SCROLL) */}
          <div className="sticky top-0 z-20 p-3 rounded-xl border border-border-default bg-[#070d18]/95 backdrop-blur-md shadow-lg shadow-black/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 transition-all">
            <div className="relative flex-1 max-w-md">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
              <input
                type="text"
                placeholder={`Search files inside ${department.code || department.name}…`}
                value={fileSearch}
                onChange={(e) => setFileSearch(e.target.value)}
                className="w-full rounded-lg border border-border-default bg-[#060c18] pl-9 pr-11 py-2 text-xs text-white placeholder:text-text-dim outline-none focus:border-accent"
              />
              <span className="absolute right-1 top-1/2 -translate-y-1/2">
                <HelpTip topic="repository" />
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="num text-xs text-text-dim whitespace-nowrap">
                <strong className="text-white num">{files.length}</strong> records found
              </span>
              {fileSearch && (
                <button
                  type="button"
                  onClick={() => setFileSearch('')}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-accent/40 bg-accent/10 text-xs font-bold text-accent-light hover:text-white hover:bg-accent transition-all cursor-pointer shrink-0"
                  title="Clear search query"
                >
                  <RotateCcw size={12} />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>

          {files.length === 0 ? (
            <div className="rounded-xl border border-border-subtle bg-card p-10 text-center space-y-2">
              <p className="text-xs text-text-dim">
                {fileSearch
                  ? `No files match "${fileSearch}".`
                  : 'No files currently stored in this department folder.'}
              </p>
              {fileSearch && (
                <div className="pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFileSearch('')}
                    className="inline-flex items-center gap-1.5"
                  >
                    <RotateCcw size={13} />
                    <span>Clear Search</span>
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-border-default bg-card overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[750px]">
                  <thead>
                    <tr className="border-b border-border-default bg-surface text-[11px] font-bold text-text-dim uppercase tracking-wider">
                      <th className="px-4 py-3">File / Dataset Name</th>
                      <th className="px-4 py-3">Format</th>
                      <th className="px-4 py-3">Report Category</th>
                      <th className="px-4 py-3">Size</th>
                      <th className="px-4 py-3">Uploader</th>
                      <th className="px-4 py-3">Uploaded Date</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle text-xs">
                    {files.map((file) => (
                      <tr key={file.id} className="hover:bg-card-hover transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <FileText size={16} className="text-accent-light shrink-0" />
                            <span className="font-semibold text-white truncate max-w-md">{file.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="num rounded bg-surface px-1.5 py-0.5 text-[10px] font-bold uppercase text-text-dim">
                            {file.extension || 'DAT'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded bg-accent/15 border border-accent/30 px-2 py-0.5 text-[10px] font-bold text-accent-light uppercase">
                            {categoryLabel(file.category || file.customCategory) || 'GENERAL'}
                          </span>
                        </td>
                        <td className="px-4 py-3 num text-text-secondary">
                          {formatFileSize(Number(file.sizeBytes) || 0)}
                        </td>
                        <td className="px-4 py-3 text-text-muted">{file.uploader}</td>
                        <td className="px-4 py-3 num text-text-dim">
                          {formatDateTimeIST(file.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <a
                            href={`/api/files/${file.id}/download`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border-default bg-surface text-xs font-semibold text-text-primary hover:border-nominal hover:text-nominal hover:bg-nominal/10 transition-all shadow-sm cursor-pointer"
                          >
                            <Download size={12} />
                            <span>Download</span>
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MISSION REPORTS */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          {reports.length === 0 ? (
            <div className="rounded-xl border border-border-subtle bg-card p-10 text-center text-xs text-text-dim">
              No daily reports logged for this division yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reports.map((r) => (
                <div key={r.id} className="rounded-xl border border-border-default bg-card p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="rounded bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent-light">
                      {r.category || 'MISSION REPORT'}
                    </span>
                    <span className="text-[10px] text-text-dim num">
                      {formatDateTimeIST(r.createdAt)}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white">{r.title}</h4>
                  {r.description && <p className="text-xs text-text-secondary">{r.description}</p>}
                  <div className="flex items-center justify-between pt-2 border-t border-border-subtle text-[11px] text-text-dim">
                    <span>Spacecraft: <strong className="text-white">{r.spacecraft && !r.spacecraft.toUpperCase().includes('GENERAL') ? r.spacecraft : '—'}</strong></span>
                    <span>Author: <strong className="text-text-primary">{r.createdBy}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PASSES & EVENTS */}
      {activeTab === 'events' && (
        <div className="space-y-4">
          {events.length === 0 ? (
            <div className="rounded-xl border border-border-subtle bg-card p-10 text-center text-xs text-text-dim">
              No upcoming passes or scheduled maintenance for this division.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {events.map((ev) => (
                <div key={ev.id} className="rounded-xl border border-border-default bg-card p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-accent-light uppercase">
                      {ev.eventType}
                    </span>
                    <span className="rounded bg-nominal/15 px-1.5 py-0.5 text-[10px] font-bold text-nominal">
                      {ev.status}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white">{ev.title}</h4>
                  <div className="flex items-center justify-between text-xs text-text-dim num pt-2 border-t border-border-subtle">
                    <span>Site: {ev.location}</span>
                    <span>Date: {new Date(ev.eventDate).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SPACECRAFT */}
      {activeTab === 'satellites' && (
        <div className="space-y-4">
          {(() => {
            const rawList = (department.satellites && department.satellites.length > 0)
              ? department.satellites
              : department.satellite ? [department.satellite] : []
            // Filter out any hard-deleted/empty satellite records so they are never seen
            const sats = rawList.filter((s): s is SatelliteItem => Boolean(s && s.id && s.name))

            const activeCount = sats.filter((s) => !isSatelliteDeactivated(s)).length
            const deactivatedCount = sats.filter((s) => isSatelliteDeactivated(s)).length

            const displayedSats = sats.filter((sat) => {
              const isDeactivated = isSatelliteDeactivated(sat)
              if (satelliteStatusFilter === 'ACTIVE') return !isDeactivated
              return isDeactivated
            })

            if (sats.length === 0) {
              return (
                <div className="rounded-xl border border-dashed border-border-default/80 bg-surface/30 p-8 text-center text-xs text-text-dim">
                  No spacecraft programs assigned to this division.
                </div>
              )
            }

            return (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-xl border border-border-default bg-card shadow-sm">
                  <div className="flex items-center gap-2">
                    <Radio size={14} className="text-accent-light" />
                    <span className="text-xs font-bold text-white">Spacecraft Fleet Status:</span>
                    {deactivatedCount > 0 && (
                      <span className="rounded-full bg-critical/20 border border-critical/40 text-critical px-2 py-0.5 text-[10px] font-mono num font-bold">
                        {deactivatedCount} Deactivated
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 p-1 rounded-lg border border-border-default bg-[#060c18]">
                    <button
                      type="button"
                      onClick={() => setSatelliteStatusFilter('ACTIVE')}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                        satelliteStatusFilter === 'ACTIVE'
                          ? 'bg-nominal/20 text-nominal border border-nominal/40 shadow-sm'
                          : 'text-text-dim hover:text-nominal'
                      }`}
                      title="Show only operational active satellites"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-nominal" />
                      <span>Active</span>
                      <span className="num text-[10px] px-1.5 py-0.2 rounded-full bg-black/40 font-mono">
                        {activeCount}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSatelliteStatusFilter('DEACTIVATED')}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                        satelliteStatusFilter === 'DEACTIVATED'
                          ? 'bg-critical/25 text-critical border border-critical/50 shadow-sm'
                          : 'text-text-dim hover:text-critical'
                      }`}
                      title="Show only deactivated satellites"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-critical" />
                      <span>Deactivated</span>
                      <span className="num text-[10px] px-1.5 py-0.2 rounded-full bg-black/40 font-mono">
                        {deactivatedCount}
                      </span>
                    </button>
                  </div>
                </div>

                {displayedSats.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border-default bg-[#060c18] p-8 text-center space-y-2.5">
                    <Radio size={24} className="mx-auto text-text-dim" />
                    <p className="text-sm font-bold text-white">
                      {satelliteStatusFilter === 'ACTIVE'
                        ? 'No active satellites currently assigned to this division.'
                        : 'No deactivated satellites found for this division.'}
                    </p>
                    {satelliteStatusFilter === 'DEACTIVATED' ? (
                      <button
                        type="button"
                        onClick={() => setSatelliteStatusFilter('ACTIVE')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-nominal/40 bg-nominal/15 text-nominal text-xs font-bold hover:bg-nominal-fill hover:text-white transition-all cursor-pointer mt-1"
                      >
                        <span>View Active Satellites</span>
                      </button>
                    ) : deactivatedCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => setSatelliteStatusFilter('DEACTIVATED')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-critical/40 bg-critical/15 text-critical text-xs font-bold hover:bg-critical-fill hover:text-white transition-all cursor-pointer mt-1"
                      >
                        <span>View Deactivated Satellites ({deactivatedCount})</span>
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {displayedSats.map((sat) => {
                  const isDeactivated = isSatelliteDeactivated(sat)
                  return (
                    <div
                      key={sat.id}
                      className={`rounded-xl border p-5 space-y-3 transition-all ${
                        isDeactivated
                          ? 'border-critical/60 bg-[#160a12] shadow-critical/10 ring-1 ring-critical/30'
                          : 'border-border-default bg-card hover:border-accent/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                            isDeactivated
                              ? 'bg-critical/20 text-critical border-critical/30'
                              : 'bg-accent/15 text-accent-light border-accent/25'
                          }`}>
                            <Radio size={20} />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-white">
                              {sat.name}
                            </h3>
                            <span className={`num text-xs font-mono font-bold ${isDeactivated ? 'text-critical' : 'text-accent-light'}`}>
                              Code: {sat.code || 'ISRO-SAT'}
                            </span>
                          </div>
                        </div>

                        {isDeactivated ? (
                          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-critical/20 text-critical border border-critical/40 shrink-0">
                            <XCircle size={10} />
                            <span>{sat.status === 'DECOMMISSIONED' ? 'Decommissioned' : 'Deactivated'}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-nominal/15 text-nominal border border-nominal/30 shrink-0">
                            <CheckCircle2 size={10} />
                            <span>{sat.status || 'Active'}</span>
                          </span>
                        )}
                      </div>

                      {isDeactivated && (
                        <div className="rounded-lg border border-critical/40 bg-critical/15 px-2.5 py-1.5 text-[11px] text-critical flex items-center gap-2">
                          <AlertTriangle size={13} className="shrink-0 text-critical" />
                          <span className="font-semibold">Spacecraft Program Deactivated / Inactive</span>
                        </div>
                      )}

                      {sat.description && (
                        <p className="text-xs text-text-secondary leading-relaxed pt-1">
                          {sat.description}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })()}
        </div>
      )}

      {/* MODAL: CONFIGURE DEPARTMENT LANDING PAGE */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Configure ${department.name} Showcase Page`}
      >
        <form onSubmit={handleSavePageSettings} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Page Headline / Title
            </label>
            <input
              type="text"
              required
              value={pageSettingsForm.pageTitle}
              onChange={(e) => setPageSettingsForm({ ...pageSettingsForm, pageTitle: e.target.value })}
              className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-xs text-white outline-none focus:border-accent"
            />
          </div>

          <Textarea
            id="dept-page-about"
            label="About & Operational Mandate"
            rows={3}
            value={pageSettingsForm.pageAbout}
            onChange={(e) => setPageSettingsForm({ ...pageSettingsForm, pageAbout: e.target.value })}
            placeholder="Describe the department's role in satellite telemetry and mission control..."
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Lead Officer Name
              </label>
              <input
                type="text"
                value={pageSettingsForm.pageLeadOfficer}
                onChange={(e) => setPageSettingsForm({ ...pageSettingsForm, pageLeadOfficer: e.target.value })}
                placeholder="e.g. Dr. Ananya Ray"
                className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-xs text-white outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Officer Role / Designation
              </label>
              <input
                type="text"
                value={pageSettingsForm.pageLeadRole}
                onChange={(e) => setPageSettingsForm({ ...pageSettingsForm, pageLeadRole: e.target.value })}
                placeholder="e.g. Lead Orbit Determination Officer"
                className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-xs text-white outline-none focus:border-accent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Contact Email / Shift Desk
            </label>
            <input
              type="email"
              value={pageSettingsForm.pageContact}
              onChange={(e) => setPageSettingsForm({ ...pageSettingsForm, pageContact: e.target.value })}
              placeholder="e.g. ttc_shift@istrac.isro.gov.in"
              className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-xs text-white outline-none focus:border-accent"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={savingSettings}>
              {savingSettings ? 'Saving…' : 'Save Page Settings'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
