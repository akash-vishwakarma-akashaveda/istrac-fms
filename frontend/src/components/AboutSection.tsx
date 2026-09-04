import { useState } from 'react'
import { ArrowUpRight, Check, Compass, Radio, Maximize2 } from 'lucide-react'
import { useCms, DEFAULT_CMS_BLOCKS } from '../context/cmsContext'
import { ImageWithFallback } from './ImageWithFallback'
import { ImageLightboxModal } from './ImageLightboxModal'

export function AboutSection() {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const { cmsBlocks } = useCms()
  const navHeader = cmsBlocks['nav_header'] as Record<string, any> | undefined
  const brandTitle = navHeader?.brandTitle || 'ISTRAC'
  const brandHighlight = navHeader?.brandHighlight !== undefined ? navHeader.brandHighlight : '-SIMS'
  const brandSubtitle = navHeader?.brandSubtitle || 'ISRO Ground Network'

  const info = cmsBlocks['info'] as
    | {
        aboutEyebrow?: string
        aboutTitle?: string
        aboutText?: string
        aboutImageUrl?: string
        aboutImageAlt?: string
        facilityTag?: string
        frequencyTag?: string
        primaryNodeLabel?: string
        primaryNodeLocation?: string
        ctaText?: string
        ctaHref?: string
        assurances?: Array<string | { title?: string; text: string }>
      }
    | undefined

  const aboutEyebrow =
    info?.aboutEyebrow ||
    `About ${brandTitle}${brandHighlight} Telemetry Infrastructure`

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

  const facilityTag = info?.facilityTag || `${brandTitle} HEADQUARTERS`
  const frequencyTag = info?.frequencyTag || 'AOS 2.2 GHz'
  const primaryNodeLabel = info?.primaryNodeLabel || 'PRIMARY CONTROL NODE'
  const primaryNodeLocation =
    info?.primaryNodeLocation ||
    (brandSubtitle ? `${brandSubtitle} (BLR)` : 'Bengaluru MOX Complex (BLR)')

  const ctaText = info?.ctaText || 'Contact Mission Support'
  const ctaHref = info?.ctaHref || '#contact'

  const assurancesList =
    Array.isArray(info?.assurances) && info!.assurances.length > 0
      ? info!.assurances
      : (DEFAULT_CMS_BLOCKS['info'].assurances as string[])

  return (
    <section
      id="about"
      className="relative border-b border-border-subtle bg-page-soft py-18 sm:py-24"
      aria-labelledby="about-title"
    >
      <div className="shell grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
        {/* Left Column: CMS-Managed Ground Complex Image (5 Cols) */}
        <div
          className="relative aspect-[4/3] w-full max-w-[460px] mx-auto overflow-hidden rounded-2xl border border-border-default bg-[#070c17] shadow-2xl transition-all duration-300 hover:border-accent/40 lg:col-span-5 group cursor-pointer"
          onClick={() => setIsLightboxOpen(true)}
          role="button"
          tabIndex={0}
          aria-label="Click to enlarge ground complex image"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setIsLightboxOpen(true)
            }
          }}
        >
          {/* Top Tag Header */}
          <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between border-b border-border-subtle/80 bg-[#0b1220]/80 px-4 py-2.5 backdrop-blur-md text-[11px]">
            <span className="eyebrow flex items-center gap-1.5 text-accent-light">
              <Compass size={13} />
              {facilityTag}
            </span>
            <div className="flex items-center gap-2">
              <span className="num text-nominal font-bold flex items-center gap-1">
                <Radio size={12} />
                {frequencyTag}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsLightboxOpen(true)
                }}
                className="p-1 rounded text-text-dim hover:text-white hover:bg-white/10 transition-colors"
                title="Enlarge facility image"
                aria-label="Enlarge image in fullscreen preview"
              >
                <Maximize2 size={12} />
              </button>
            </div>
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

          {/* Hover Click to Enlarge Icon */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/25 pointer-events-none z-10">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/80 border border-white/25 text-white shadow-2xl backdrop-blur-md">
              <Maximize2 size={18} className="text-accent-light" />
            </div>
          </div>

          {/* Bottom Station Node Strip */}
          <div className="absolute bottom-0 inset-x-0 z-20 flex items-center justify-between border-t border-border-subtle/80 bg-[#0b1220]/85 px-4 py-2.5 backdrop-blur-md">
            <div>
              <p className="eyebrow text-[9px] text-text-dim">{primaryNodeLabel}</p>
              <p className="num text-xs font-bold text-text-primary">{primaryNodeLocation}</p>
            </div>
            <span className="num text-[10px] text-nominal font-semibold">● SYNCHRONIZED</span>
          </div>
        </div>

        {/* Right Column: Text Content & Assurances (7 Cols) */}
        <div className="lg:col-span-7">
          <p className="eyebrow flex items-center gap-2.5 text-accent-light">
            <span aria-hidden="true" className="h-2.5 w-px bg-accent-light" />
            {aboutEyebrow}
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
            {assurancesList.map((assurance, index) => {
              const isObj = typeof assurance === 'object' && assurance !== null
              const title = isObj ? (assurance as { title?: string }).title : undefined
              const text = isObj ? (assurance as { text?: string }).text : (assurance as string)

              return (
                <div
                  key={index}
                  className="flex items-start gap-2.5 rounded-lg border border-border-subtle bg-card/60 p-3 text-xs text-text-secondary hover:border-accent/40 transition-colors"
                >
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-nominal/15 text-nominal mt-0.5">
                    <Check size={12} strokeWidth={2.5} />
                  </div>
                  <div className="min-w-0">
                    {title && <div className="font-bold text-white text-xs mb-0.5">{title}</div>}
                    <span className="text-text-secondary leading-relaxed">{text}</span>
                  </div>
                </div>
              )
            })}
          </div>

          <a
            className="group mt-8 inline-flex items-center gap-2 text-sm font-semibold text-accent-light transition-colors hover:text-text-primary"
            href={ctaHref}
          >
            <span>{ctaText}</span>
            <ArrowUpRight
              size={15}
              className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            />
          </a>
        </div>
      </div>

      {/* Enlarged Image Preview Lightbox */}
      <ImageLightboxModal
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        images={[
          {
            url: aboutImageUrl,
            title: aboutImageAlt || 'ISTRAC Headquarters Complex',
            caption: `${aboutTitle} — ${aboutImageAlt}`,
            alt: aboutImageAlt,
            tag: 'ISTRAC HQ COMPLEX',
            station: 'Bengaluru MOX-2 Complex (BLR) · Primary Control Node',
          },
        ]}
      />
    </section>
  )
}
