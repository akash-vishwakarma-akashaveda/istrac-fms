import { useEffect, useId, useRef, useState } from 'react'
import { HelpCircle } from 'lucide-react'
import { useAuthStore } from '../store/authStore'

export type HelpTopic = 'departments' | 'deptFiles' | 'repository' | 'adminFiles' | 'search'

// Signed-in users get the full guide; visitors get a short version that doesn't describe
// internal data (paths, checksums, access rules) and points them to sign in.
const HELP: Record<HelpTopic, { title: string; full: string[]; public: string[] }> = {
  departments: {
    title: 'Finding a division',
    full: [
      'Type part of a division name or its short code, for example "FDD" or "Telemetry".',
      'Matching is not case-sensitive.',
      'Switch between Cards and Table to compare divisions side by side.',
    ],
    public: [
      'Type part of a division name or its short code, for example "FDD".',
      'Open a division to see its overview and highlighted reports.',
    ],
  },
  deptFiles: {
    title: 'Searching this division',
    full: [
      'Search matches file names, report titles and descriptions. Partial words work and case is ignored.',
      'Narrow results with the Spacecraft and File format filters; they combine with the search text.',
      'Clear the search box and set filters back to "All" to see everything again.',
    ],
    public: [
      'Search the reports this division has made public by name or title.',
      'Sign in to search the full division repository.',
    ],
  },
  repository: {
    title: 'Searching the repository',
    full: [
      'Search matches file names, tags and report details. Partial words work and case is ignored.',
      'Filters (spacecraft, format, category, date) combine with the search text.',
      'Date: pick a preset such as "Last 7 days", or "Custom range…" to choose From/To dates. Both dates are included.',
      'Use "Clear filters" to reset everything at once.',
    ],
    public: ['Sign in to search and filter this repository.'],
  },
  adminFiles: {
    title: 'Searching all files',
    full: [
      'Search matches file names, report titles, spacecraft and department names or codes.',
      'Filters combine with the search text. Choose "Custom range…" in the date filter to set exact From/To dates.',
      'Use the Active files / Trash toggle at the top to see files that were moved to Trash and restore them.',
    ],
    public: [],
  },
  search: {
    title: 'Search tips',
    full: [
      'Search looks across report titles, file names, descriptions, spacecraft, authors and department names or codes.',
      'Partial words work and case is ignored, so "chandra" finds "Chandrayaan-3".',
      'Use the side filters (category, format, date) to narrow the results; they combine with the search text.',
    ],
    public: ['Sign in to search mission reports.'],
  },
}

export function HelpTip({ topic, className = '' }: { topic: HelpTopic; className?: string }) {
  const isSignedIn = Boolean(useAuthStore((s) => s.user))
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const help = HELP[topic]
  const lines = isSignedIn ? help.full : help.public

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (lines.length === 0) return null

  return (
    <div ref={ref} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        aria-label={`Help: ${help.title}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:text-accent-light hover:bg-card-hover focus-visible:outline-2 focus-visible:outline-accent"
      >
        <HelpCircle size={16} aria-hidden="true" />
      </button>
      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={help.title}
          className="absolute right-0 top-full z-[60] mt-1.5 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-border-default bg-card p-3.5 text-left shadow-card-lg"
        >
          <p className="text-xs font-bold text-text-primary">{help.title}</p>
          <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-text-secondary list-disc pl-4">
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
