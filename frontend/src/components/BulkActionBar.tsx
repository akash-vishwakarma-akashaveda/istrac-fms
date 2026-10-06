import { X } from 'lucide-react'
import { Button } from '.'

interface BulkActionBarProps {
  selectedCount: number
  /** Omit to hide the delete action (e.g. for users who cannot move files to Trash). */
  onDelete?: () => void
  onTag: () => void
  onClear: () => void
  isDeleting?: boolean
}

/**
 * Floats above the work area while a selection is live, so the actions stay
 * reachable no matter how far down the list you've scrolled.
 */
export function BulkActionBar({
  selectedCount,
  onDelete,
  onTag,
  onClear,
  isDeleting = false,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="animate-rise pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4"
    >
      <div className="pointer-events-auto flex items-center gap-4 rounded-lg border border-border-bright bg-surface px-3 py-2.5 shadow-card-lg">
        <span className="flex items-center gap-2.5 pl-1">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />

          <span className="num text-xs text-text-primary">
            {selectedCount} selected
          </span>
        </span>

        <span aria-hidden="true" className="h-5 w-px bg-border-default" />

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onTag} disabled={isDeleting}>
            Tag
          </Button>

          {onDelete && (
            <Button variant="danger" size="sm" onClick={onDelete} disabled={isDeleting}>
              {isDeleting ? 'Moving…' : 'Move to Trash'}
            </Button>
          )}

          <button
            type="button"
            onClick={onClear}
            disabled={isDeleting}
            aria-label="Clear selection"
            className="rounded-md p-1.5 text-text-muted transition-colors duration-150 hover:bg-card-hover hover:text-text-primary disabled:pointer-events-none disabled:opacity-40"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  )
}
