import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Satellite, ArrowRight, HardDrive, Maximize2 } from 'lucide-react'
import { departmentsApi, type Department } from '../api/departments.api'
import { Navbar, Footer, Input, ImageLightboxModal } from '../components'
import { ImageWithFallback } from '../components/ImageWithFallback'

function getDeptBanner(dept: Department): string {
  if (dept.pageBannerUrl) {
    try {
      const parsed = JSON.parse(dept.pageBannerUrl)
      if (Array.isArray(parsed) && parsed[0]?.url) return parsed[0].url
    } catch {
      if (dept.pageBannerUrl.startsWith('http')) return dept.pageBannerUrl
    }
  }
  const fallbackImages: Record<string, string> = {
    TTC: 'https://images.unsplash.com/photo-1517976487515-56839a85703f?auto=format&fit=crop&w=800&q=80',
    MOX: 'https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?auto=format&fit=crop&w=800&q=80',
    FDD: 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?auto=format&fit=crop&w=800&q=80',
    NETRA: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=800&q=80',
    GSO: 'https://images.unsplash.com/photo-1517976487515-56839a85703f?auto=format&fit=crop&w=800&q=80',
  }
  return fallbackImages[dept.code?.toUpperCase() || 'TTC'] || fallbackImages['TTC']
}

export function DepartmentsList() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [previewDept, setPreviewDept] = useState<Department | null>(null)

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
          <div className="graticule absolute inset-0 opacity-30 pointer-events-none" />
          <div className="shell relative z-10">
            <p className="eyebrow flex items-center gap-2.5 text-accent-light">
              <span aria-hidden="true" className="h-2.5 w-px bg-accent-light" />
              ISTRAC Ground Network
            </p>

            <h1 className="display mt-4 text-3xl font-bold tracking-tight text-text-primary sm:text-5xl">
              Operational Divisions & Departments.
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-relaxed text-text-secondary">
              Browse ISTRAC departmental mission centers, tracking divisions, and telemetry processing units across ground stations.
            </p>

            {/* Search Filter */}
            <div className="mt-8 max-w-md">
              <Input
                id="dept-search"
                placeholder="Search division name, code (e.g. FDD, TTC)..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* Directory Grid */}
        <div className="shell mt-12">
          {isLoading ? (
            <div className="py-20 text-center text-text-dim">
              <Satellite size={32} className="mx-auto text-accent-light animate-spin-slow mb-4" />
              <p className="num text-sm text-text-secondary">Loading operational divisions...</p>
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
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#060b16] via-transparent to-transparent" />

                      {/* Division Shortcode Tag */}
                      {dept.code && (
                        <span className="absolute top-3 right-3 num font-mono rounded-full border border-accent/40 bg-[#060b16]/80 backdrop-blur-md px-2.5 py-0.5 text-xs font-bold text-accent-light shadow-md">
                          /{dept.code}
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
