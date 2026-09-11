import type { TextareaHTMLAttributes } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

/** Labelled multi-line field, matching Input's frame and label treatment. */
export function Textarea({ label, error, hint, className = '', id, ...props }: TextareaProps) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined

  return (
    <div className="flex w-full flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="col-label">
          {label}
        </label>
      )}

      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`w-full resize-y rounded-md border bg-surface px-3 py-2.5 text-base sm:text-sm leading-6 text-text-primary outline-none transition-colors duration-150 placeholder:text-text-dim hover:border-border-bright focus:bg-card-hover disabled:cursor-not-allowed disabled:bg-card disabled:text-text-muted ${
          error
            ? 'border-critical focus:border-critical'
            : 'border-border-default focus:border-accent'
        } ${className}`}
        {...props}
      />

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
