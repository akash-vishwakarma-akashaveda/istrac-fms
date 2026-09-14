import { CheckCircle2, Shield, Search, Clock, Database, Lock, Cpu, Radio, Satellite, Globe, type LucideIcon } from 'lucide-react'
import { useCms, DEFAULT_CMS_BLOCKS } from '../context/cmsContext'

interface FeatureItem {
  icon: string
  title: string
  description: string
  visible: boolean
}

const ICONS: Record<string, LucideIcon> = {
  Radio,
  Satellite,
  Cpu,
  Shield,
  Globe,
  Clock,
  Search,
  Database,
  Lock,
}

export function FeatureStrip() {
  const { cmsBlocks } = useCms()
  const rawItems = (cmsBlocks['feature_strip']?.items as FeatureItem[]) ?? (DEFAULT_CMS_BLOCKS['feature_strip'].items as FeatureItem[])
  const visibleItems = rawItems.filter((item) => item.visible !== false)

  return (
    <section
      id="features"
      className="relative border-b border-border-subtle bg-page-soft py-20 sm:py-24"
      aria-labelledby="features-title"
    >
      <div className="shell">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="eyebrow flex items-center gap-2.5 text-accent-light">
              <span aria-hidden="true" className="h-2.5 w-px bg-accent-light" />
              Core Capabilities & Operations
            </p>

            <h2
              id="features-title"
              className="display mt-4 max-w-xl text-3xl font-bold text-text-primary sm:text-4xl"
            >
              Nerve Centre for Indian Space Missions.
            </h2>
          </div>

          <p className="max-w-md text-sm leading-relaxed text-text-muted">
            End-to-end ground telemetry reception, deep space communication, orbit determination, and space situational awareness.
          </p>
        </div>

        {/* 3D Modern Feature Grid */}
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {visibleItems.map((item, index) => {
            const Icon = ICONS[item.icon] ?? CheckCircle2

            return (
              <article
                key={`${item.title}-${index}`}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border-subtle bg-card p-8 shadow-card transition-all duration-300 hover:-translate-y-1.5 hover:border-accent/40 hover:shadow-2xl hover:shadow-accent/10"
              >
                {/* Subtle Radial Flare on Hover */}
                <div className="pointer-events-none absolute -top-24 -right-24 h-48 w-48 rounded-full bg-accent/10 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />

                <div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border-subtle bg-surface text-accent-light shadow-inner transition-colors duration-300 group-hover:border-accent/50 group-hover:bg-accent/10">
                    <Icon size={24} strokeWidth={1.8} />
                  </div>

                  <h3 className="mt-6 text-lg font-semibold text-text-primary">
                    {item.title}
                  </h3>

                  <p className="mt-3 text-sm leading-relaxed text-text-muted">
                    {item.description}
                  </p>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-border-subtle/50 pt-4 text-[11px] text-text-dim">
                  <span className="num">OPERATION 0{index + 1}</span>
                  <span className="num text-nominal font-medium">● ACTIVE</span>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
