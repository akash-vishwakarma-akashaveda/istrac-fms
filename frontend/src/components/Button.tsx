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
    'border border-transparent bg-accent text-white font-semibold shadow-sm hover:bg-accent-hover hover:shadow-md hover:scale-[1.01] active:scale-[0.98]',
  secondary:
    'border border-border-default bg-surface text-text-primary hover:bg-card-hover hover:border-secondary hover:text-secondary-dark dark:hover:text-secondary-light hover:shadow-sm active:scale-[0.98]',
  outline:
    'border border-border-default bg-transparent text-text-secondary hover:bg-secondary/10 hover:border-secondary hover:text-secondary-dark dark:hover:text-secondary-light active:scale-[0.98]',
  ghost:
    'border border-transparent bg-transparent text-text-secondary hover:bg-secondary/10 hover:border-secondary/20 hover:text-secondary-dark dark:hover:text-secondary-light active:scale-[0.98]',
  danger:
    'border border-transparent bg-[#dc2626] text-white font-semibold shadow-sm hover:bg-[#b91c1c] hover:shadow-md hover:scale-[1.01] active:scale-[0.98]',
}

const sizeStyles = {
  sm: 'min-h-8 gap-1.5 rounded-md px-3 text-xs',
  md: 'min-h-9 gap-2 rounded-md px-3.5 text-[13px]',
  lg: 'min-h-11 gap-2 rounded-md px-5 text-sm',
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
      className={`inline-flex shrink-0 items-center justify-center border font-semibold whitespace-nowrap transition-colors duration-150 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-40 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
