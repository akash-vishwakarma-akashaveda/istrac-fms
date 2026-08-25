import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building, Satellite, ArrowRight } from 'lucide-react'
import { departmentsApi, type Department } from '../api/departments.api'
import { Navbar, Footer, Input } from '../components'

export function DepartmentsList() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)

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
        <section className="relative border-b border-border-subtle bg-page-soft py-16 lg:py-20 overflow-hidden">
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
              {filtered.map((dept) => (
                <Link
                  key={dept.id}
                  to={`/departments/${dept.id}`}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border-default bg-card p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-2xl"
                >
                  <div>
                    <div className="flex items-center justify-between border-b border-border-subtle pb-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface border border-border-subtle text-accent-light group-hover:border-accent/50 group-hover:bg-accent/10 transition-colors">
                        <Building size={20} />
                      </div>

                      {dept.code && (
                        <span className="num rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-xs font-bold text-accent-light">
                          {dept.code}
                        </span>
                      )}
                    </div>

                    <h3 className="mt-4 text-base font-bold text-text-primary group-hover:text-accent-light transition-colors">
                      {dept.name}
                    </h3>

                    <p className="mt-2 text-xs leading-relaxed text-text-muted line-clamp-2">
                      {dept.description || 'Provides telemetry processing, satellite operations, and mission telemetry data archiving.'}
                    </p>
                  </div>

                  <div className="mt-6 border-t border-border-subtle pt-4 flex items-center justify-between text-[11px] text-text-dim">
                    <span className="num text-text-secondary font-medium">
                      {dept.satellite?.name || 'Bengaluru Ground Station'}
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-accent-light group-hover:underline">
                      View Profile <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              ))}

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

      <Footer />
    </div>
  )
}
