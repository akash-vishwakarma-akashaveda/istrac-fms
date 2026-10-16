import type { ReactNode } from 'react'

interface PageHeaderProps {
  /** Small wide-tracked marker above the title — names the area of the system. */
  eyebrow?: string
  title: string
  /** One line, plain language, describing what this page is for. */
  description?: string
  /** Machine-side readout for the page: counts, ranges, last-updated. */
  meta?: ReactNode
  actions?: ReactNode
  className?: string
}

/**
 * Every page opens the same way: area marker, title in light Lato, one line
 * of explanation, controls on the right. Consistent enough that people stop
 * having to look for the heading.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  meta,
  actions,
  className = '',
}: PageHeaderProps) {
  return (
    <header
      className={`flex flex-col gap-4 border-b border-border-subtle pb-5 sm:flex-row sm:items-end sm:justify-between ${className}`}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="eyebrow flex items-center gap-2 text-accent-light">
            <span aria-hidden="true" className="h-2 w-px bg-accent-light" />
            {eyebrow}
          </p>
        )}

        <h1 className="display mt-2.5 text-2xl text-text-primary sm:text-[28px]">
          {title}
        </h1>

        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-muted">
            {description}
          </p>
        )}

        {meta && (
          <div className="num mt-2.5 text-[11px] text-text-dim">{meta}</div>
        )}
      </div>

      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </header>
  )
}
