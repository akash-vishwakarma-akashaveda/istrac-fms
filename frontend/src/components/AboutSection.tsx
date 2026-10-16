import { useState } from 'react'
import { ArrowUpRight, Check, MapPin, Maximize2 } from 'lucide-react'
import { useCms, DEFAULT_CMS_BLOCKS } from '../context/cmsContext'
import { ImageWithFallback } from './ImageWithFallback'
import { ImageLightboxModal } from './ImageLightboxModal'
import { safeHref } from '../lib/sanitize'

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
      data-theme="dark"
      className="relative overflow-hidden py-24 text-white sm:py-28"
      style={{ background: 'linear-gradient(135deg, #002641 0%, #0a3354 100%)' }}
      aria-labelledby="about-title"
    >
      <div aria-hidden="true" className="section-grid" style={{ '--color-grid-line': 'rgba(255, 255, 255, 0.07)' } as React.CSSProperties} />
      <div className="shell relative grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <figure className="mx-auto w-full max-w-[560px]">
          <div
            className="group relative aspect-[4/3] w-full cursor-zoom-in overflow-hidden rounded-3xl bg-white/5 shadow-[0_24px_48px_-20px_rgba(0,0,0,0.6)]"
            onClick={() => setIsLightboxOpen(true)}
            role="button"
            tabIndex={0}
            aria-label="Enlarge photo"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setIsLightboxOpen(true)
              }
            }}
          >
            <ImageWithFallback
              src={aboutImageUrl}
              alt={aboutImageAlt}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              aspectRatio="4/3"
              fallbackIcon="mox"
              iconOnly
            />
            <span className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100">
              <Maximize2 size={15} />
            </span>
          </div>
          <figcaption className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/75">
            <MapPin size={14} className="text-[#ffb380]" />
            <span className="font-semibold text-white/90">{primaryNodeLocation}</span>
            <span>· {primaryNodeLabel}</span>
            <span className="num">· {facilityTag} · {frequencyTag}</span>
          </figcaption>
        </figure>

        <div className="min-w-0 space-y-6">
          <p className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.08em] text-[#ffb380]">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-isro-saffron" />
            {aboutEyebrow}
          </p>
          <h2 id="about-title" className="display text-[28px] font-bold leading-tight tracking-tight text-white sm:text-4xl sm:leading-[44px]">
            {aboutTitle}
          </h2>
          <p className="text-base leading-[28px] text-[#d7e3ee] sm:text-[17px]">{aboutText}</p>

          <ul className="grid gap-3.5 pt-2 sm:grid-cols-2">
            {assurancesList.map((assurance, index) => {
              const isObj = typeof assurance === 'object' && assurance !== null
              const title = isObj ? (assurance as { title?: string }).title : undefined
              const text = isObj ? (assurance as { text?: string }).text : (assurance as string)

              return (
                <li key={index} className="flex gap-3.5 rounded-2xl border border-white/12 bg-white/[0.06] p-4">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-isro-saffron/20 text-[#ffb380]">
                    <Check size={17} strokeWidth={2.5} />
                  </span>
                  <span className="min-w-0 space-y-1 text-sm leading-relaxed">
                    {title && <span className="block text-[15px] font-bold text-white">{title}</span>}
                    <span className="block text-[#c3d2df]">{text}</span>
                  </span>
                </li>
              )
            })}
          </ul>

          <a
            className="inline-flex min-h-12 items-center gap-2 rounded-[10px] border border-white/60 px-6 text-[15px] font-bold text-white transition-colors hover:border-white hover:bg-white/10"
            href={safeHref(ctaHref, '#')}
          >
            <span>{ctaText}</span>
            <ArrowUpRight size={16} />
          </a>
        </div>
      </div>

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
