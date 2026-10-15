import type { ReactNode } from 'react'

interface BadgeProps {
  variant?: 'nominal' | 'warning' | 'critical' | 'special' | 'neutral'
  children: ReactNode
}

/**
 * Annunciator flag. A solid leading bar in the status colour does the work a
 * coloured dot usually does — it survives being scanned down a dense column,
 * and it reads as a state rather than as a tag.
 */
const variantStyles = {
  nominal: 'border-nominal/35 border-l-nominal bg-nominal/15 text-nominal shadow-xs',
  warning: 'border-warning/35 border-l-warning bg-warning/15 text-warning shadow-xs',
  critical: 'border-critical/35 border-l-critical bg-critical/15 text-critical shadow-xs',
  special: 'border-special/35 border-l-special bg-special/15 text-special shadow-xs',
  neutral: 'border-border-default border-l-text-muted bg-surface/80 text-text-secondary shadow-xs',
}

export function Badge({ variant = 'neutral', children }: BadgeProps) {
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-md border border-l-2 px-2 py-0.5 text-[10px] font-bold font-mono tracking-[0.06em] uppercase ${variantStyles[variant]}`}
    >
      <span className="truncate">{children}</span>
    </span>
  )
}
