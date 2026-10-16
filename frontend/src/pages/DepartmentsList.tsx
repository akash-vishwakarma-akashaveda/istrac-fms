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
        <section className="relative border-b border-border-subtle bg-page-soft py-14 lg:py-18 overflow-hidden">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="graticule absolute inset-0 opacity-25 [mask-image:radial-gradient(ellipse_at_50%_30%,black,transparent_80%)]" />
            <div className="absolute top-1/4 left-1/3 h-[420px] w-[580px] rounded-full bg-[#0284c7]/10 dark:bg-[#0284c7]/12 blur-3xl" />
            <div className="absolute -top-10 right-1/4 h-80 w-80 rounded-full bg-[#2563eb]/8 dark:bg-[#38bdf8]/6 blur-3xl" />
            {/* High-tech orbital range rings */}
            <svg className="absolute -right-20 -top-20 h-[500px] w-[500px] text-secondary/15 dark:text-sky-500/10 pointer-events-none" viewBox="0 0 500 500" fill="none" stroke="currentColor">
              <circle cx="250" cy="250" r="120" strokeWidth="1" strokeDasharray="4 4" />
              <circle cx="250" cy="250" r="190" strokeWidth="1" />
              <circle cx="250" cy="250" r="240" strokeWidth="1" strokeDasharray="8 6" />
              <line x1="250" y1="10" x2="250" y2="490" strokeWidth="0.75" strokeDasharray="3 3" />
              <line x1="10" y1="250" x2="490" y2="250" strokeWidth="0.75" strokeDasharray="3 3" />
            </svg>
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
