import { useCms, DEFAULT_CMS_BLOCKS } from '../context/cmsContext'
import { ImageWithFallback } from './ImageWithFallback'

interface GalleryItem {
  url: string
  label: string
  caption: string
}

export function Gallery() {
  const { cmsBlocks } = useCms()
  const items =
    (cmsBlocks['gallery']?.items as GalleryItem[]) ??
    (DEFAULT_CMS_BLOCKS['gallery'].items as GalleryItem[])

  return (
    <section
      id="gallery"
      className="relative border-b border-border-subtle bg-page py-20 sm:py-24"
      aria-labelledby="gallery-title"
    >
      <div className="shell">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="eyebrow flex items-center gap-2.5 text-accent-light">
              <span aria-hidden="true" className="h-2.5 w-px bg-accent-light" />
              Platform Overview
            </p>

            <h2
              id="gallery-title"
              className="display mt-4 max-w-xl text-3xl font-bold text-text-primary sm:text-4xl"
            >
              High-Precision Ground Station Architecture.
            </h2>
          </div>

          <p className="max-w-md text-sm leading-relaxed text-text-muted">
            Mission Operations Complex (MOX), Deep Space Network dishes, and real-time telemetry processing infrastructure.
          </p>
        </div>

        {/* Gallery Cards with Image Fallback */}
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => (
            <figure
              key={`${item.url}-${index}`}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-border-subtle bg-card shadow-card transition-all duration-300 hover:-translate-y-1.5 hover:border-accent/40 hover:shadow-2xl hover:shadow-accent/10"
            >
              <div className="relative aspect-video overflow-hidden border-b border-border-subtle bg-page-soft">
                <ImageWithFallback
                  src={item.url}
                  alt={item.label || `Gallery facility ${index + 1}`}
                  fallbackLabel={item.label || `Ground Station Item ${index + 1}`}
                  aspectRatio="video"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />

                {/* Subtle gradient overlay */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent opacity-40" />
              </div>

              <figcaption className="flex flex-1 flex-col justify-between p-5">
                <div>
                  <strong className="block text-sm font-semibold text-text-primary">
                    {item.label || `Facility Specification 0${index + 1}`}
                  </strong>

                  {item.caption && (
                    <p className="mt-1.5 text-xs leading-relaxed text-text-muted">
                      {item.caption}
                    </p>
                  )}
                </div>

                <div className="num mt-4 flex items-center justify-between border-t border-border-subtle/60 pt-3 text-[10px] text-text-dim">
                  <span>FACILITY SPEC 0{index + 1}</span>
                  <span className="text-nominal">● OPERATIONAL</span>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
