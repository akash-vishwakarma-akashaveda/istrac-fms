import { Archive, Building2, Plus, RotateCcw, ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useDepartments,
  useCreateDepartment,
  useUpdateDepartment,
  useArchiveDepartment,
} from '../hooks/useDepartments'
import { useToastStore } from '../store/toastStore'
import { Button, Badge, PageHeader } from '../components'
import { CreateDeptModal } from '../components/CreateDeptModal'
import { HDD_ROOT } from '../../schemas/departmentSchema'

type Tab = 'active' | 'archived'

export function DepartmentManager() {
  const { data: departments, isLoading } = useDepartments()

  const createDept = useCreateDepartment()
  const updateDept = useUpdateDepartment()
  const archiveDept = useArchiveDepartment()
  const addToast = useToastStore((s) => s.addToast)

  const [tab, setTab] = useState<Tab>('active')
  const [modalOpen, setModalOpen] = useState(false)

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
  }) {
    if (!editingDept) return

    await updateDept.mutateAsync({
      id: editingDept.id,
      ...data,
    })

    addToast({ message: 'Department CMS updated', variant: 'success' })
    setEditingDept(null)
  }

  function handleArchiveToggle(
    id: string,
    name: string,
    currentlyArchived: boolean
  ) {
    archiveDept.mutate(
      {
        id,
        archived: !currentlyArchived,
      },
      {
        onSuccess: () =>
          addToast(
            {
              message: `${name} ${currentlyArchived ? 'restored' : 'archived'}`,
              variant: 'info',
            }
          ),

        onError: () => addToast({ message: 'Action failed', variant: 'error' }),
      }
    )
  }

  function openEdit(dept: any) {
    setEditingDept({
      id: dept.id,
      name: dept.name,
      code: dept.code || '',
      folderName: dept.hddPath ? dept.hddPath.replace(HDD_ROOT, '') : '',
      pageTitle: dept.pageTitle || '',
      pageAbout: dept.pageAbout || '',
      pageLeadOfficer: dept.pageLeadOfficer || '',
      pageLeadRole: dept.pageLeadRole || '',
      pageContact: dept.pageContact || '',
    })
  }

  const TABS: { id: Tab; label: string; count: number }[] = [
    { id: 'active', label: 'Active', count: activeCount },
    { id: 'archived', label: 'Archived', count: archivedCount },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Departments"
        description="Departments and the storage paths they write to."
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
            {item.label}

            <span
              className={`num text-[10px] tracking-normal ${
                tab === item.id ? 'text-accent-light' : 'text-text-dim'
              }`}
            >
              {item.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="animate-pulse rounded-xl border border-border-subtle bg-card p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2.5">
                  <div className="h-3.5 w-32 rounded-xs bg-card-hover" />
                  <div className="h-2.5 w-48 rounded-xs bg-card-hover" />
                </div>

                <div className="h-4 w-16 rounded-xs bg-card-hover" />
              </div>

              <div className="mt-6 h-2.5 w-24 rounded-xs bg-card-hover" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border-subtle bg-card px-6 py-14 text-center shadow-card">
          {tab === 'archived' ? (
            <Archive
              size={20}
              strokeWidth={1.5}
              aria-hidden="true"
              className="mx-auto text-text-dim"
            />
          ) : (
            <Building2
              size={20}
              strokeWidth={1.5}
              aria-hidden="true"
              className="mx-auto text-text-dim"
            />
          )}

          <p className="mt-4 text-[13px] text-text-primary">
            No {tab} departments
          </p>

          <p className="mt-1.5 text-[13px] text-text-muted">
            {tab === 'active'
              ? 'Create a department to get started.'
              : 'Archived departments will appear here.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filtered.map((dept) => (
            <article
              key={dept.id}
              className="flex flex-col overflow-hidden rounded-xl border border-border-subtle bg-card shadow-card transition-colors duration-150 hover:border-border-default"
            >
              {/* Head: identity on the left, decisions on the right. */}
              <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-4 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Building2
                    size={14}
                    strokeWidth={1.7}
                    aria-hidden="true"
                    className="shrink-0 text-accent-light"
                  />

                  <p className="truncate text-[13px] text-text-primary">
                    {dept.name}
                  </p>

                  {dept.archived && <Badge variant="neutral">Archived</Badge>}
                </div>

                <div className="flex shrink-0 items-center gap-4">
                  {!dept.archived && (
                    <button
                      type="button"
                      onClick={() => openEdit(dept)}
                      className="text-[11px] font-bold tracking-[0.06em] uppercase text-accent-light transition-colors duration-150 hover:text-text-primary"
                    >
                      Edit
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      handleArchiveToggle(
                        dept.id,
                        dept.name,
                        Boolean(dept.archived)
                      )
                    }
                    disabled={archiveDept.isPending}
                    className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.06em] uppercase text-text-muted transition-colors duration-150 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {dept.archived ? (
                      <>
                        <RotateCcw size={11} strokeWidth={2.2} />
                        Restore
                      </>
                    ) : (
                      <>
                        <Archive size={11} strokeWidth={2.2} />
                        Archive
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Storage path — a machine value, so mono and full width. */}
              <div className="px-4 py-3 space-y-2.5">
                <div>
                  <p className="col-label">Storage path</p>
                  <p className="num mt-1.5 break-all text-[11px] leading-5 text-text-secondary">
                    {dept.hddPath}
                  </p>
                </div>

                <div className="pt-2 border-t border-border-subtle flex items-center justify-between">
                  <span className="num text-[10px] text-text-dim">/{dept.code || 'OPS'} Division</span>

                  <Link
                    to={`/departments/${dept.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-light hover:text-white transition-colors"
                  >
                    <span>Open Department Page</span>
                    <ExternalLink size={12} />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
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
