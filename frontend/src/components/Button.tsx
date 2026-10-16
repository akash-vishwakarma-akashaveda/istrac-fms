import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
}

/**
 * Buttons follow the brand roles: primary = saffron (the one main action), outline = tonal saffron
 * (secondary actions), secondary = neutral (Cancel and similar), ghost = quiet.
 */
const variantStyles = {
  primary:
    'border border-transparent bg-saffron text-white font-bold hover:bg-saffron-hover active:bg-saffron-hover transition-colors',
  secondary:
    'border border-transparent bg-page-soft text-text-primary hover:bg-border-subtle active:bg-border-subtle transition-colors',
  outline:
    'border border-transparent bg-saffron-soft text-saffron-text hover:bg-saffron-soft-hover active:bg-saffron-soft-hover transition-colors',
  ghost:
    'border border-transparent bg-transparent text-text-secondary hover:bg-page-soft hover:text-text-primary active:bg-border-subtle transition-colors',
  danger:
    'border border-transparent bg-critical-fill text-white font-semibold hover:brightness-110 active:brightness-95 transition-colors',
}

const sizeStyles = {
  sm: 'min-h-8 min-w-8 gap-1.5 rounded-lg px-3 text-xs',
  md: 'min-h-10 gap-2 rounded-[10px] px-4 text-sm font-semibold',
  lg: 'min-h-12 gap-2.5 rounded-[10px] px-6 text-[15px] font-bold',
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
      className={`inline-flex shrink-0 items-center justify-center border font-semibold whitespace-nowrap transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-focus-ring focus-visible:ring-offset-page disabled:pointer-events-none disabled:opacity-40 cursor-pointer ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
