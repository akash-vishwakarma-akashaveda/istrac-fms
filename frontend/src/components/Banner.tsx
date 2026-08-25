import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCms, DEFAULT_CMS_BLOCKS } from '../context/cmsContext'
import { Button } from '.'

interface BannerContent {
  title?: string
  subtitle?: string
  ctaText?: string
  ctaHref?: string
  visible?: boolean
}

export function Banner() {
  const { cmsBlocks } = useCms()
  const banner =
    (cmsBlocks['banner'] as BannerContent | undefined) ??
    (DEFAULT_CMS_BLOCKS['banner'] as BannerContent)

  if (banner?.visible === false) return null

  return (
    <section
      className="relative isolate overflow-hidden border-b border-border-subtle bg-surface py-20 sm:py-24"
      aria-labelledby="banner-title"
    >
      {/* 3D Wireframe Graticule Background */}
      <div
        aria-hidden="true"
        className="graticule pointer-events-none absolute inset-0 -z-10 opacity-40 [mask-image:radial-gradient(ellipse_at_70%_50%,black,transparent_75%)]"
      />
      <div className="absolute top-1/2 -right-32 h-80 w-80 rounded-full bg-accent/15 blur-3xl" />

      <div className="shell">
        <div className="relative overflow-hidden rounded-3xl border border-border-subtle bg-gradient-to-r from-card via-card to-surface p-8 shadow-2xl sm:p-12 lg:p-16">
          <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <span className="eyebrow text-accent-light">Ready for deployment</span>

              <h2
                id="banner-title"
                className="display mt-4 text-3xl font-bold tracking-tight text-text-primary sm:text-4xl"
              >
                {banner.title ?? 'Ready for Next-Gen Mission File Ingestion'}
              </h2>

              <p className="mt-4 text-base leading-relaxed text-text-secondary sm:text-lg">
                {banner.subtitle ??
                  'Access high-speed telemetry repositories and mission data archives with military-grade RBAC controls.'}
              </p>
            </div>

            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <Link to={banner.ctaHref ?? '/register'}>
                <Button variant="primary" size="lg" className="w-full shadow-lg shadow-accent/25 sm:w-auto">
                  {banner.ctaText ?? 'Deploy Workstation'}
                  <ArrowRight size={16} strokeWidth={2} />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
