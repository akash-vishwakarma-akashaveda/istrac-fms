import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Satellite,
  Lock,
  Radio,
  FileText,
  Building,
  LogIn,
  CheckCircle2,
  Calendar,
  ShieldCheck,
} from 'lucide-react'
import { departmentsApi, type Department } from '../api/departments.api'
import { useAuthStore } from '../store/authStore'
import { useCms } from '../context/cmsContext'
import { Navbar, Footer, Button } from '../components'
import type { MissionEvent } from '../components/MissionCalendar'

export function DepartmentDetail() {
  const { deptId } = useParams<{ deptId: string }>()
  const user = useAuthStore((s) => s.user)
  const { cmsBlocks } = useCms()

  const [dept, setDept] = useState<Department | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!deptId) return
    setIsLoading(true)
    departmentsApi
      .getPublicDepartment(deptId)
      .then((data) => setDept(data))
      .catch(() => {
        // Try fallback to list if ID is actually code
        departmentsApi.getPublicDepartments().then((list) => {
          const found = list.find((d) => d.id === deptId || d.code?.toLowerCase() === deptId.toLowerCase())
          if (found) setDept(found)
        })
      })
      .finally(() => setIsLoading(false))
  }, [deptId])

  // Fetch custom CMS content for this department if configured by admin
  const deptPagesCms = cmsBlocks['department_pages'] as
    | {
        customContent?: Record<
          string,
          {
            labLead?: string
            roomLocation?: string
            facilities?: string[]
            customMandate?: string
          }
        >
      }
    | undefined

  const customInfo =
    dept && deptPagesCms?.customContent
      ? deptPagesCms.customContent[dept.id] || (dept.code ? deptPagesCms.customContent[dept.code] : undefined)
      : undefined

  // Filter department specific events from CMS calendar
  const allEvents = (cmsBlocks['calendar_events']?.events as MissionEvent[]) || []
  const deptEvents = dept
    ? allEvents.filter(
        (e) =>
          e.department &&
          (e.department.toLowerCase() === dept.code?.toLowerCase() ||
            e.department.toLowerCase() === dept.name.toLowerCase())
      )
    : []

  if (isLoading) {
    return (
      <div className="min-h-screen bg-page text-text-primary">
        <Navbar />
        <div className="shell py-24 text-center">
          <Satellite size={32} className="mx-auto text-accent-light animate-spin-slow mb-4" />
          <p className="num text-sm text-text-secondary">Loading department telemetry profile...</p>
        </div>
        <Footer />
      </div>
    )
  }

  if (!dept) {
    return (
      <div className="min-h-screen bg-page text-text-primary">
        <Navbar />
        <div className="shell py-24 text-center">
          <h2 className="text-2xl font-bold text-text-primary">Department Not Found</h2>
          <p className="mt-2 text-sm text-text-muted">The requested ISTRAC operational division does not exist.</p>
          <Link to="/departments" className="mt-6 inline-block">
            <Button variant="primary">Return to Departments Directory</Button>
          </Link>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-page text-text-primary antialiased">
      <Navbar />

      <main className="pb-24">
        {/* Department Hero */}
        <section className="relative border-b border-border-subtle bg-page-soft py-16 lg:py-20 overflow-hidden">
          <div className="graticule absolute inset-0 opacity-30 pointer-events-none" />
          <div className="shell relative z-10">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-accent-light mb-4">
              <Link to="/departments" className="hover:underline">
                Departments Directory
              </Link>
              <span>/</span>
              <span className="text-text-dim">{dept.code || 'DIVISION'}</span>
            </div>

            <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
              <div className="lg:col-span-8">
                <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent-light mb-4">
                  <span className="h-2 w-2 rounded-full bg-nominal animate-pulse" />
                  <span>ISTRAC Operational Division</span>
                </div>

                <h1 className="display text-3xl font-bold tracking-tight text-text-primary sm:text-5xl">
                  {dept.name}
                </h1>

                <p className="mt-4 max-w-2xl text-base leading-relaxed text-text-secondary">
                  {customInfo?.customMandate ||
                    dept.description ||
                    'Responsible for real-time telemetry processing, command distribution, and orbital data archiving.'}
                </p>

                {/* Division Metrics */}
                <div className="mt-8 flex flex-wrap items-center gap-6 border-t border-border-subtle pt-6 text-xs text-text-muted">
                  <div>
                    <span className="eyebrow block text-[10px] text-text-dim">DIVISION CODE</span>
                    <span className="num mt-0.5 block text-sm font-bold text-text-primary">
                      {dept.code || 'N/A'}
                    </span>
                  </div>

                  <div>
                    <span className="eyebrow block text-[10px] text-text-dim">SATELLITE STATION</span>
                    <span className="num mt-0.5 block text-sm font-bold text-text-primary">
                      {dept.satellite?.name || 'Primary Ground Station (BLR)'}
                    </span>
                  </div>

                  <div>
                    <span className="eyebrow block text-[10px] text-text-dim">REPOSITORY STATUS</span>
                    <span className="num mt-0.5 flex items-center gap-1.5 text-sm font-bold text-nominal">
                      <CheckCircle2 size={14} /> {dept.fileCount ?? 0} Ingested Datasets
                    </span>
                  </div>
                </div>
              </div>

              {/* Lab Location & Contact Card */}
              <div className="lg:col-span-4">
                <div className="rounded-2xl border border-border-default bg-card p-6 shadow-xl">
                  <div className="flex items-center gap-2.5 border-b border-border-subtle pb-4">
                    <Building size={18} className="text-accent-light" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary">
                      Facility & Operations Lab
                    </h3>
                  </div>

                  <div className="mt-4 space-y-3 text-xs">
                    <div>
                      <span className="eyebrow text-text-dim block">Lab Location:</span>
                      <span className="num text-text-secondary">
                        {customInfo?.roomLocation || 'Building MOX-2, 2nd Floor, ISTRAC Bengaluru'}
                      </span>
                    </div>

                    <div>
                      <span className="eyebrow text-text-dim block">Division Lead / Operations Officer:</span>
                      <span className="text-text-primary font-medium">
                        {customInfo?.labLead || 'Division In-Charge, ISTRAC'}
                      </span>
                    </div>

                    <div>
                      <span className="eyebrow text-text-dim block">Data Stream Carrier:</span>
                      <span className="num text-nominal font-medium">
                        Dedicated Air-Gapped S-Band Fiber Link
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Division Facilities & Subsystems */}
        <div className="shell mt-12 grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-7 space-y-8">
            {/* Responsibilities */}
            <div className="rounded-2xl border border-border-default bg-card p-8 shadow-card">
              <h2 className="text-lg font-bold text-text-primary">Division Mandate & Capabilities</h2>
              <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                {dept.description ||
                  `${dept.name} provides critical ground segment operations for satellite missions, ensuring mission telemetry integrity and seamless telecommand distribution.`}
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {(
                  customInfo?.facilities || [
                    'Multi-mission telemetry validation & archiving',
                    'Direct telecommand packet uplink routing',
                    'Automated anomaly screening & alerting',
                    'SHA-256 verified data pipeline integration',
                  ]
                ).map((fac, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 rounded-lg border border-border-subtle bg-surface p-3 text-xs text-text-secondary"
                  >
                    <Radio size={14} className="text-accent-light shrink-0 mt-0.5" />
                    <span>{fac}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Department Events */}
            <div className="rounded-2xl border border-border-default bg-card p-8 shadow-card">
              <div className="flex items-center justify-between border-b border-border-subtle pb-4">
                <div className="flex items-center gap-2">
                  <Calendar size={18} className="text-accent-light" />
                  <h2 className="text-base font-bold text-text-primary">
                    Upcoming Passes & Department Events
                  </h2>
                </div>
                <span className="num text-[11px] text-text-dim">{deptEvents.length} events scheduled</span>
              </div>

              <div className="mt-4 space-y-3">
                {deptEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-start justify-between rounded-xl border border-border-subtle bg-surface p-4 text-xs"
                  >
                    <div>
                      <h4 className="font-bold text-text-primary">{ev.title}</h4>
                      <p className="mt-1 text-text-muted">{ev.description}</p>
                      <span className="num mt-2 inline-block text-[10px] text-accent-light">
                        📍 {ev.station}
                      </span>
                    </div>

                    <div className="text-right shrink-0 ml-4">
                      <span className="num font-semibold text-text-primary block">{ev.date}</span>
                      <span className="num text-text-dim block text-[11px]">{ev.time}</span>
                    </div>
                  </div>
                ))}

                {deptEvents.length === 0 && (
                  <div className="py-6 text-center text-xs text-text-muted">
                    No upcoming passes scheduled for this department currently.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Department Repository File Gate (5 cols) */}
          <div className="lg:col-span-5">
            <div className="sticky top-24 overflow-hidden rounded-2xl border border-border-default bg-card shadow-2xl">
              <div className="flex items-center justify-between border-b border-border-subtle bg-surface px-6 py-4">
                <div className="flex items-center gap-2">
                  <Lock size={16} className={user ? 'text-nominal' : 'text-warning'} />
                  <span className="eyebrow font-bold text-text-primary">
                    {user ? 'Department Repository' : 'Restricted Access Gate'}
                  </span>
                </div>
                <span className="num text-[10px] text-nominal font-bold">AIR-GAPPED FMS</span>
              </div>

              <div className="p-6">
                <h3 className="text-base font-bold text-text-primary">
                  {dept.name} File Archives
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-text-muted">
                  Storage and access for telemetry binaries, orbital logs, and documentation for {dept.name} are partitioned under strict role-based access control.
                </p>

                <div className="my-5 rounded-xl border border-border-subtle bg-surface p-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-muted">Ingested Datasets:</span>
                    <span className="num font-bold text-text-primary">{dept.fileCount ?? 0} Files</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-text-muted">Storage Volume:</span>
                    <span className="num font-bold text-accent-light">RAID Mounted</span>
                  </div>
                </div>

                {user ? (
                  <Link to={`/browse`}>
                    <Button variant="primary" size="md" className="w-full shadow-lg shadow-accent/25">
                      <FileText size={15} />
                      <span>Open Files Explorer</span>
                    </Button>
                  </Link>
                ) : (
                  <div className="space-y-3">
                    <Link to="/login">
                      <Button variant="primary" size="md" className="w-full shadow-lg shadow-accent/25">
                        <LogIn size={15} />
                        <span>Log In to Access Files</span>
                      </Button>
                    </Link>

                    <Link to="/register">
                      <Button variant="outline" size="md" className="w-full">
                        Request Department Authorization
                      </Button>
                    </Link>
                  </div>
                )}
              </div>

              <div className="border-t border-border-subtle bg-surface/50 px-6 py-3 text-[11px] text-text-dim flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck size={13} className="text-nominal" /> ISRO Air-Gapped Network
                </span>
                <span className="num">SEC-LEVEL 4</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
