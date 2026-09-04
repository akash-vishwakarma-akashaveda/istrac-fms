import { forwardRef, useState, type InputHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  /** Guidance shown under the field while it's still valid. */
  hint?: string
}

/**
 * Labelled field with support for password reveal toggle.
 * The label uses the standard uppercase header treatment for consistency.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, className = '', id, type = 'text', ...props },
  ref,
) {
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'
  const actualType = isPassword ? (showPassword ? 'text' : 'password') : type

  const describedBy = error
    ? `${id}-error`
    : hint
      ? `${id}-hint`
      : undefined

  return (
    <div className="flex w-full flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="col-label">
          {label}
        </label>
      )}

      <div className="relative flex items-center">
        <input
          ref={ref}
          id={id}
          type={actualType}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`w-full rounded-lg border bg-[#09101f] px-3.5 py-2.5 text-sm text-text-primary outline-none transition-colors duration-150 placeholder:text-text-dim hover:border-border-bright focus:border-accent focus:bg-[#0c162b] disabled:cursor-not-allowed disabled:bg-card disabled:text-text-muted ${
            isPassword ? 'pr-10' : ''
          } ${
            error
              ? 'border-critical focus:border-critical'
              : 'border-border-default focus:border-accent'
          } ${className}`}
          {...props}
        />

        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-3 flex h-6 w-6 items-center justify-center rounded text-text-dim transition-colors hover:text-text-primary focus:outline-none"
          >
            {showPassword ? (
              <EyeOff size={16} strokeWidth={1.8} />
            ) : (
              <Eye size={16} strokeWidth={1.8} />
            )}
          </button>
        )}
      </div>

      {error ? (
        <span id={`${id}-error`} className="text-[11px] leading-4 text-critical font-medium">
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
})