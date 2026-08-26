import { useState, useEffect, useRef } from 'react'
import { Search, X, FileText, Folder, ArrowRight, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { browseApi, type SearchResultItem } from '../api/browse.api'
import { formatFileSize } from '../lib/formatFileSize'

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
      }
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Live real-time search for all users & visitors
  useEffect(() => {
    if (!query.trim()) {
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
    }, 200)

    return () => clearTimeout(timer)
  }, [query])

  const handleResultClick = (item: SearchResultItem) => {
    onClose()
    if (user) {
      navigate(`/departments/${item.departmentId}`)
    } else {
      navigate(`/departments/${item.departmentId}`)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:pt-24 animate-fadeIn">
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
            placeholder="Search telemetry archives, PDF reports, spacecraft passes, mission ephemeris..."
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
          {query.trim() === '' ? (
            /* Empty State */
            <div className="py-10 text-center text-text-dim space-y-2">
              <Search size={28} className="mx-auto mb-2 opacity-40 text-accent-light" />
              <p className="text-xs text-text-secondary">Type any filename, spacecraft code, or format to search live repository index.</p>
              <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
                {['Cartosat', 'Aditya-L1', 'PSLV', 'Gaganyaan', '.pdf', '.bin', '.dat'].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setQuery(tag)}
                    className="num rounded-full border border-border-subtle bg-surface px-2.5 py-1 text-[10px] font-semibold text-text-muted hover:border-accent hover:text-white transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          ) : isSearching ? (
            /* Searching spinner */
            <div className="py-10 text-center">
              <p className="num text-xs text-accent-light animate-pulse flex items-center justify-center gap-2">
                <Sparkles size={14} />
                <span>Scanning ISTRAC telemetry repository index…</span>
              </p>
            </div>
          ) : results.length === 0 ? (
            /* No Results */
            <div className="py-10 text-center text-text-dim space-y-1">
              <p className="text-xs font-semibold text-text-secondary">No files or telemetry records matched "{query}"</p>
              <p className="num text-[10px] text-text-dim">Try searching by spacecraft name (e.g. Aditya, Cartosat) or file extension.</p>
            </div>
          ) : (
            /* Search Results List */
            <div className="space-y-1.5">
              <span className="eyebrow block px-2 pb-2 text-[10px] text-text-dim">
                {results.length} record{results.length === 1 ? '' : 's'} indexed
              </span>
              {results.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleResultClick(item)}
                  className="group flex w-full items-center justify-between rounded-xl p-3 text-left transition-all hover:bg-card-hover border border-border-subtle/60 hover:border-accent/40 cursor-pointer bg-[#060c18]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface border border-border-subtle text-accent-light group-hover:border-accent/50 group-hover:text-white transition-colors">
                      {item.nodeType === 'FOLDER' ? <Folder size={17} /> : <FileText size={17} />}
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate text-xs font-bold text-white group-hover:text-accent-light transition-colors">
                        {item.name}
                      </p>
                      <div className="flex items-center gap-2 num text-[10px] text-text-dim">
                        <span className="text-accent-light font-semibold">/{item.departmentName}</span>
                        <span>·</span>
                        <span>{item.satelliteName}</span>
                        {item.sizeBytes && Number(item.sizeBytes) > 0 && (
                          <>
                            <span>·</span>
                            <span>{formatFileSize(Number(item.sizeBytes))}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className="rounded bg-surface border border-border-subtle px-1.5 py-0.5 text-[9px] font-bold uppercase num text-text-dim group-hover:text-white">
                      {item.extension || 'DAT'}
                    </span>
                    <ArrowRight
                      size={14}
                      className="text-text-dim transition-transform group-hover:translate-x-1 group-hover:text-accent-light"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border-subtle bg-surface px-4 py-2.5 text-[11px] text-text-dim">
          <span className="num flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-nominal" />
            <span>ISTRAC LIVE REPOSITORY INDEX</span>
          </span>
          <span className="num">ESC to close</span>
        </div>
      </div>
    </div>
  )
}
