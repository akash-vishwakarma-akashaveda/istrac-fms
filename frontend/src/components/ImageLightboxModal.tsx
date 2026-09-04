import { useState, useEffect, useCallback, useRef } from "react"
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ExternalLink,
  Compass,
  Image as ImageIcon,
  RefreshCw,
} from "lucide-react"
import { isSafeUrl } from "../lib/sanitize"

export interface LightboxImage {
  url: string
  title?: string
  caption?: string
  alt?: string
  tag?: string
  station?: string
}

interface ImageLightboxModalProps {
  isOpen: boolean
  onClose: () => void
  images: LightboxImage[]
  initialIndex?: number
}

const DEFAULT_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1517976487544-7832263ca7b9?auto=format&fit=crop&w=1200&q=80"

export function ImageLightboxModal({
  isOpen,
  onClose,
  images,
  initialIndex = 0,
}: ImageLightboxModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [zoom, setZoom] = useState(1)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [activeSrc, setActiveSrc] = useState<string>(
    images[initialIndex]?.url || DEFAULT_FALLBACK_IMAGE
  )
  const imgRef = useRef<HTMLImageElement | null>(null)

  const total = images.length
  const current = images[currentIndex] || images[0]

  // Sync initial index when modal opens
  useEffect(() => {
    if (isOpen) {
      const targetIdx = Math.max(0, Math.min(initialIndex, images.length - 1))
      setCurrentIndex(targetIdx)
      setZoom(1)
    }
  }, [isOpen, initialIndex, images.length])

  // Preload & verify image on slide change
  useEffect(() => {
    if (!isOpen || !current) return

    const rawUrl = current.url && isSafeUrl(current.url) ? current.url : ""
    const initialUrl = rawUrl || DEFAULT_FALLBACK_IMAGE

    setActiveSrc(initialUrl)
    setZoom(1)
    setImgLoaded(false)
    setHasError(false)

    let isMounted = true

    // Create an in-memory Image object to verify load status (works even if cached)
    const testImg = new window.Image()
    testImg.src = initialUrl

    // 1. Check if browser already has it cached
    if (testImg.complete) {
      if (testImg.naturalWidth > 0) {
        setImgLoaded(true)
      } else {
        // First url failed, try default space fallback
        if (initialUrl !== DEFAULT_FALLBACK_IMAGE) {
          setActiveSrc(DEFAULT_FALLBACK_IMAGE)
          setImgLoaded(true)
        } else {
          setHasError(true)
        }
      }
      return
    }

    // 2. Event listeners for asynchronous load
    testImg.onload = () => {
      if (isMounted) {
        setImgLoaded(true)
        setHasError(false)
      }
    }

    testImg.onerror = () => {
      if (isMounted) {
        if (initialUrl !== DEFAULT_FALLBACK_IMAGE) {
          setActiveSrc(DEFAULT_FALLBACK_IMAGE)
          setImgLoaded(true)
        } else {
          setHasError(true)
          setImgLoaded(true)
        }
      }
    }

    // 3. Fallback timeout: If image hangs for more than 3.5s, switch to fallback
    const timer = setTimeout(() => {
      if (isMounted && !testImg.complete) {
        if (initialUrl !== DEFAULT_FALLBACK_IMAGE) {
          setActiveSrc(DEFAULT_FALLBACK_IMAGE)
          setImgLoaded(true)
        } else {
          setImgLoaded(true)
        }
      }
    }, 3500)

    return () => {
      isMounted = false
      clearTimeout(timer)
      testImg.onload = null
      testImg.onerror = null
    }
  }, [isOpen, current, currentIndex])

  const handlePrev = useCallback(() => {
    if (total <= 1) return
    setCurrentIndex((prev) => (prev - 1 + total) % total)
  }, [total])

  const handleNext = useCallback(() => {
    if (total <= 1) return
    setCurrentIndex((prev) => (prev + 1) % total)
  }, [total])

  // Keyboard navigation & Shortcuts (Esc, Arrows, +, -, 0)
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      } else if (e.key === "ArrowLeft") {
        handlePrev()
      } else if (e.key === "ArrowRight") {
        handleNext()
      } else if (e.key === "+" || e.key === "=") {
        setZoom((z) => Math.min(3, Math.round((z + 0.25) * 100) / 100))
      } else if (e.key === "-" || e.key === "_") {
        setZoom((z) => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))
      } else if (e.key === "0") {
        setZoom(1)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = originalOverflow
    }
  }, [isOpen, onClose, handlePrev, handleNext])

  if (!isOpen || !current) return null

  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation()
    setZoom((z) => Math.min(3, Math.round((z + 0.25) * 100) / 100))
  }

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation()
    setZoom((z) => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))
  }

  const handleResetZoom = (e: React.MouseEvent) => {
    e.stopPropagation()
    setZoom(1)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={current.title || current.caption || "Enlarged Image Preview"}
      className="fixed inset-0 z-[99999] flex flex-col justify-between bg-black/60 backdrop-blur-md animate-fadeIn select-none overflow-hidden"
      onClick={onClose}
    >
      {/* ============================================================ */}
      {/* 1. TOP HEADER HUD — Translucent Frosted Glass */}
      {/* ============================================================ */}
      <header
        className="relative z-30 flex items-center justify-between border-b border-white/10 bg-[#080d19]/85 px-6 py-4 backdrop-blur-md shadow-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3.5 min-w-0 pr-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-accent-light">
            <Compass size={18} />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white truncate">
                {current.title || current.caption || "Telemetry Visual Feed"}
              </span>
              {current.tag && (
                <span className="font-mono rounded bg-accent/15 border border-accent/30 px-2 py-0.5 text-[10px] font-semibold text-accent-light">
                  {current.tag}
                </span>
              )}
            </div>
            <p className="text-xs text-text-dim truncate mt-0.5">
              {current.station || "ISTRAC Ground Network · Telemetry Visual Asset"}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Zoom Toolbar */}
          <div className="hidden sm:flex items-center rounded-lg border border-white/10 bg-white/5 p-0.5 text-text-muted">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoom <= 0.5}
              className="p-1.5 rounded hover:bg-white/10 hover:text-white disabled:opacity-35 transition-colors cursor-pointer"
              title="Zoom Out (-)"
            >
              <ZoomOut size={14} />
            </button>

            <span className="px-2 text-xs font-mono text-slate-300 min-w-[3.5rem] text-center">
              {Math.round(zoom * 100)}%
            </span>

            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoom >= 3}
              className="p-1.5 rounded hover:bg-white/10 hover:text-white disabled:opacity-35 transition-colors cursor-pointer"
              title="Zoom In (+)"
            >
              <ZoomIn size={14} />
            </button>

            <div className="h-3.5 w-px bg-white/10 mx-1" />

            <button
              type="button"
              onClick={handleResetZoom}
              className="p-1.5 rounded hover:bg-white/10 hover:text-white transition-colors text-[10px] font-mono flex items-center gap-1 cursor-pointer"
              title="Reset Zoom (0)"
            >
              <RotateCcw size={12} />
              <span>100%</span>
            </button>
          </div>

          {/* Slide Indicator Badge */}
          {total > 1 && (
            <span className="font-mono rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-accent-light">
              {currentIndex + 1} / {total}
            </span>
          )}

          {/* Open in New Tab */}
          {activeSrc && (
            <a
              href={activeSrc}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg border border-white/10 bg-white/5 text-text-muted hover:text-white hover:border-white/25 transition-all"
              title="Open full resolution in new tab"
            >
              <ExternalLink size={15} />
            </a>
          )}

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview modal (Esc)"
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-text-muted hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={15} />
            <span className="hidden sm:inline">Close</span>
            <kbd className="ml-1 hidden rounded bg-black/40 px-1.5 py-0.5 text-[9px] text-text-dim border border-white/10 sm:inline-block font-mono">
              ESC
            </kbd>
          </button>
        </div>
      </header>

      {/* ============================================================ */}
      {/* 2. MAIN IMAGE VIEWPORT CANVAS */}
      {/* ============================================================ */}
      <div
        className="relative flex-1 flex items-center justify-center p-4 sm:p-8 overflow-hidden cursor-zoom-out"
        onClick={onClose}
      >
        {/* Navigation Previous Button */}
        {total > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handlePrev()
            }}
            className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-[#080d19]/80 text-white/80 hover:text-white hover:bg-accent hover:border-accent shadow-xl backdrop-blur-md transition-all cursor-pointer group"
            aria-label="Previous image (Left Arrow)"
          >
            <ChevronLeft size={22} className="group-hover:-translate-x-0.5 transition-transform" />
          </button>
        )}

        {/* Navigation Next Button */}
        {total > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handleNext()
            }}
            className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-[#080d19]/80 text-white/80 hover:text-white hover:bg-accent hover:border-accent shadow-xl backdrop-blur-md transition-all cursor-pointer group"
            aria-label="Next image (Right Arrow)"
          >
            <ChevronRight size={22} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
        )}

        {/* Image Container Card */}
        <div
          className="relative max-h-[78vh] max-w-[92vw] overflow-hidden rounded-2xl border border-white/15 bg-[#0a0f1d]/90 shadow-2xl transition-transform duration-200 cursor-default flex items-center justify-center backdrop-blur-md"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Loading Indicator */}
          {!imgLoaded && !hasError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-12 text-center text-text-dim bg-[#0a0f1d]/90 backdrop-blur-sm z-10">
              <RefreshCw size={24} className="animate-spin text-accent-light" />
              <p className="text-xs text-text-dim font-mono">Loading telemetry asset…</p>
            </div>
          )}

          {/* Error Fallback */}
          {hasError ? (
            <div className="flex flex-col items-center justify-center gap-3 p-12 text-center text-text-dim">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-warning">
                <ImageIcon size={26} />
              </div>
              <p className="text-sm font-semibold text-white">Image Preview Unavailable</p>
              <p className="text-xs text-text-secondary max-w-sm">
                The requested telemetry asset could not be loaded from the storage server.
              </p>
            </div>
          ) : activeSrc ? (
            <img
              ref={imgRef}
              src={activeSrc}
              alt={current?.alt || current?.caption || current?.title || "Telemetry Image"}
              onLoad={() => {
                setImgLoaded(true)
                setHasError(false)
              }}
              onError={() => {
                if (activeSrc !== DEFAULT_FALLBACK_IMAGE) {
                  setActiveSrc(DEFAULT_FALLBACK_IMAGE)
                  setImgLoaded(true)
                } else {
                  setImgLoaded(true)
                  setHasError(true)
                }
              }}
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "center center",
                transition: "transform 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
              className={`max-h-[75vh] max-w-[90vw] object-contain select-none rounded-xl transition-opacity duration-300 ${
                imgLoaded ? "opacity-100" : "opacity-0"
              }`}
            />
          ) : null}
        </div>
      </div>

      {/* ============================================================ */}
      {/* 3. BOTTOM CAPTION & THUMBNAIL STRIP */}
      {/* ============================================================ */}
      <footer
        className="relative z-30 border-t border-white/10 bg-[#080d19]/85 px-6 py-4 backdrop-blur-md shadow-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
          <div className="space-y-1 max-w-3xl">
            {current.caption && (
              <p className="font-medium text-white leading-relaxed">
                {current.caption}
              </p>
            )}
            <div className="flex items-center gap-2.5 text-xs text-text-dim">
              <span className="flex items-center gap-1.5 text-nominal font-semibold font-mono text-[11px]">
                <span className="h-1.5 w-1.5 rounded-full bg-nominal" />
                PREVIEW MODE
              </span>
              <span>·</span>
              <span>Click outside or press <kbd className="font-mono rounded bg-black/40 px-1.5 py-0.5 border border-white/10 text-[10px]">Esc</kbd> to close</span>
            </div>
          </div>

          {/* Quick Thumbnail Strip for Multi-Image Sets */}
          {total > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto py-1 max-w-full sm:max-w-xs shrink-0">
              {images.map((img, idx) => (
                <button
                  key={`${img.url}-${idx}`}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`relative h-10 w-14 shrink-0 overflow-hidden rounded-lg border transition-all cursor-pointer ${
                    idx === currentIndex
                      ? "border-accent ring-2 ring-accent/40 scale-105"
                      : "border-white/15 opacity-50 hover:opacity-100"
                  }`}
                  aria-label={`Jump to slide ${idx + 1}`}
                >
                  <img
                    src={img.url || DEFAULT_FALLBACK_IMAGE}
                    alt={img.caption || `Thumbnail ${idx + 1}`}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.src = DEFAULT_FALLBACK_IMAGE
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </footer>
    </div>
  )
}
