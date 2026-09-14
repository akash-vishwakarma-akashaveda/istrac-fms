import { useState, useMemo } from "react"
import { Link } from "react-router-dom"
import {
  Radio,
  Sparkles,
  ArrowRight,
  Layers,
  Lock,
} from "lucide-react"
import { usePublicDepartments } from "../hooks/useDepartments"
import { useCms } from "../context/cmsContext"
import { useAuthStore } from "../store/authStore"
import { useAuthModalStore } from "../store/authModalStore"
import { useToastStore } from "../store/toastStore"
import { canAccessSatellite } from "../lib/permissions"
import { SatelliteInfoModal } from "./SatelliteInfoModal"

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
  const customCmsContent = cmsConfig?.customContent || {}

  const user = useAuthStore((s) => s.user)
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

  return (
    <section id="departments-showcase" className="border-b border-border-subtle/80 bg-[#080d17]/60 py-16 sm:py-20" aria-labelledby="divisions-title">
      <div className="shell space-y-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 border-b border-border-subtle/70 pb-6">
          <div className="space-y-2 max-w-2xl">
            <p className="eyebrow flex items-center gap-2 text-accent-light">
              <Sparkles size={13} />
              <span>{sectionEyebrow}</span>
            </p>
            <h2 id="divisions-title" className="display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white">
              {sectionTitle}
            </h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              {sectionSubtitle}
            </p>
          </div>

          <Link
            to="/departments"
            className="inline-flex items-center gap-2 rounded-xl border border-border-default bg-card px-4 py-2.5 text-xs font-bold text-accent-light hover:border-accent hover:text-white transition-all shadow-sm shrink-0 group"
          >
            <Layers size={14} className="group-hover:scale-110 transition-transform" />
            <span>Explore All Divisions ({departments.length})</span>
            <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Loading State or Divisions Grid */}
        {loading ? (
          <div className="py-16 text-center text-xs text-text-dim">
            Loading operational divisions from database…
          </div>
        ) : departments.length === 0 ? (
          <div className="rounded-2xl border border-border-subtle bg-[#0b1220] p-12 text-center text-xs text-text-dim">
            No divisions found in database.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {orderedDepartments.map((dept) => {
              const cmsData = customCmsContent[dept.id] || {}
              const title = cmsData.title || dept.name
              const code = cmsData.code || dept.code || "DIV"
              const leadOfficer = cmsData.labLead || dept.pageLeadOfficer || "Division Director"
              const description = cmsData.customMandate !== undefined ? cmsData.customMandate : (dept.pageAbout || dept.description || "Ground telemetry downlink processing, orbit determination, and operational monitoring.")

              return (
                <div
                  key={dept.id}
                  className="rounded-2xl border border-border-default bg-[#0b1220]/90 p-6 shadow-xl backdrop-blur-sm hover:border-accent/50 transition-all flex flex-col justify-between space-y-4 group hover:shadow-2xl hover:shadow-accent/10"
                >
                  <div className="space-y-3.5">
                    {/* Header Badge Row */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 border border-accent/30 text-accent-light group-hover:scale-105 transition-transform">
                          <Radio size={18} />
                        </div>
                        <span className="num rounded-md bg-surface border border-border-subtle px-2 py-0.5 text-xs font-bold text-accent-light">
                          {code}
                        </span>
                      </div>

                      {showFileCount && (
                        <span className="num text-[11px] font-bold text-text-dim rounded-full bg-surface px-2.5 py-0.5 border border-border-subtle">
                          {dept.fileCount ?? 0} Active Files
                        </span>
                      )}
                    </div>

                    {/* Division Title */}
                    <div>
                      <h3 className="text-base font-bold text-white group-hover:text-accent-light transition-colors line-clamp-1">
                        {title}
                      </h3>
                      <p className="text-xs text-text-secondary mt-1 line-clamp-3 leading-relaxed">
                        {description}
                      </p>
                    </div>

                    {/* Linked Spacecraft / Satellites Badges */}
                    {dept.satellites && dept.satellites.length > 0 && (
                      <div className="pt-2 border-t border-border-subtle/50">
                        <div className="flex items-center justify-between text-[10px] text-text-dim uppercase font-bold tracking-wider mb-1.5">
                          <span className="flex items-center gap-1">
                            <Radio size={11} className="text-accent-light" />
                            <span>Supported Spacecraft:</span>
                          </span>
                          <span className="font-mono text-accent-light font-bold">
                            {dept.satellites.length}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
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
                                    addToast({
                                      title: 'Access Restricted',
                                      message: 'You are not authorized to see',
                                      variant: 'warning',
                                    })
                                    return
                                  }
                                  setViewingSatelliteId(sat.id)
                                }}
                                className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-all cursor-pointer shadow-sm ${
                                  hasAccess
                                    ? 'border-accent/30 bg-accent/10 text-accent-light hover:bg-accent hover:text-white'
                                    : 'border-border-subtle bg-surface/80 text-text-dim hover:border-warning/40 hover:text-warning'
                                }`}
                                title={
                                  !user
                                    ? `Sign in to view live telemetry dossier for ${sat.name}`
                                    : hasAccess
                                    ? `Click to view live telemetry dossier for ${sat.name}`
                                    : `Restricted: You are not authorized to see telemetry for ${sat.name}`
                                }
                              >
                                <span className={`h-1.5 w-1.5 rounded-full ${hasAccess ? 'bg-nominal' : 'bg-warning/70'}`} />
                                <span className="font-mono font-semibold">
                                  {sat.satId || sat.code || sat.name}
                                </span>
                                {!hasAccess && <Lock size={9} className="opacity-70 ml-0.5 text-warning" />}
                              </button>
                            )
                          })}
                          {dept.satellites.length > 3 && (
                            <span className="rounded-md border border-border-subtle bg-surface px-1.5 py-0.5 text-[10px] text-text-dim font-mono">
                              +{dept.satellites.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer Officer & Direct Link */}
                  <div className="pt-3.5 border-t border-border-subtle/80 flex items-center justify-between text-xs">
                    {showLeadOfficer ? (
                      <div className="min-w-0 pr-2">
                        <span className="text-[10px] text-text-dim uppercase font-bold block">Officer in Charge</span>
                        <span className="text-xs font-bold text-text-primary truncate block">
                          {leadOfficer}
                        </span>
                      </div>
                    ) : <div />}

                    <Link
                      to={`/departments/${dept.id}`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-accent-light hover:text-white group-hover:underline shrink-0"
                    >
                      <span>View Details</span>
                      <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Satellite Detailed Dossier Modal */}
      <SatelliteInfoModal
        satelliteId={viewingSatelliteId}
        isOpen={Boolean(viewingSatelliteId)}
        onClose={() => setViewingSatelliteId(null)}
      />
    </section>
  )
}

