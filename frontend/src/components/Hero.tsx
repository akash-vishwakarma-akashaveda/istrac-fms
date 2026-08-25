import { LogIn, UserPlus, Search, Compass } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCms, DEFAULT_CMS_BLOCKS } from '../context/cmsContext'
import { type HeroContent } from '../types/cms'
import { Button } from '.'
import { SearchModal } from './SearchModal'
import { ImageWithFallback } from './ImageWithFallback'

interface ExtendedHeroContent extends HeroContent {
  badgeText?: string
  imageUrl?: string
  imageAlt?: string
}

export function Hero() {
  const { cmsBlocks, isLoading } = useCms()
  const hero =
    (cmsBlocks['hero'] as unknown as ExtendedHeroContent | undefined) ??
    (DEFAULT_CMS_BLOCKS['hero'] as unknown as ExtendedHeroContent)

  const [searchOpen, setSearchOpen] = useState(false)

  if (isLoading) {
    return (
      <section aria-label="Loading" className="border-b border-border-subtle bg-page py-20">
        <div className="shell grid gap-8 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-7 space-y-4">
            <div className="h-5 w-48 rounded-md bg-card-hover" />
            <div className="h-16 w-full max-w-xl rounded-md bg-card-hover" />
            <div className="h-20 w-3/4 max-w-lg rounded-md bg-card-hover" />
            <div className="h-10 w-60 rounded-md bg-card" />
          </div>
          <div className="lg:col-span-5">
            <div className="aspect-[4/3] rounded-2xl bg-card-hover animate-pulse" />
          </div>
        </div>
      </section>
    )
  }

  const heroImageUrl =
    hero?.imageUrl ||
    'https://images.unsplash.com/photo-1517976487515-56839a85703f?auto=format&fit=crop&w=1200&q=80'
  const heroImageAlt =
    hero?.imageAlt || 'Indian Deep Space Network (IDSN) 32-Meter Antenna Dish'

  return (
    <>
      <section
        id="hero"
        className="relative isolate overflow-hidden border-b border-border-subtle bg-page py-14 sm:py-20"
        aria-labelledby="hero-title"
      >
        {/* Graticule Background & Ambient Glow */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="graticule absolute inset-0 opacity-30 [mask-image:radial-gradient(ellipse_at_50%_30%,black,transparent_80%)]" />
          <div className="absolute top-1/3 left-1/4 h-[450px] w-[600px] rounded-full bg-accent/10 blur-3xl" />
          <div className="absolute top-1/4 right-1/4 h-72 w-72 rounded-full bg-nominal/8 blur-3xl" />
        </div>

        <div className="shell grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
          {/* Left Column: Mission Control Content (7 cols) */}
          <div className="lg:col-span-7">
            {/* Status Pill */}
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3.5 py-1 text-xs font-semibold text-accent-light shadow-sm shadow-accent/20">
              <span className="h-2 w-2 animate-pulse rounded-full bg-nominal" />
              <span>{hero?.badgeText ?? 'Telemetry & Tracking Network Active · 24/7 MOX Ops'}</span>
            </div>

            {/* Main Headline */}
            <h1
              id="hero-title"
              className="display mt-5 text-3xl font-bold tracking-tight text-text-primary sm:text-5xl lg:text-[3.25rem] leading-[1.15]"
            >
              {hero?.title ?? 'ISRO Telemetry, Tracking & Command Network'}
            </h1>

            {/* Subtitle */}
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-text-secondary sm:text-base">
              {hero?.subtitle ??
                'The nerve centre for spacecraft operations, deep space tracking, launch vehicle telemetry, and orbit determination across all Indian space missions.'}
            </p>

            {/* Direct Action Buttons */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/login">
                <Button variant="primary" size="md" className="shadow-lg shadow-accent/25 px-5">
                  <LogIn size={15} strokeWidth={2.2} />
                  <span>Log In</span>
                </Button>
              </Link>

              <Link to="/register">
                <Button variant="outline" size="md" className="px-5">
                  <UserPlus size={15} strokeWidth={1.8} />
                  <span>Request Access</span>
                </Button>
              </Link>

              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-surface/80 px-4 py-2.5 text-xs font-semibold text-text-muted hover:border-border-bright hover:text-text-primary transition-colors shadow-sm"
              >
                <Search size={14} className="text-accent-light" />
                <span>Search Files</span>
                <kbd className="num ml-1 rounded bg-card px-1.5 py-0.5 text-[10px] text-text-dim border border-border-subtle">
                  Ctrl K
                </kbd>
              </button>
            </div>
          </div>

          {/* Right Column: CMS-Managed Hero Visual Frame (5 cols) */}
          <div className="lg:col-span-5">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-border-default bg-[#070c17] shadow-2xl transition-all duration-300 hover:border-accent/40 group">
              {/* Telemetry HUD Top Header */}
              <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between border-b border-border-subtle/80 bg-[#0b1220]/80 px-4 py-2.5 backdrop-blur-md text-[11px]">
                <span className="eyebrow flex items-center gap-1.5 text-text-secondary">
                  <Compass size={13} className="text-accent-light" />
                  IDSN BYALALU DEEP SPACE NODE
                </span>
                <span className="num font-bold text-nominal flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-nominal animate-pulse" />
                  2.2 GHz S-BAND
                </span>
              </div>

              {/* Main Visual Image with Loading Skeleton & Error Fallback */}
              <ImageWithFallback
                src={heroImageUrl}
                alt={heroImageAlt}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                aspectRatio="4/3"
                fallbackIcon="satellite"
                fallbackTitle={heroImageAlt}
                fallbackSubtitle="Primary Ground Station Antenna Node"
              />

              {/* Telemetry Coordinates Overlay at Bottom */}
              <div className="absolute bottom-0 inset-x-0 z-20 flex items-center justify-between border-t border-border-subtle/80 bg-[#0b1220]/85 px-4 py-2 backdrop-blur-md text-[10px] text-text-dim">
                <span className="num">STATION: BLR-MOX (13.03°N 77.51°E)</span>
                <span className="num text-accent-light font-semibold">CARRIER: NOMINAL LOCK</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
