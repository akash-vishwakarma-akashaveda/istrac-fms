import type { SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
}

/**
 * Labelled select, matching Input exactly so mixed forms line up. The native
 * chevron is hidden and replaced with one that follows the text colour.
 */
export function Select({ label, error, hint, className = '', id, children, ...props }: SelectProps) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined

  return (
    <div className="flex w-full flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="col-label">
          {label}
        </label>
      )}

      <div className="relative">
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`w-full appearance-none rounded-md border bg-surface px-3 py-2.5 pr-9 text-base sm:text-sm text-text-primary outline-none transition-colors duration-150 hover:border-border-bright focus:bg-card-hover disabled:cursor-not-allowed disabled:bg-card disabled:text-text-muted ${
            error
              ? 'border-critical focus:border-critical'
              : 'border-border-default focus:border-accent'
          } ${className}`}
          {...props}
        >
          {children}
        </select>

        <ChevronDown
          size={14}
          strokeWidth={2}
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-text-muted"
        />
      </div>

      {error ? (
        <span id={`${id}-error`} className="text-[11px] leading-4 text-critical">
          {error}
        </span>
      ) : (
        hint && (
          <span id={`${id}-hint`} className="text-[11px] leading-4 text-text-dim">
            {hint}
          </span>
        )
      )}
    </div>
  )
}
