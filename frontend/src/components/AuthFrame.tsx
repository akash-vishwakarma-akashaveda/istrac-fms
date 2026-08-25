import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'

/**
 * Station mark — the same crosshair glyph used in the navbar and the rail,
 * built from hairlines so there is no asset to load.
 */
function StationMark() {
  return (
    <img
      src="/logo/isro_logo.svg"
      alt="ISRO Logo"
      className="h-8 w-auto object-contain shrink-0"
    />
  )
}

interface AuthFrameProps {
  /** Links or buttons for the top-right of the strip. */
  actions?: ReactNode
  /** Max width of the content column. */
  width?: 'sm' | 'md'
  children: ReactNode
}

/**
 * Shared chrome for every authentication screen: a thin identity strip, a
 * centred content column, and the station atmosphere drawn entirely in CSS —
 * a graticule and the curve of the limb. No imagery, no per-render randomness.
 */
export function AuthFrame({ actions, width = 'sm', children }: AuthFrameProps) {
  return (
    <div className="relative isolate flex min-h-screen flex-col bg-page antialiased">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="graticule absolute inset-0 [mask-image:radial-gradient(ellipse_at_70%_45%,black,transparent_72%)]" />

        {/* Limb of the Earth, cropped by the viewport. */}
        <div className="absolute -right-[45%] top-1/2 aspect-square w-[110%] -translate-y-1/2 rounded-full border border-accent/[0.16] sm:-right-[32%] sm:w-[70%]" />
        <div className="absolute -right-[43%] top-1/2 aspect-square w-[110%] -translate-y-1/2 rounded-full border border-border-subtle sm:-right-[30%] sm:w-[70%]" />
        <div className="absolute -right-[52%] top-1/2 aspect-square w-[128%] -translate-y-1/2 -rotate-12 rounded-full border border-dashed border-accent/[0.09] sm:-right-[38%] sm:w-[82%]" />
      </div>

      <header className="relative z-10 border-b border-border-subtle bg-page/85 backdrop-blur-xl">
        <div className="shell flex h-14 items-center gap-3">
          <Link
            to="/"
            className="group flex items-center gap-2.5 text-text-primary"
            aria-label="ISTRAC-FMS home"
          >
            <StationMark />

            <span className="text-[13px] tracking-[0.06em]">
              ISTRAC<span className="text-accent-light">-FMS</span>
            </span>
          </Link>

          {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className={`w-full ${width === 'md' ? 'max-w-md' : 'max-w-sm'}`}>{children}</div>
      </main>

      <footer className="relative z-10 border-t border-border-subtle">
        <div className="shell flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-4">
          <p className="num text-[10px] text-text-dim">BLR · 13.03°N 77.51°E</p>
          <p className="num text-[10px] text-text-dim">REF UTC</p>
        </div>
      </footer>
    </div>
  )
}

interface AuthCardProps {
  /** Small tone label in the status strip, e.g. "Restricted". */
  eyebrow: string
  /** Machine-side state shown at the right of the strip, e.g. "SIGNED OUT". */
  status?: string
  tone?: 'warning' | 'accent' | 'nominal'
  title: string
  description?: string
  children: ReactNode
}

const toneClass: Record<NonNullable<AuthCardProps['tone']>, string> = {
  warning: 'text-warning',
  accent: 'text-accent-light',
  nominal: 'text-nominal',
}

/**
 * The panel an auth form sits in. A hairline status strip states the current
 * condition, then the human-language heading, then the form.
 */
export function AuthCard({
  eyebrow,
  status,
  tone = 'warning',
  title,
  description,
  children,
}: AuthCardProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-border-default bg-surface shadow-card-lg">
      <div className="flex items-center gap-2 border-b border-border-subtle bg-card px-4 py-2.5">
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            tone === 'nominal' ? 'bg-nominal' : tone === 'accent' ? 'bg-accent' : 'bg-warning'
          }`}
        />

        <span className={`eyebrow ${toneClass[tone]}`}>{eyebrow}</span>

        {status && <span className="num ml-auto text-[10px] text-text-dim">{status}</span>}
      </div>

      <div className="p-5 sm:p-7">
        <h1 className="text-lg leading-snug text-text-primary">{title}</h1>

        {description && (
          <p className="mt-2.5 text-[13px] leading-6 text-text-muted">{description}</p>
        )}

        <div className="mt-6">{children}</div>
      </div>
    </section>
  )
}
