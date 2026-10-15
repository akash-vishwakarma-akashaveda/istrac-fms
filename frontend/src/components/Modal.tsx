import { useState, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'preview'
  closeOnBackdropClick?: boolean
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
 * Overlay panel. Machined-plate treatment lifted off the page by a dimmed backdrop.
 * Accidental outside clicks and text selection drags outside the dialog boundary
 * are safely prevented from closing the dialog unexpectedly.
 */
export function Modal({
  isOpen,
  onClose,
  title,
  size = 'sm',
  closeOnBackdropClick = false,
  children,
}: ModalProps) {
  const mouseDownTargetRef = useRef<EventTarget | null>(null)
  const [pulseWarning, setPulseWarning] = useState(false)

  if (!isOpen) return null

  const handleBackdropMouseDown = (e: React.MouseEvent) => {
    mouseDownTargetRef.current = e.target
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    // Only proceed if mouse down and mouse up both occurred directly on the backdrop element
    if (e.target === e.currentTarget && mouseDownTargetRef.current === e.currentTarget) {
      // If user has any active text selected, do NOT close the modal
      const hasSelection = Boolean(window.getSelection()?.toString().trim().length)
      if (hasSelection) {
        return
      }

      if (closeOnBackdropClick) {
        onClose()
      } else {
        // Accidental click outside detected: provide gentle visual feedback that dialog is protected
        setPulseWarning(true)
        setTimeout(() => setPulseWarning(false), 450)
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center bg-page/85 p-3 sm:p-4 backdrop-blur-[2px]"
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full ${sizeStyles[size]} max-h-[90dvh] sm:max-h-[92vh] flex flex-col overflow-hidden rounded-xl border border-border-default bg-card shadow-2xl my-auto transition-all duration-150 ${
          pulseWarning ? 'scale-[1.015] ring-2 ring-accent/60 shadow-accent/20' : ''
        }`}
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
