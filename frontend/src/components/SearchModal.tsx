import { useState, useEffect, useRef } from 'react'
import { Search, X, Lock, FileText, Folder, ArrowRight, ShieldCheck, LogIn } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { browseApi, type SearchResultItem } from '../api/browse.api'
import { Button } from '.'

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery('')
      setResults([])
    }
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        if (isOpen) onClose()
        else {
          // Trigger handled elsewhere
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!user || !query.trim()) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await browseApi.search(query.trim())
        setResults(res.data || [])
      } catch {
        setResults([])
      } finally {
        setIsSearching(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [query, user])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-20 sm:pt-24">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-page/85 backdrop-blur-md transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Global File Search"
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-border-default bg-card shadow-2xl transition-all"
      >
        {/* Search Header Bar */}
        <div className="relative flex items-center border-b border-border-subtle bg-surface px-4 py-3.5">
          <Search size={18} className="text-accent-light shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              user
                ? 'Search telemetry dumps, mission passes, PDF reports...'
                : 'Search telemetry repository (Authentication required)...'
            }
            className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-dim focus:outline-none"
          />

          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="mr-2 p-1 text-text-dim hover:text-text-primary"
            >
              <X size={15} />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border-subtle bg-card px-2 py-0.5 text-[10px] font-bold text-text-muted hover:text-text-primary"
          >
            ESC
          </button>
        </div>

        {/* Content Body */}
        <div className="max-h-[60vh] overflow-y-auto p-4">
          {!user ? (
            /* Restricted State for Signed-Out Visitors */
            <div className="py-8 text-center space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-warning/30 bg-warning/10 text-warning shadow-inner">
                <Lock size={22} strokeWidth={2} />
              </div>

              <div className="max-w-md mx-auto">
                <h3 className="text-base font-bold text-text-primary">
                  Restricted Repository Search
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-text-muted">
                  Full-text file indexing, orbital telemetry extraction, and mission dataset downloads are air-gapped and restricted to authorized ISTRAC personnel.
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <Link to="/login" onClick={onClose}>
                  <Button variant="primary" size="md" className="shadow-lg shadow-accent/25">
                    <LogIn size={15} />
                    <span>Log In to Search</span>
                  </Button>
                </Link>

                <Link to="/register" onClick={onClose}>
                  <Button variant="outline" size="md">
                    Request Access
                  </Button>
                </Link>
              </div>

              <div className="flex items-center justify-center gap-2 pt-4 text-[11px] text-text-dim">
                <ShieldCheck size={13} className="text-nominal" />
                <span>Air-Gapped Multi-RBAC Security</span>
              </div>
            </div>
          ) : query.trim() === '' ? (
            /* Empty State for Logged In User */
            <div className="py-10 text-center text-text-dim">
              <Search size={28} className="mx-auto mb-2 opacity-40" />
              <p className="text-xs">Type a filename, pass ID, satellite name, or extension to search.</p>
              <span className="num mt-1 block text-[10px]">E.g. "cartosat", "telemetry.bin", "pass_04"</span>
            </div>
          ) : isSearching ? (
            /* Searching spinner */
            <div className="py-10 text-center">
              <p className="num text-xs text-accent-light animate-pulse">Scanning telemetry index...</p>
            </div>
          ) : results.length === 0 ? (
            /* No Results */
            <div className="py-10 text-center text-text-dim">
              <p className="text-xs text-text-secondary">No files or folders found matching "{query}"</p>
              <p className="num mt-1 text-[10px]">Check your spelling or department access scope.</p>
            </div>
          ) : (
            /* Search Results List */
            <div className="space-y-1">
              <span className="eyebrow block px-2 pb-2 text-[10px] text-text-dim">
                {results.length} item{results.length === 1 ? '' : 's'} found
              </span>
              {results.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onClose()
                    navigate(`/dashboard/files/${item.departmentId}`)
                  }}
                  className="group flex w-full items-center justify-between rounded-xl p-3 text-left transition-colors hover:bg-card-hover border border-transparent hover:border-border-subtle"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface border border-border-subtle text-accent-light">
                      {item.nodeType === 'FOLDER' ? <Folder size={16} /> : <FileText size={16} />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-text-primary group-hover:text-accent-light">
                        {item.name}
                      </p>
                      <p className="num truncate text-[10px] text-text-dim">
                        {item.departmentName} · {item.satelliteName}
                      </p>
                    </div>
                  </div>

                  <ArrowRight
                    size={14}
                    className="shrink-0 text-text-dim transition-transform group-hover:translate-x-1 group-hover:text-accent-light"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border-subtle bg-surface px-4 py-2.5 text-[11px] text-text-dim">
          <span className="num">ISTRAC AIR-GAPPED INDEX</span>
          <span className="num">ESC to close</span>
        </div>
      </div>
    </div>
  )
}
