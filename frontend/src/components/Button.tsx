import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
}

/**
 * Console pushbutton. Flat planes with a hairline edge — the press is
 * communicated by the surface going darker, not by the button moving.
 */
const variantStyles = {
  primary:
    'border border-transparent bg-accent text-white font-semibold shadow-sm hover:bg-accent-hover hover:shadow-md active:bg-accent-dark transition-colors',
  secondary:
    'border border-border-default bg-surface text-text-primary hover:bg-card-hover hover:border-secondary hover:text-secondary-dark dark:hover:text-secondary-light hover:shadow-sm active:bg-card transition-colors',
  outline:
    'border border-border-default bg-transparent text-text-secondary hover:bg-secondary/10 hover:border-secondary hover:text-secondary-dark dark:hover:text-secondary-light active:bg-secondary/15 transition-colors',
  ghost:
    'border border-transparent bg-transparent text-text-secondary hover:bg-secondary/10 hover:border-secondary/20 hover:text-secondary-dark dark:hover:text-secondary-light active:bg-secondary/15 transition-colors',
  danger:
    'border border-transparent bg-[#dc2626] text-white font-semibold shadow-sm hover:bg-[#b91c1c] hover:shadow-md active:bg-[#991b1b] transition-colors',
}

const sizeStyles = {
  sm: 'min-h-8 min-w-8 gap-1.5 rounded-lg px-3 text-xs',
  md: 'min-h-9 gap-2 rounded-lg px-4 text-xs font-semibold sm:text-[13px]',
  lg: 'min-h-11 gap-2.5 rounded-xl px-5 text-sm font-semibold',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex shrink-0 items-center justify-center border font-semibold whitespace-nowrap transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent focus-visible:ring-offset-page disabled:pointer-events-none disabled:opacity-40 cursor-pointer ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
