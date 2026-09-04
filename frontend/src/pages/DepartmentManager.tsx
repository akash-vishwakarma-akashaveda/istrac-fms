import { Archive, Building2, Plus, RotateCcw, ExternalLink, AlertTriangle, FolderOpen, Lock, ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useAdminDepartments,
  useCreateDepartment,
  useUpdateDepartment,
  useArchiveDepartment,
} from '../hooks/useDepartments'
import { useToastStore } from '../store/toastStore'
import { Button, PageHeader, Modal } from '../components'
import { CreateDeptModal } from '../components/CreateDeptModal'
import type { Department } from '../api'

type Tab = 'active' | 'archived'

export function DepartmentManager() {
  const { data: departments, isLoading } = useAdminDepartments()

  const createDept = useCreateDepartment()
  const updateDept = useUpdateDepartment()
  const archiveDept = useArchiveDepartment()
  const addToast = useToastStore((s) => s.addToast)

  const [tab, setTab] = useState<Tab>('active')
  const [modalOpen, setModalOpen] = useState(false)

  // Archival Warning Modal State
  const [confirmingArchiveDept, setConfirmingArchiveDept] = useState<Department | null>(null)
  const [understandRisk, setUnderstandRisk] = useState(false)

  const [editingDept, setEditingDept] = useState<{
    id: string
    name: string
    code?: string
    folderName: string
    pageTitle?: string
    pageAbout?: string
    pageLeadOfficer?: string
    pageLeadRole?: string
    pageContact?: string
    satelliteIds?: string[]
  } | null>(null)

  const filtered =
    departments?.filter((dept) =>
      tab === 'active' ? !dept.archived : dept.archived
    ) ?? []

  const activeCount =
    departments?.filter((dept) => !dept.archived).length ?? 0

  const archivedCount =
    departments?.filter((dept) => dept.archived).length ?? 0

  async function handleCreate(data: {
    name: string
    code?: string
    hddPath: string
    pageTitle?: string
    pageAbout?: string
    pageLeadOfficer?: string
    pageLeadRole?: string
    pageContact?: string
    satelliteIds?: string[]
  }) {
    await createDept.mutateAsync(data)

    addToast({ message: 'Department created with CMS configuration', variant: 'success' })
    setModalOpen(false)
  }

  async function handleEdit(data: {
    name: string
    code?: string
    hddPath: string
    pageTitle?: string
    pageAbout?: string
    pageLeadOfficer?: string
    pageLeadRole?: string
    pageContact?: string
    satelliteIds?: string[]
  }) {
    if (!editingDept) return

    await updateDept.mutateAsync({
      id: editingDept.id,
      ...data,
    })

    addToast({ message: 'Department CMS updated', variant: 'success' })
    setEditingDept(null)
  }

  function handleRestore(id: string, name: string) {
    archiveDept.mutate(
      { id, archived: false },
      {
        onSuccess: () =>
          addToast({
            title: 'Division Restored',
            message: `${name} has been reactivated. Station members now have access restored.`,
            variant: 'success',
          }),
        onError: () => addToast({ message: 'Failed to restore department', variant: 'error' }),
      }
    )
  }

  function openEdit(dept: any) {
    setEditingDept({
      id: dept.id,
      name: dept.name,
      code: dept.code || '',
      folderName: dept.hddPath ? dept.hddPath.replace(/.*[/\\]/, '') : '',
      pageTitle: dept.pageTitle || '',
      pageAbout: dept.pageAbout || '',
      pageLeadOfficer: dept.pageLeadOfficer || '',
      pageLeadRole: dept.pageLeadRole || '',
      pageContact: dept.pageContact || '',
      satelliteIds: dept.satellites?.map((s: any) => s.id) || (dept.satelliteId ? [dept.satelliteId] : []),
    })
  }

  const TABS: { id: Tab; label: string; count: number }[] = [
    { id: 'active', label: 'Active', count: activeCount },
    { id: 'archived', label: 'Archived (Admin Only)', count: archivedCount },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Departments & Divisions"
        description="Manage operational directorates, assigned ground paths, and decommissioning states."
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => setModalOpen(true)}
          >
            <Plus size={13} strokeWidth={2.2} />
            New department
          </Button>
        }
      />

      {/* Tabs */}
      <div className="-mt-2 flex items-center gap-1 border-b border-border-subtle">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            aria-pressed={tab === item.id}
            className={`flex items-center gap-2 border-b-2 px-3 pb-2.5 text-[11px] font-bold tracking-[0.1em] uppercase transition-colors duration-150 ${
              tab === item.id
                ? 'border-b-accent text-accent-light'
                : 'border-b-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            <span>{item.label}</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono font-semibold ${
                tab === item.id
                  ? 'bg-accent/20 text-accent-light'
                  : 'bg-surface text-text-dim'
              }`}
            >
              {item.count}
            </span>
          </button>
        ))}
      </div>

      {/* Information strip for Archived tab */}
      {tab === 'archived' && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs text-slate-300">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-amber-300 font-bold uppercase tracking-wider">Archived Department Access Notice: </strong>
            Archived divisions are completely hidden from regular members and the public portal. All physical files, folders, and checksums remain safely preserved on RAID storage and can be inspected or downloaded exclusively by administrators.
          </p>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="rounded-xl border border-border-subtle bg-card p-12 text-center text-xs text-text-dim">
          Loading departments...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border-subtle bg-card py-16 text-center">
          {tab === 'archived' ? (
            <Archive
              size={24}
              strokeWidth={1.5}
              aria-hidden="true"
              className="mx-auto text-text-dim"
            />
          ) : (
            <Building2
              size={24}
              strokeWidth={1.5}
              aria-hidden="true"
              className="mx-auto text-text-dim"
            />
          )}

          <p className="mt-4 text-[13px] font-bold text-text-primary">
            No {tab} departments
          </p>

          <p className="mt-1.5 text-xs text-text-muted">
            {tab === 'active'
              ? 'Create a department to get started.'
              : 'Archived / decommissioned departments will appear here for admin-only inspection.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filtered.map((dept) => (
            <article
              key={dept.id}
              className={`flex flex-col overflow-hidden rounded-xl border transition-colors duration-150 ${
                dept.archived
                  ? 'border-amber-500/30 bg-[#070e1a] hover:border-amber-500/50'
                  : 'border-border-subtle bg-card hover:border-border-default'
              } shadow-card`}
            >
              {/* Head: identity on the left, decisions on the right. */}
              <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-4 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Building2
                    size={15}
                    strokeWidth={1.7}
                    aria-hidden="true"
                    className={`shrink-0 ${dept.archived ? 'text-amber-400' : 'text-accent-light'}`}
                  />

                  <p className="truncate text-[13px] font-bold text-text-primary">
                    {dept.name}
                  </p>

                  {dept.archived ? (
                    <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-300">
                      <Lock size={10} />
                      Archived (Admin Only)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded bg-nominal/15 border border-nominal/30 px-2 py-0.5 text-[10px] font-mono font-bold text-nominal">
                      Active
                    </span>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  {!dept.archived && (
                    <button
                      type="button"
                      onClick={() => openEdit(dept)}
                      className="text-[11px] font-bold tracking-[0.06em] uppercase text-accent-light transition-colors duration-150 hover:text-white cursor-pointer"
                    >
                      Edit
                    </button>
                  )}

                  {dept.archived ? (
                    <button
                      type="button"
                      onClick={() => handleRestore(dept.id, dept.name)}
                      disabled={archiveDept.isPending}
                      className="inline-flex items-center gap-1 text-[11px] font-bold tracking-[0.06em] uppercase text-nominal hover:text-white transition-colors duration-150 disabled:opacity-40 cursor-pointer"
                    >
                      <RotateCcw size={11} strokeWidth={2.2} />
                      Restore
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmingArchiveDept(dept)
                        setUnderstandRisk(false)
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-bold tracking-[0.06em] uppercase text-amber-400/80 hover:text-amber-300 transition-colors duration-150 cursor-pointer"
                    >
                      <Archive size={11} strokeWidth={2.2} />
                      Archive
                    </button>
                  )}
                </div>
              </div>

              {/* Storage path & details */}
              <div className="px-4 py-3 space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <p className="col-label">Physical Storage Root</p>
                    <span className="num text-[10px] font-mono text-text-dim">{dept.code || 'OPS'} Division</span>
                  </div>
                  <p className="num mt-1 break-all text-[11px] leading-5 text-text-secondary font-mono bg-surface/60 px-2.5 py-1.5 rounded border border-border-subtle">
                    {dept.hddPath}
                  </p>
                </div>

                {/* Footer Actions */}
                <div className="pt-2 border-t border-border-subtle flex items-center justify-between">
                  {dept.archived ? (
                    <>
                      <div className="flex items-center gap-1.5 text-[11px] text-amber-400/90 font-mono">
                        <Lock size={12} />
                        <span>Hidden from Members</span>
                      </div>

                      <Link
                        to={`/admin/files?deptId=${dept.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/20 hover:text-white transition-all shadow-sm"
                      >
                        <FolderOpen size={13} />
                        <span>Browse Files & Folders (Admin)</span>
                        <ArrowRight size={11} />
                      </Link>
                    </>
                  ) : (
                    <>
                      <span className="text-[11px] text-text-dim">
                        {dept.fileCount ?? 0} files in repository
                      </span>

                      <div className="flex items-center gap-2">
                        <Link
                          to={`/admin/files?deptId=${dept.id}`}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-white transition-colors"
                        >
                          <FolderOpen size={12} />
                          <span>Files</span>
                        </Link>
                        <span className="text-text-dim">·</span>
                        <Link
                          to={`/departments/${dept.id}`}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-light hover:text-white transition-colors"
                        >
                          <span>Portal Page</span>
                          <ExternalLink size={11} />
                        </Link>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Archive Warning Modal */}
      {confirmingArchiveDept && (
        <Modal
          isOpen={true}
          onClose={() => {
            setConfirmingArchiveDept(null)
            setUnderstandRisk(false)
          }}
          title="Decommission & Archive Division"
          size="lg"
        >
          <div className="space-y-4">
            {/* Warning Banner */}
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5">
              <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-text-primary space-y-1">
                <p className="font-bold text-amber-300 uppercase tracking-wide">
                  Operational Decommissioning Warning
                </p>
                <p className="text-text-secondary leading-relaxed">
                  You are archiving <strong className="text-white">{confirmingArchiveDept.name}</strong> ({confirmingArchiveDept.code || 'DIVISION'}). Please review the operational impact:
                </p>
              </div>
            </div>

            {/* Consequence Bullet List */}
            <div className="space-y-2.5 rounded-xl border border-border-default bg-[#070e1c] p-3.5 text-xs">
              <div className="flex items-start gap-2.5">
                <span className="text-rose-400 font-bold text-sm leading-none">•</span>
                <p className="text-text-secondary">
                  <strong className="text-white">Hidden from Station Members:</strong> Regular members will immediately lose access. The department will disappear from member navigation, file dropzones, and the landing directory.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="text-amber-400 font-bold text-sm leading-none">•</span>
                <p className="text-text-secondary">
                  <strong className="text-white">Upload Ingest Suspended:</strong> Telemetry file uploads and folder creation for this division will be blocked.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="text-emerald-400 font-bold text-sm leading-none">•</span>
                <p className="text-text-secondary">
                  <strong className="text-white">Files Safely Preserved in RAID:</strong> All existing telemetry files, checksums, and folder structures remain 100% untouched on disk.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="text-cyan-400 font-bold text-sm leading-none">•</span>
                <p className="text-text-secondary">
                  <strong className="text-white">Admin-Only Inspection:</strong> Only System Administrators can view, browse, and download files from this department in the Admin File Repository.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="text-accent-light font-bold text-sm leading-none">•</span>
                <p className="text-text-secondary">
                  <strong className="text-white">Fully Reversible:</strong> You can restore this department at any time from the "Archived" tab with 1-click.
                </p>
              </div>
            </div>

            {/* Confirmation Checkbox */}
            <label className="flex items-start gap-2.5 p-3 rounded-lg border border-border-subtle bg-surface cursor-pointer select-none">
              <input
                type="checkbox"
                checked={understandRisk}
                onChange={(e) => setUnderstandRisk(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border-default accent-accent cursor-pointer"
              />
              <span className="text-xs text-text-primary leading-normal">
                I understand this department will be hidden from members and restricted strictly to administrators.
              </span>
            </label>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setConfirmingArchiveDept(null)
                  setUnderstandRisk(false)
                }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={!understandRisk || archiveDept.isPending}
                onClick={async () => {
                  if (!confirmingArchiveDept) return
                  await archiveDept.mutateAsync({
                    id: confirmingArchiveDept.id,
                    archived: true,
                  })
                  addToast({
                    title: 'Department Archived',
                    message: `${confirmingArchiveDept.name} is now archived and restricted strictly to administrators.`,
                    variant: 'warning',
                  })
                  setConfirmingArchiveDept(null)
                  setUnderstandRisk(false)
                  setTab('archived')
                }}
              >
                {archiveDept.isPending ? 'Archiving...' : 'Archive Division'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Department */}
      <CreateDeptModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
        isSubmitting={createDept.isPending}
      />

      {/* Edit Department */}
      <CreateDeptModal
        isOpen={editingDept !== null}
        onClose={() => setEditingDept(null)}
        onSubmit={handleEdit}
        initialValues={editingDept ?? undefined}
        isSubmitting={updateDept.isPending}
      />
    </div>
  )
}
