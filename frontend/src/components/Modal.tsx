import type { ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'preview'
  children: ReactNode
}

const sizeStyles = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  preview: 'max-w-6xl w-[94vw]',
}

/**
 * Overlay panel. Same machined-plate treatment as the rest of the app, lifted
 * off the page by a dimmed, slightly blurred backdrop instead of a soft shadow.
 */
export function Modal({ isOpen, onClose, title, size = 'sm', children }: ModalProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center bg-page/85 p-3 sm:p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full ${sizeStyles[size]} max-h-[90dvh] sm:max-h-[92vh] flex flex-col overflow-hidden rounded-xl border border-border-default bg-card shadow-2xl my-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border-subtle bg-surface px-4 py-3">
            <h2 className="eyebrow text-text-secondary">{title}</h2>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-1 shrink-0 rounded-lg p-1.5 text-text-muted transition-colors duration-150 hover:bg-card-hover hover:text-text-primary min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
            >
              <X size={16} strokeWidth={1.8} />
            </button>
          </header>
        )}

        <div className="p-4 sm:p-5 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  )
}
