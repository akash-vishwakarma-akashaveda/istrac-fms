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
    'border-accent bg-accent text-white shadow-button hover:border-accent-hover hover:bg-accent-hover active:bg-accent-dark',
  secondary:
    'border-border-default bg-card-hover text-text-primary hover:border-border-bright hover:bg-surface active:bg-card',
  outline:
    'border-border-default bg-transparent text-text-secondary hover:border-border-bright hover:bg-card-hover hover:text-text-primary active:bg-card',
  ghost:
    'border-transparent bg-transparent text-text-secondary hover:bg-card-hover hover:text-text-primary active:bg-card',
  danger:
    // #dc2626 keeps white text at 4.8:1 in both themes (the brighter critical red is 3.8:1).
    'border-[#dc2626] bg-[#dc2626] text-white hover:border-[#b91c1c] hover:bg-[#b91c1c] active:bg-[#991b1b]',
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
