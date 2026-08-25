import { ArrowUpRight, Check, Compass, Radio } from 'lucide-react'
import { useCms, DEFAULT_CMS_BLOCKS } from '../context/cmsContext'
import { ImageWithFallback } from './ImageWithFallback'

const ASSURANCES = [
  'Permission-aware departmental access controls (RBAC)',
  'Tamper-evident append-only audit activity logging',
  'Multi-ground station satellite scoping (BLR / SHAR / PBL / MAU)',
  'Real-time WebSocket telemetry pass notifications',
]

export function AboutSection() {
  const { cmsBlocks } = useCms()
  const info = cmsBlocks['info'] as
    | {
        aboutTitle?: string
        aboutText?: string
        aboutImageUrl?: string
        aboutImageAlt?: string
      }
    | undefined

  const aboutText =
    (cmsBlocks['org_overview']?.text as string) ||
    info?.aboutText ||
    (DEFAULT_CMS_BLOCKS['info'].aboutText as string)

  const aboutTitle =
    info?.aboutTitle ||
    'Information Infrastructure for Deep Space & Earth Observation Missions.'

  const aboutImageUrl =
    info?.aboutImageUrl ||
    (DEFAULT_CMS_BLOCKS['info'].aboutImageUrl as string) ||
    'https://images.unsplash.com/photo-1581822261290-991b38693d1b?auto=format&fit=crop&w=1000&q=80'

  const aboutImageAlt =
    info?.aboutImageAlt ||
    (DEFAULT_CMS_BLOCKS['info'].aboutImageAlt as string) ||
    'Mission Operations Complex (MOX-2 Bengaluru)'

  return (
    <section
      id="about"
      className="relative border-b border-border-subtle bg-page-soft py-18 sm:py-24"
      aria-labelledby="about-title"
    >
      <div className="shell grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
        {/* Left Column: CMS-Managed Ground Complex Image (5 Cols) */}
        <div className="relative aspect-[4/3] w-full max-w-[460px] mx-auto overflow-hidden rounded-2xl border border-border-default bg-[#070c17] shadow-2xl transition-all duration-300 hover:border-accent/40 lg:col-span-5 group">
          {/* Top Tag Header */}
          <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between border-b border-border-subtle/80 bg-[#0b1220]/80 px-4 py-2.5 backdrop-blur-md text-[11px]">
            <span className="eyebrow flex items-center gap-1.5 text-accent-light">
              <Compass size={13} />
              ISTRAC HEADQUARTERS
            </span>
            <span className="num text-nominal font-bold flex items-center gap-1">
              <Radio size={12} />
              AOS 2.2 GHz
            </span>
          </div>

          {/* Image Component with Fallback */}
          <ImageWithFallback
            src={aboutImageUrl}
            alt={aboutImageAlt}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            aspectRatio="4/3"
            fallbackIcon="mox"
            fallbackTitle={aboutImageAlt}
            fallbackSubtitle="Mission Operations Complex (MOX-2)"
          />

          {/* Bottom Coordinates Strip */}
          <div className="absolute bottom-0 inset-x-0 z-20 flex items-center justify-between border-t border-border-subtle/80 bg-[#0b1220]/85 px-4 py-2.5 backdrop-blur-md">
            <div>
              <p className="eyebrow text-[9px] text-text-dim">PRIMARY CONTROL NODE</p>
              <p className="num text-xs font-bold text-text-primary">13.034°N · 77.512°E (BLR)</p>
            </div>
            <span className="num text-[10px] text-nominal font-semibold">● SYNCHRONIZED</span>
          </div>
        </div>

        {/* Right Column: Text Content & Assurances (7 Cols) */}
        <div className="lg:col-span-7">
          <p className="eyebrow flex items-center gap-2.5 text-accent-light">
            <span aria-hidden="true" className="h-2.5 w-px bg-accent-light" />
            About ISTRAC Telemetry Infrastructure
          </p>

          <h2
            id="about-title"
            className="display mt-4 text-3xl font-bold tracking-tight text-text-primary sm:text-4xl"
          >
            {aboutTitle}
          </h2>

          <p className="mt-5 text-sm leading-relaxed text-text-secondary sm:text-base">
            {aboutText}
          </p>

          <div className="mt-8 grid gap-3 border-t border-border-subtle pt-6 sm:grid-cols-2">
            {ASSURANCES.map((assurance) => (
              <div
                key={assurance}
                className="flex items-start gap-2.5 rounded-lg border border-border-subtle bg-card/60 p-3 text-xs text-text-secondary"
              >
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-nominal/15 text-nominal">
                  <Check size={12} strokeWidth={2.5} />
                </div>
                <span>{assurance}</span>
              </div>
            ))}
          </div>

          <a
            className="group mt-8 inline-flex items-center gap-2 text-sm font-semibold text-accent-light transition-colors hover:text-text-primary"
            href="#contact"
          >
            <span>Contact Mission Support</span>
            <ArrowUpRight
              size={15}
              className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            />
          </a>
        </div>
      </div>
    </section>
  )
}
