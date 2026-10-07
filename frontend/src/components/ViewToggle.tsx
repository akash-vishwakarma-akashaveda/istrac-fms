import { useState } from 'react'
import { LayoutGrid, Table2 } from 'lucide-react'

export type ViewMode = 'cards' | 'table'

/** Card/table preference, remembered per page in this browser (best effort). */
export function useViewMode(storageKey: string, initial: ViewMode = 'cards') {
  const key = `view-mode:${storageKey}`
  const [mode, setMode] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem(key)
      return saved === 'table' || saved === 'cards' ? saved : initial
    } catch {
      return initial
    }
  })
  const update = (next: ViewMode) => {
    setMode(next)
    try {
      localStorage.setItem(key, next)
    } catch {
      // storage unavailable (private mode); the choice just isn't remembered
    }
  }
  return [mode, update] as const
}

export function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (mode: ViewMode) => void }) {
  const btn = (value: ViewMode, label: string, Icon: typeof LayoutGrid) => (
    <button
      type="button"
      aria-pressed={mode === value}
      onClick={() => onChange(value)}
      title={`Show as ${label.toLowerCase()}`}
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
        mode === value ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'
      }`}
    >
      <Icon size={13} aria-hidden="true" />
      <span>{label}</span>
    </button>
  )
  return (
    <div role="group" aria-label="Choose layout" className="inline-flex shrink-0 rounded-lg border border-border-default bg-surface p-0.5">
      {btn('cards', 'Cards', LayoutGrid)}
      {btn('table', 'Table', Table2)}
    </div>
  )
}
