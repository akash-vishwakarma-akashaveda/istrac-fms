import { useState, useEffect } from 'react'
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
} from 'lucide-react'
import { apiClient } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { useToastStore } from '../store/toastStore'
import { Button, Modal, Textarea } from '../components'
import { formatFileSize } from '../lib/formatFileSize'

interface DepartmentHubData {
  department: {
    id: string
    name: string
    code: string
    description: string
    hddPath: string
    satellite?: { id: string; name: string; code: string; description: string } | null
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

  const isAdmin = user?.role === 'ADMIN'

  const [data, setData] = useState<DepartmentHubData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'files' | 'reports' | 'events' | 'satellites'>('files')
  const [fileSearch, setFileSearch] = useState('')

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

  const fetchHubData = async () => {
    if (!deptId) return
    setLoading(true)
    try {
      const res = await apiClient.get(`/departments/${deptId}/hub`, {
        params: { search: fileSearch || undefined },
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
  }, [deptId, fileSearch])

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
                <span>Upload to /{department.code || department.name}</span>
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
              <div className="flex items-center gap-1.5">
                <HardDrive size={14} className="text-accent-light" />
                <span>Physical Disk Root:</span>
                <code className="text-white font-bold">{department.hddPath}</code>
              </div>

              <div className="flex items-center gap-1.5">
                <FileText size={14} className="text-nominal" />
                <span>Active Files:</span>
                <span className="text-white font-bold">{department.fileCount} items</span>
              </div>
            </div>
          </div>

          {/* Division Lead Officer Card */}
          <div className="rounded-xl border border-border-subtle bg-[#060c18] p-4.5 min-w-[260px] space-y-3 shadow-inner">
            <div className="flex items-center justify-between border-b border-border-subtle/80 pb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-dim flex items-center gap-1">
                <User size={12} className="text-accent-light" />
                <span>Division Lead</span>
              </span>
              <span className="rounded bg-nominal/15 px-1.5 py-0.5 text-[9px] font-bold text-nominal">
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

        {department.satellite && (
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
            <span>Assigned Spacecraft</span>
          </button>
        )}
      </div>

      {/* TAB 1: FILES & DATASETS */}
      {activeTab === 'files' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
              <input
                type="text"
                placeholder={`Search files inside /${department.code || department.name}…`}
                value={fileSearch}
                onChange={(e) => setFileSearch(e.target.value)}
                className="w-full rounded-lg border border-border-default bg-[#060c18] pl-9 pr-3 py-2 text-xs text-white placeholder:text-text-dim outline-none focus:border-accent"
              />
            </div>

            <span className="num text-xs text-text-dim">{files.length} records found</span>
          </div>

          {files.length === 0 ? (
            <div className="rounded-xl border border-border-subtle bg-card p-10 text-center text-xs text-text-dim">
              No files currently stored in this department folder.
            </div>
          ) : (
            <div className="rounded-xl border border-border-default bg-card overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border-default bg-surface text-[11px] font-bold text-text-dim uppercase tracking-wider">
                    <th className="px-4 py-3">File / Dataset Name</th>
                    <th className="px-4 py-3">Format</th>
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
                      <td className="px-4 py-3 num text-text-secondary">
                        {formatFileSize(Number(file.sizeBytes) || 0)}
                      </td>
                      <td className="px-4 py-3 text-text-muted">{file.uploader}</td>
                      <td className="px-4 py-3 num text-text-dim">
                        {new Date(file.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <a
                          href={`/api/files/${file.id}/download`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border-default bg-[#0c1424] text-xs font-semibold text-text-primary hover:border-accent hover:text-white transition-all"
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
                      {new Date(r.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white">{r.title}</h4>
                  {r.description && <p className="text-xs text-text-secondary">{r.description}</p>}
                  <div className="flex items-center justify-between pt-2 border-t border-border-subtle text-[11px] text-text-dim">
                    <span>Spacecraft: <strong className="text-white">{r.spacecraft || 'ISRO'}</strong></span>
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
                    <span className="rounded bg-nominal/15 px-1.5 py-0.5 text-[9px] font-bold text-nominal">
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
      {activeTab === 'satellites' && department.satellite && (
        <div className="rounded-xl border border-border-default bg-card p-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent-light border border-accent/25">
              <Radio size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{department.satellite.name}</h3>
              <span className="num text-xs text-accent-light font-bold">
                Code: {department.satellite.code || 'ISRO-SAT'}
              </span>
            </div>
          </div>
          {department.satellite.description && (
            <p className="text-xs text-text-secondary leading-relaxed pt-2">
              {department.satellite.description}
            </p>
          )}
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
