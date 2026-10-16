import { useState, useMemo } from "react"
import { Link } from "react-router-dom"
import { ArrowRight, Lock, SlidersHorizontal } from "lucide-react"
import { usePublicDepartments } from "../hooks/useDepartments"
import { useCms } from "../context/cmsContext"
import { useAuthStore } from "../store/authStore"
import { useAuthModalStore } from "../store/authModalStore"
import { useToastStore } from "../store/toastStore"
import { canAccessSatellite } from "../lib/permissions"
import { SatelliteInfoModal } from "./SatelliteInfoModal"
import { SectionHeader } from "./SectionHeader"

interface DepartmentCmsData {
  title?: string
  code?: string
  labLead?: string
  roomLocation?: string
  facilities?: string[]
  customMandate?: string
  leadRole?: string
}

interface DepartmentPagesBlock {
  sectionEyebrow?: string
  sectionTitle?: string
  sectionSubtitle?: string
  showFileCount?: boolean
  showLeadOfficer?: boolean
  layoutMode?: 'cards' | 'table'
  order?: string[]
  customContent?: Record<string, DepartmentCmsData>
}

export function OperationalDivisions() {
  const { cmsBlocks } = useCms()
  const cmsConfig = cmsBlocks["department_pages"] as DepartmentPagesBlock | undefined

  const sectionEyebrow = cmsConfig?.sectionEyebrow || "ISRO ISTRAC COMMAND SECTORS"
  const sectionTitle = cmsConfig?.sectionTitle || "Operational Divisions & Facilities"
  const sectionSubtitle = cmsConfig?.sectionSubtitle || "Specialized engineering directorates processing satellite downlinks, mission trajectory maneuvers, space situational awareness, and global antenna telemetry."
  const showFileCount = cmsConfig?.showFileCount !== false
  const showLeadOfficer = cmsConfig?.showLeadOfficer !== false
  const layoutMode = cmsConfig?.layoutMode === 'table' ? 'table' : 'cards'
  const customCmsContent = cmsConfig?.customContent || {}

  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'ADMIN'
  const openLogin = useAuthModalStore((s) => s.openLogin)
  const addToast = useToastStore((s) => s.addToast)

  const { data: deptsData, isLoading: loading } = usePublicDepartments()
  const departments = deptsData || []
  const [viewingSatelliteId, setViewingSatelliteId] = useState<string | null>(null)

  // Rearrange department cards according to custom CMS order, falling back to database default
  const orderedDepartments = useMemo(() => {
    if (!cmsConfig?.order || !Array.isArray(cmsConfig.order) || cmsConfig.order.length === 0) {
      return departments
    }
    const order = cmsConfig.order
    return [...departments].sort((a, b) => {
      const idxA = order.indexOf(a.id)
      const idxB = order.indexOf(b.id)
      if (idxA !== -1 && idxB !== -1) return idxA - idxB
      if (idxA !== -1) return -1
      if (idxB !== -1) return 1
      return a.name.localeCompare(b.name)
    })
  }, [departments, cmsConfig?.order])

  // Spacecraft chips: signed-out users are sent to sign in, users without access get a notice.
  const renderSatellites = (dept: (typeof departments)[number]) => {
    if (!dept.satellites || dept.satellites.length === 0) return null
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {dept.satellites.slice(0, 3).map((sat) => {
          const hasAccess = canAccessSatellite(user, sat, dept.id)
          return (
            <button
              key={sat.id}
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (!user) {
                  openLogin()
                  return
                }
                if (!hasAccess) {
                  addToast({ title: 'Access Restricted', message: 'You are not authorized to see', variant: 'warning' })
                  return
                }
                setViewingSatelliteId(sat.id)
              }}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                hasAccess
                  ? 'border-border-subtle bg-card text-text-secondary hover:border-accent hover:text-accent-light'
                  : 'border-border-subtle bg-card text-text-muted hover:border-warning/50 hover:text-warning'
              }`}
              title={
                !user
                  ? `Sign in to view details for ${sat.name}`
                  : hasAccess
                  ? `View details for ${sat.name}`
                  : `Restricted: you don't have access to ${sat.name}`
              }
            >
              <span className="font-mono">{sat.satId || sat.code || sat.name}</span>
              {!hasAccess && <Lock size={10} aria-label="Restricted" />}
            </button>
          )
        })}
        {dept.satellites.length > 3 && (
          <span className="px-1 text-xs text-text-muted">+{dept.satellites.length - 3} more</span>
        )}
      </div>
    )
  }

  const deptView = (dept: (typeof departments)[number]) => {
    const cmsData = customCmsContent[dept.id] || {}
    return {
      title: cmsData.title || dept.name,
      code: cmsData.code || dept.code || "DIV",
      leadOfficer: cmsData.labLead || dept.pageLeadOfficer || "Division Director",
      leadRole: cmsData.leadRole || dept.pageLeadRole || "Lead Specialist",
      description:
        cmsData.customMandate !== undefined
          ? cmsData.customMandate
          : dept.pageAbout || dept.description || "Ground telemetry downlink processing, orbit determination, and operational monitoring.",
    }
  }

  // Fill rows evenly on wide screens: 4 cards -> 4 across, 5-6 -> 3 across, 7-8 -> 4 across.
  const n = orderedDepartments.length
  const desktopCols = n <= 2 ? '' : n === 4 || n === 7 || n === 8 ? 'xl:grid-cols-4' : 'lg:grid-cols-3'

  return (
    <section id="departments-showcase" className="relative overflow-hidden bg-page pt-24 pb-24" aria-labelledby="divisions-title">
      <div aria-hidden="true" className="section-grid" />
      <div className="shell relative space-y-10">
        <SectionHeader
          id="divisions-title"
          eyebrow={sectionEyebrow}
          title={sectionTitle}
          subtitle={sectionSubtitle}
          actions={
            <>
              {isAdmin && (
                <Link
                  to="/admin/cms?tab=department_pages"
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-text-secondary hover:bg-surface hover:text-text-primary"
                  title="Admin only: edit divisions and choose card or table layout in the CMS"
                >
                  <SlidersHorizontal size={13} />
                  <span>Layout: <span className="capitalize">{layoutMode}</span></span>
                </Link>
              )}
              <Link
                to="/departments"
                className="inline-flex min-h-10 items-center gap-2 rounded-[10px] bg-saffron-soft px-4 text-sm font-semibold text-saffron-text transition-colors hover:bg-saffron-soft-hover"
              >
                <span>View all divisions ({departments.length})</span>
                <ArrowRight size={14} />
              </Link>
            </>
          }
        />

        {loading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4" aria-label="Loading divisions">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-56 animate-pulse rounded-xl border border-border-subtle bg-card" />
            ))}
          </div>
        ) : departments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-default bg-card p-12 text-center text-sm text-text-muted">
            No divisions have been set up yet.
          </div>
        ) : layoutMode === 'table' ? (
          <div className="overflow-hidden rounded-xl border border-border-subtle bg-card shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-border-subtle bg-surface text-xs font-semibold text-text-muted">
                    <th scope="col" className="w-28 px-5 py-3">Code</th>
                    <th scope="col" className="px-5 py-3">Division</th>
                    {showLeadOfficer && <th scope="col" className="w-52 px-5 py-3">Officer in charge</th>}
                    <th scope="col" className="min-w-[200px] px-5 py-3">Spacecraft</th>
                    {showFileCount && <th scope="col" className="w-24 px-5 py-3 text-right">Files</th>}
                    <th scope="col" className="w-28 px-5 py-3"><span className="sr-only">Action</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {orderedDepartments.map((dept) => {
                    const v = deptView(dept)
                    return (
                      <tr key={dept.id} className="transition-colors hover:bg-surface">
                        <td className="px-5 py-4 align-middle">
                          <span className="rounded-lg bg-blue-soft px-2.5 py-1 font-mono text-[13px] font-bold text-accent-light">{v.code}</span>
                        </td>
                        <td className="px-5 py-4 align-middle">
                          <div className="max-w-md">
                            <Link to={`/departments/${dept.id}`} className="block text-sm font-semibold text-text-primary hover:text-accent-light">
                              {v.title}
                            </Link>
                            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-text-secondary">{v.description}</p>
                          </div>
                        </td>
                        {showLeadOfficer && (
                          <td className="px-5 py-4 align-middle">
                            <span className="block text-sm font-medium text-text-primary">{v.leadOfficer}</span>
                            <span className="mt-0.5 block text-xs text-text-muted">{v.leadRole}</span>
                          </td>
                        )}
                        <td className="px-5 py-4 align-middle">
                          {renderSatellites(dept) ?? <span className="text-xs text-text-muted">—</span>}
                        </td>
                        {showFileCount && (
                          <td className="num px-5 py-4 text-right align-middle text-sm text-text-secondary">{dept.fileCount ?? 0}</td>
                        )}
                        <td className="px-5 py-4 text-right align-middle">
                          <Link
                            to={`/departments/${dept.id}`}
                            className="inline-flex items-center gap-1 text-sm font-semibold text-accent-light hover:underline"
                          >
                            <span>View</span>
                            <ArrowRight size={14} />
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className={`grid grid-cols-1 gap-5 sm:grid-cols-2 ${desktopCols}`}>
            {orderedDepartments.map((dept) => {
              const v = deptView(dept)
              const satellites = renderSatellites(dept)
              return (
                <article
                  key={dept.id}
                  className="flex flex-col rounded-2xl border border-border-subtle bg-card p-6 shadow-card transition-shadow hover:shadow-card-hover"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-lg bg-blue-soft px-2.5 py-1 font-mono text-[13px] font-bold text-accent-light">{v.code}</span>
                    {showFileCount && (
                      <span className="num text-xs text-text-muted">
                        {dept.fileCount ?? 0} {(dept.fileCount ?? 0) === 1 ? 'file' : 'files'}
                      </span>
                    )}
                  </div>

                  <h3 className="mt-4 text-lg font-bold leading-snug text-text-primary">
                    <Link to={`/departments/${dept.id}`} className="hover:text-accent-light">
                      {v.title}
                    </Link>
                  </h3>
                  <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-text-secondary">{v.description}</p>

                  {satellites && (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-medium text-text-muted">Spacecraft ({dept.satellites!.length})</p>
                      {satellites}
                    </div>
                  )}

                  <div className="mt-auto pt-5" />
                  <div className="flex items-center justify-between gap-3 border-t border-border-subtle pt-4">
                    {showLeadOfficer ? (
                      <div className="min-w-0">
                        <span className="block text-xs text-text-muted">Officer in charge</span>
                        <span className="block truncate text-sm font-medium text-text-primary">{v.leadOfficer}</span>
                      </div>
                    ) : <div />}
                    <Link
                      to={`/departments/${dept.id}`}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-[10px] bg-saffron-soft px-3.5 py-2 text-sm font-semibold text-saffron-text transition-colors hover:bg-saffron-soft-hover"
                      aria-label={`View details for ${v.title}`}
                    >
                      <span>View</span>
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>

      <SatelliteInfoModal
        satelliteId={viewingSatelliteId}
        isOpen={Boolean(viewingSatelliteId)}
        onClose={() => setViewingSatelliteId(null)}
      />
    </section>
  )
}
