import { useEffect, useState } from 'react'
import { HelpTip } from '../components/HelpTip'
import { Link } from 'react-router-dom'
import { Satellite, ArrowRight, HardDrive, Maximize2, Search, X, RotateCcw } from 'lucide-react'
import { departmentsApi, type Department } from '../api/departments.api'
import { Navbar, Footer, ImageLightboxModal, Table } from '../components'
import { ViewToggle, useViewMode } from '../components/ViewToggle'
import { ImageWithFallback } from '../components/ImageWithFallback'

function getDeptBanner(dept: Department): string {
  if (dept.pageBannerUrl) {
    try {
      const parsed = JSON.parse(dept.pageBannerUrl)
      if (Array.isArray(parsed) && parsed[0]?.url) return parsed[0].url
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.slides) && parsed.slides[0]?.url) {
        return parsed.slides[0].url
      }
    } catch {
      if (dept.pageBannerUrl.startsWith('http')) return dept.pageBannerUrl
    }
  }
  return ''
}

export function DepartmentsList() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [previewDept, setPreviewDept] = useState<Department | null>(null)
  const [viewMode, setViewMode] = useViewMode('departments-list')

  useEffect(() => {
    departmentsApi
      .getPublicDepartments()
      .then((data) => setDepartments(data || []))
      .finally(() => setIsLoading(false))
  }, [])

  const filtered = departments.filter(
    (d) =>
      d.name.toLowerCase().includes(query.toLowerCase()) ||
      d.code?.toLowerCase().includes(query.toLowerCase()) ||
      d.satellite?.name?.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-page text-text-primary antialiased">
      <Navbar />

      <main className="pb-24">
        {/* Header */}
        <section className="relative isolate border-b border-border-subtle bg-gradient-to-br from-page via-page-soft/85 to-page dark:from-[#060a12] dark:via-[#0a1120] dark:to-[#070c17] py-14 lg:py-18 overflow-hidden transition-colors duration-200">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            {/* Precision Graticule Grid */}
            <div className="graticule absolute inset-0 opacity-20 dark:opacity-35 [mask-image:radial-gradient(ellipse_at_65%_45%,black_40%,transparent_90%)]" />

            {/* Atmospheric Diffuse Lighting */}
            <div className="absolute -top-10 right-1/4 h-[440px] w-[560px] rounded-full bg-secondary/10 dark:bg-secondary/15 blur-3xl" />
            <div className="absolute top-1/4 -right-10 h-[380px] w-[460px] rounded-full bg-accent/5 dark:bg-accent/8 blur-3xl" />
            <div className="absolute bottom-0 left-1/4 h-64 w-96 rounded-full bg-secondary/5 dark:bg-secondary/10 blur-2xl" />

            {/* High-Precision Orbital Tracking Radar & Coordinate HUD */}
            <svg
              className="absolute -right-20 -top-16 sm:-right-10 sm:-top-10 lg:right-4 lg:top-1/2 lg:-translate-y-1/2 h-[480px] w-[480px] sm:h-[540px] sm:w-[540px] lg:h-[620px] lg:w-[620px] text-secondary/30 dark:text-secondary/45 pointer-events-none select-none transition-all"
              viewBox="0 0 600 600"
              fill="none"
              stroke="currentColor"
            >
              {/* Telemetry Radial Sector / Downlink Beam */}
              <path
                d="M 300 300 L 512 178 A 245 245 0 0 0 422 108 Z"
                fill="currentColor"
                fillOpacity="0.05"
                stroke="none"
              />
              <path
                d="M 300 300 L 422 108"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeDasharray="4 4"
                className="opacity-70"
              />
              <path
                d="M 300 300 L 512 178"
                stroke="currentColor"
                strokeWidth="1.2"
                className="opacity-80"
              />

              {/* Concentric Calibration & Range Rings */}
              <circle cx="300" cy="300" r="60" strokeWidth="1" strokeDasharray="2 4" className="opacity-40" />
              <circle cx="300" cy="300" r="120" strokeWidth="1" strokeDasharray="4 4" className="opacity-60" />
              <circle cx="300" cy="300" r="180" strokeWidth="1" className="opacity-70" />
              <circle cx="300" cy="300" r="245" strokeWidth="1.25" strokeDasharray="8 6" className="opacity-80" />
              <circle cx="300" cy="300" r="280" strokeWidth="1.5" className="opacity-90" />
              <circle cx="300" cy="300" r="290" strokeWidth="0.75" strokeDasharray="2 6" className="opacity-50" />

              {/* Azimuth Crosshairs with Center Reticle Isolation */}
              <line x1="20" y1="300" x2="270" y2="300" strokeWidth="1" strokeDasharray="6 4" className="opacity-60" />
              <line x1="330" y1="300" x2="580" y2="300" strokeWidth="1" strokeDasharray="6 4" className="opacity-60" />
              <line x1="300" y1="20" x2="300" y2="270" strokeWidth="1" strokeDasharray="6 4" className="opacity-60" />
              <line x1="300" y1="330" x2="300" y2="580" strokeWidth="1" strokeDasharray="6 4" className="opacity-60" />

              {/* 45-Degree Diagonal Trajectory Guides */}
              <line x1="130" y1="130" x2="265" y2="265" strokeWidth="0.75" strokeDasharray="3 5" className="opacity-35" />
              <line x1="335" y1="335" x2="470" y2="470" strokeWidth="0.75" strokeDasharray="3 5" className="opacity-35" />
              <line x1="470" y1="130" x2="335" y2="265" strokeWidth="0.75" strokeDasharray="3 5" className="opacity-35" />
              <line x1="265" y1="335" x2="130" y2="470" strokeWidth="0.75" strokeDasharray="3 5" className="opacity-35" />

              {/* Center Tracking Core Node */}
              <circle cx="300" cy="300" r="14" strokeWidth="1" className="opacity-80" />
              <circle cx="300" cy="300" r="4" fill="var(--color-nominal, #10b981)" stroke="none" className="animate-pulse" />

              {/* High-Precision Telemetry HUD Text Annotations (DejaVu Sans Mono) */}
              <text x="306" y="26" fill="currentColor" fontSize="10" fontFamily="'DejaVu Sans Mono', monospace" fontWeight="700" letterSpacing="0.08em" stroke="none" className="opacity-80">
                000° N
              </text>
              <text x="548" y="294" fill="currentColor" fontSize="10" fontFamily="'DejaVu Sans Mono', monospace" fontWeight="700" letterSpacing="0.08em" stroke="none" className="opacity-80">
                090° E
              </text>
              <text x="306" y="580" fill="currentColor" fontSize="10" fontFamily="'DejaVu Sans Mono', monospace" fontWeight="700" letterSpacing="0.08em" stroke="none" className="opacity-80">
                180° S
              </text>
              <text x="26" y="294" fill="currentColor" fontSize="10" fontFamily="'DejaVu Sans Mono', monospace" fontWeight="700" letterSpacing="0.08em" stroke="none" className="opacity-80">
                270° W
              </text>
              <text x="312" y="124" fill="currentColor" fontSize="8" fontFamily="'DejaVu Sans Mono', monospace" fontWeight="600" letterSpacing="0.04em" stroke="none" className="opacity-60">
                R-500KM
              </text>
              <text x="312" y="60" fill="currentColor" fontSize="8" fontFamily="'DejaVu Sans Mono', monospace" fontWeight="600" letterSpacing="0.04em" stroke="none" className="opacity-60">
                R-1000KM
              </text>
              <text x="340" y="318" fill="currentColor" fontSize="8" fontFamily="'DejaVu Sans Mono', monospace" fontWeight="600" letterSpacing="0.08em" stroke="none" className="opacity-50">
                ISTRAC MOX AZ/EL
              </text>
            </svg>

            {/* Bottom Hairline Baseline with Telemetry Beam Glow */}
            <div
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-border-default to-transparent opacity-80"
            />
            <div
              aria-hidden="true"
              className="absolute inset-x-1/4 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-secondary/60 to-transparent blur-[1px]"
            />
          </div>
          <div className="shell relative z-10">
            <p className="eyebrow flex items-center gap-2.5 text-secondary dark:text-sky-400">
              <span aria-hidden="true" className="h-2.5 w-px bg-secondary dark:bg-sky-400" />
              ISTRAC Ground Network
            </p>

            <h1 className="display mt-4 text-3xl font-bold tracking-tight text-text-primary sm:text-5xl">
              Operational Divisions & Departments.
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-relaxed text-text-secondary">
              Browse ISTRAC departmental mission centers, tracking divisions, and telemetry processing units across ground stations.
            </p>

          </div>
        </section>

        {/* Directory Controls (STICKY ON SCROLL) */}
        <div className="shell mt-6 sticky top-16 z-20">
          <div className="p-3.5 rounded-xl border border-border-default bg-card/95 backdrop-blur-md shadow-lg shadow-black/10 dark:shadow-black/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all">
            <div className="relative flex-1 max-w-md">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
              <input
                id="dept-search"
                type="text"
                placeholder="Search division name, code (e.g. FDD, TTC)..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-lg border border-border-default bg-surface pl-9 pr-8 py-2 text-xs text-text-primary placeholder:text-text-dim outline-none focus:outline-none focus:ring-0 focus:border-secondary transition-colors"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-primary cursor-pointer"
                  title="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
              <span className="text-xs text-text-dim whitespace-nowrap">
                Showing <strong className="text-text-primary num">{filtered.length}</strong> divisions
              </span>
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-accent/40 bg-accent/10 text-xs font-bold text-accent-light hover:text-white hover:bg-accent transition-all cursor-pointer shrink-0"
                  title="Clear search filter"
                >
                  <RotateCcw size={12} />
                  <span>Reset</span>
                </button>
              )}
              <div className="flex items-center gap-1.5">
                <ViewToggle mode={viewMode} onChange={setViewMode} />
                <HelpTip topic="departments" />
              </div>
            </div>
          </div>
        </div>

        {/* Directory Grid */}
        <div className="shell mt-6">
          {isLoading ? (
            <div className="py-20 text-center text-text-dim">
              <Satellite size={32} className="mx-auto text-accent-light animate-spin-slow mb-4" />
              <p className="num text-sm text-text-secondary">Loading operational divisions...</p>
            </div>
          ) : viewMode === 'table' ? (
            <div className="rounded-xl border border-border-default bg-card overflow-hidden">
              <Table
                data={filtered}
                emptyMessage={query ? `No departments match "${query}".` : 'No departments yet.'}
                columns={[
                  { key: 'code', header: 'Code', render: (d) => <span className="num font-bold text-accent-light">{d.code || '—'}</span> },
                  {
                    key: 'name',
                    header: 'Division',
                    render: (d) => (
                      <Link to={`/departments/${d.id}`} className="font-semibold text-text-primary hover:text-accent-light hover:underline">
                        {d.pageTitle || d.name}
                      </Link>
                    ),
                  },
                  { key: 'description', header: 'About', wrap: true, render: (d) => <span className="text-xs text-text-secondary line-clamp-2">{d.pageAbout || d.description || '—'}</span> },
                  { key: 'fileCount', header: 'Datasets', numeric: true, render: (d) => d.fileCount ?? 0 },
                  {
                    key: 'open',
                    header: '',
                    render: (d) => (
                      <Link to={`/departments/${d.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-accent-light hover:underline">
                        View <ArrowRight size={12} />
                      </Link>
                    ),
                  },
                ]}
              />
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((dept) => {
                const bannerImg = getDeptBanner(dept)

                return (
                  <Link
                    key={dept.id}
                    to={`/departments/${dept.id}`}
                    className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border-default bg-card shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-2xl"
                  >
                    {/* Visual Banner Thumbnail */}
                    <div className="relative h-44 w-full overflow-hidden border-b border-border-subtle bg-[#060b16]">
                      <ImageWithFallback
                        src={bannerImg}
                        alt={dept.name}
                        className="h-full w-full object-cover transition-transform duration-700"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#060b16] via-transparent to-transparent" />

                      {/* Division Shortcode Tag */}
                      {dept.code && (
                        <span className="absolute top-3 right-3 num font-mono rounded-full border border-accent/40 bg-[#060b16]/80 backdrop-blur-md px-2.5 py-0.5 text-xs font-bold text-accent-light shadow-md">
                          {dept.code}
                        </span>
                      )}

                      {/* Enlarge Image Preview Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setPreviewDept(dept)
                        }}
                        className="absolute top-3 left-3 flex h-7 w-7 items-center justify-center rounded-lg border border-white/20 bg-black/60 text-white/80 hover:text-white hover:bg-accent hover:border-accent backdrop-blur-md transition-all shadow-md cursor-pointer"
                        title="Enlarge facility image"
                        aria-label={`Enlarge image for ${dept.name}`}
                      >
                        <Maximize2 size={13} />
                      </button>

                      {/* Telemetry Indicator */}
                      <div className="absolute bottom-2.5 left-3 flex items-center gap-1.5 text-[10px] font-mono font-bold text-nominal bg-[#060b16]/80 px-2 py-0.5 rounded-full border border-nominal/30 backdrop-blur-sm">
                        <span className="h-1.5 w-1.5 rounded-full bg-nominal animate-pulse" />
                        <span>LIVE DIVISION</span>
                      </div>
                    </div>

                    <div className="p-6 flex flex-col justify-between flex-1">
                      <div>
                        <h3 className="text-base font-bold text-text-primary group-hover:text-accent-light transition-colors">
                          {dept.pageTitle || dept.name}
                        </h3>

                        <p className="mt-2 text-xs leading-relaxed text-text-muted line-clamp-2">
                          {dept.pageAbout || dept.description || 'Provides telemetry processing, satellite operations, and mission telemetry data archiving.'}
                        </p>
                      </div>

                      <div className="mt-6 border-t border-border-subtle pt-4 flex items-center justify-between text-[11px] text-text-dim">
                        <span className="num text-text-secondary font-medium flex items-center gap-1">
                          <HardDrive size={12} className="text-accent-light" />
                          <span>{dept.fileCount ?? 0} Datasets</span>
                        </span>
                        <span className="flex items-center gap-1 font-semibold text-accent-light group-hover:underline">
                          View Division <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              })}

              {filtered.length === 0 && (
                <div className="col-span-full py-16 text-center text-text-muted rounded-2xl border border-dashed border-border-default bg-card">
                  <p className="text-sm font-semibold text-text-primary">No departments match "{query}"</p>
                  <p className="num mt-1 text-xs text-text-dim">Try searching with a different term.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Enlarged Image Preview Lightbox */}
      <ImageLightboxModal
        isOpen={previewDept !== null}
        onClose={() => setPreviewDept(null)}
        images={
          previewDept
            ? [
                {
                  url: getDeptBanner(previewDept),
                  title: previewDept.name,
                  caption:
                    previewDept.pageAbout ||
                    previewDept.description ||
                    `${previewDept.name} (${previewDept.code || 'OPS'}) Ground Station Operations Directorate`,
                  alt: previewDept.name,
                  tag: `/${previewDept.code || 'OPS'}`,
                  station: `${previewDept.name} · ISTRAC Global Ground Station Network`,
                },
              ]
            : []
        }
      />

      <Footer />
    </div>
  )
}
