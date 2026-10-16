import type { ReactNode } from 'react'

interface SectionHeaderProps {
  id: string
  eyebrow?: string
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  /** Light text for dark bands (About, hero-like sections). */
  onDark?: boolean
}

/** Shared heading for landing-page sections: eyebrow, title, subtitle and optional actions on the right. */
export function SectionHeader({ id, eyebrow, title, subtitle, actions, onDark = false }: SectionHeaderProps) {
  return (
    <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div className="max-w-[660px] space-y-3">
        {eyebrow && (
          <p
            className={`flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.08em] ${
              onDark ? 'text-[#ffb380]' : 'text-saffron-text'
            }`}
          >
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-isro-saffron" />
            {eyebrow}
          </p>
        )}
        <h2 id={id} className="display text-[28px] font-bold leading-tight tracking-tight text-text-primary sm:text-4xl sm:leading-[44px]">
          {title}
        </h2>
        {subtitle && <p className="text-base leading-relaxed text-text-secondary sm:text-[17px]">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
