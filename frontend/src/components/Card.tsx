import type { ReactNode } from 'react'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'interactive'
  children: ReactNode
  className?: string
}

const variantStyles = {
  default: 'border border-border-default bg-card shadow-card',
  interactive: 'cursor-pointer border border-border-default bg-card shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-secondary/50 hover:bg-card-hover hover:shadow-card-hover',
}

export function Card({ variant = 'default', children, className = '', ...props }: CardProps) {
  return (
    <div className={`rounded-xl p-4 sm:p-5 ${variantStyles[variant]} ${className}`} {...props}>
      {children}
    </div>
  )
}
