import { useState, useEffect, useRef, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import workerCode from 'pdfjs-dist/build/pdf.worker.mjs?raw'
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  AlertTriangle,
  RefreshCw,
  Maximize2,
  Minimize2,
  MoveHorizontal,
  Maximize,
} from 'lucide-react'
import { apiClient } from '../../api/client'

// Initialize in-memory Blob Worker (100% self-contained, no network request, no MIME issue)
try {
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    const blob = new Blob([workerCode], { type: 'text/javascript' })
    pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob)
  }
} catch (e) {
  console.warn('Worker blob initialization:', e)
}

interface PdfPageItemProps {
  doc: pdfjsLib.PDFDocumentProxy
  pageNumber: number
  scale: number
  rotation: number
  onVisible?: (pageNumber: number) => void
}

function PdfPageItem({ doc, pageNumber, scale, rotation, onVisible }: PdfPageItemProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isRendered, setIsRendered] = useState(false)
  const [isRendering, setIsRendering] = useState(false)
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null)
  const [isInViewport, setIsInViewport] = useState(false)

  // 1. Compute page dimensions
  useEffect(() => {
    let active = true
    doc.getPage(pageNumber).then((page) => {
      if (!active) return
      const viewport = page.getViewport({ scale, rotation })
      setPageSize({ width: Math.floor(viewport.width), height: Math.floor(viewport.height) })
    })
    return () => {
      active = false
    }
  }, [doc, pageNumber, scale, rotation])

  // 2. IntersectionObserver to detect when page is near or in viewport
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInViewport(true)
          onVisible?.(pageNumber)
        }
      },
      { rootMargin: '600px 0px 600px 0px', threshold: 0.1 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [pageNumber, onVisible])

  // 3. Render page canvas when in or near viewport
  useEffect(() => {
    if (!isInViewport || !canvasRef.current) return
    let renderTask: any = null
    let active = true
    setIsRendering(true)

    doc.getPage(pageNumber).then((page) => {
      if (!active || !canvasRef.current) return
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')
      if (!context) return

      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const viewport = page.getViewport({ scale, rotation })

      canvas.width = Math.floor(viewport.width * dpr)
      canvas.height = Math.floor(viewport.height * dpr)
      canvas.style.width = `${Math.floor(viewport.width)}px`
      canvas.style.height = `${Math.floor(viewport.height)}px`

      context.setTransform(dpr, 0, 0, dpr, 0, 0)

      renderTask = page.render({
        canvasContext: context,
        viewport,
        canvas,
      })

      renderTask.promise
        .then(() => {
          if (active) {
            setIsRendered(true)
            setIsRendering(false)
          }
        })
        .catch((err: any) => {
          if (err?.name !== 'RenderingCancelledException') {
            console.error(`Page ${pageNumber} render error:`, err)
          }
        })
    })

    return () => {
      active = false
      if (renderTask) {
        try {
          renderTask.cancel()
        } catch {}
      }
    }
  }, [doc, pageNumber, scale, rotation, isInViewport])

  return (
    <div
      ref={containerRef}
      id={`pdf-page-${pageNumber}`}
      className="relative m-auto my-2 flex flex-col items-center transition-all"
      style={{
        minWidth: pageSize ? `${pageSize.width}px` : '300px',
        minHeight: pageSize ? `${pageSize.height}px` : '400px',
      }}
    >
      {/* Page Badge */}
      <div className="self-end mb-1 mr-1">
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-surface text-text-dim border border-border-subtle shadow-sm select-none">
          Page {pageNumber}
        </span>
      </div>

      {/* Page Canvas Box */}
      <div
        className="relative rounded-lg shadow-[0_12px_40px_rgba(0,0,0,0.85)] border border-border-subtle overflow-hidden bg-white"
        style={{
          width: pageSize ? `${pageSize.width}px` : undefined,
          height: pageSize ? `${pageSize.height}px` : undefined,
        }}
      >
        <canvas ref={canvasRef} className="block" />

        {/* Loading Spinner for unrendered or rendering pages */}
        {(!isRendered || isRendering) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 text-slate-700">
            <RefreshCw size={22} className="animate-spin text-accent mb-2" />
            <span className="text-xs font-mono font-semibold">Rendering Page {pageNumber}…</span>
          </div>
        )}
      </div>
    </div>
  )
}

interface PdfPreviewProps {
  fileUrl: string
  fileName?: string
  onDownload?: () => void
}

export function PdfPreview({ fileUrl, fileName = 'telemetry_document.pdf', onDownload }: PdfPreviewProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [activePage, setActivePage] = useState(1)
  const [numPages, setNumPages] = useState(0)
  const [scale, setScale] = useState(1.0)
  const [rotation, setRotation] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // 1. Fetch PDF binary via authenticated apiClient and parse document
  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setLoadError(null)

    async function loadPdf() {
      try {
        const res = await apiClient.get(fileUrl, { responseType: 'arraybuffer' })
        if (cancelled) return

        const data = new Uint8Array(res.data)
        const loadingTask = pdfjsLib.getDocument({ data })
        const doc = await loadingTask.promise
        if (cancelled) return

        setPdfDoc(doc)
        setNumPages(doc.numPages)
        setActivePage(1)

        // Calculate auto-fit width based on available viewport width
        try {
          const firstPage = await doc.getPage(1)
          const baseViewport = firstPage.getViewport({ scale: 1.0, rotation: 0 })
          const availableW = Math.max(300, (scrollContainerRef.current?.clientWidth || 880) - 64)
          const initialScale = Math.min(1.2, Math.max(0.65, availableW / baseViewport.width))
          setScale(+initialScale.toFixed(2))
        } catch {
          setScale(1.0)
        }

        setIsLoading(false)
      } catch (err: any) {
        if (cancelled) return
        console.error('PDF parsing error:', err)
        setLoadError(
          err?.response?.data?.error?.message ||
          err?.message ||
          'Failed to decrypt and parse PDF telemetry document'
        )
        setIsLoading(false)
      }
    }

    loadPdf()
    return () => {
      cancelled = true
    }
  }, [fileUrl])

  // Scroll to a specific page smoothly
  const scrollToPage = useCallback(
    (targetPage: number) => {
      const safeTarget = Math.max(1, Math.min(numPages, targetPage))
      const el = document.getElementById(`pdf-page-${safeTarget}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        setActivePage(safeTarget)
      }
    },
    [numPages]
  )

  const goToPrev = () => scrollToPage(activePage - 1)
  const goToNext = () => scrollToPage(activePage + 1)
  const zoomIn = () => setScale((s) => Math.min(2.5, +(s + 0.15).toFixed(2)))
  const zoomOut = () => setScale((s) => Math.max(0.5, +(s - 0.15).toFixed(2)))
  const resetZoom = () => setScale(1.0)
  const rotateClockwise = () => setRotation((r) => (r + 90) % 360)

  // Fit Width
  const fitWidth = async () => {
    if (!pdfDoc) return
    try {
      const page = await pdfDoc.getPage(activePage)
      const baseViewport = page.getViewport({ scale: 1.0, rotation })
      const availableW = Math.max(300, (scrollContainerRef.current?.clientWidth || 880) - 64)
      const newScale = Math.min(2.0, Math.max(0.5, availableW / baseViewport.width))
      setScale(+newScale.toFixed(2))
    } catch (e) {
      console.error('Fit width error:', e)
    }
  }

  // Fit Entire Page
  const fitPage = async () => {
    if (!pdfDoc) return
    try {
      const page = await pdfDoc.getPage(activePage)
      const baseViewport = page.getViewport({ scale: 1.0, rotation })
      const availableW = Math.max(300, (scrollContainerRef.current?.clientWidth || 880) - 64)
      const availableH = Math.max(300, (scrollContainerRef.current?.clientHeight || 600) - 64)
      const scaleW = availableW / baseViewport.width
      const scaleH = availableH / baseViewport.height
      const newScale = Math.min(scaleW, scaleH, 1.4)
      setScale(+Math.max(0.4, newScale).toFixed(2))
    } catch (e) {
      console.error('Fit page error:', e)
    }
  }

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        goToPrev()
      } else if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        goToNext()
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        zoomIn()
      } else if (e.key === '-') {
        e.preventDefault()
        zoomOut()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goToPrev, goToNext])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center border border-border-subtle bg-[#070b14] rounded-2xl shadow-inner">
        <RefreshCw size={28} className="animate-spin text-accent-light mb-3" />
        <p className="num text-xs font-semibold tracking-wider text-white uppercase">
          Initializing ISTRAC Telemetry Engine…
        </p>
        <p className="text-[11px] text-text-dim mt-1 font-mono">Parsing document pages and cryptographic metadata</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center p-10 text-center border border-border-subtle bg-[#070b14] rounded-2xl">
        <AlertTriangle size={30} className="text-warning mb-2" />
        <p className="text-sm font-semibold text-white">Preview Rendering Error</p>
        <p className="text-xs text-text-dim mt-1 max-w-md">{loadError}</p>
        {onDownload && (
          <div className="mt-4">
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex items-center gap-1.5 text-xs text-accent-light hover:underline cursor-pointer bg-transparent border-0"
            >
              <Download size={13} />
              Download original file directly
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className={`flex flex-col rounded-2xl border border-border-default bg-[#060a14] overflow-hidden shadow-2xl transition-all ${
        isFullscreen ? 'fixed inset-4 z-50' : 'w-full'
      }`}
    >
      {/* ============================================================ */}
      {/* ISTRAC STANDARD TELEMETRY TOOLBAR */}
      {/* ============================================================ */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle bg-surface px-4 py-2.5">
        {/* Left: Document Info & Page Stepper */}
        <div className="flex items-center gap-3">
          {/* Page Stepper */}
          <div className="flex items-center rounded-lg border border-border-default bg-card p-0.5 text-text-muted">
            <button
              type="button"
              onClick={goToPrev}
              disabled={activePage <= 1}
              aria-label="Previous Page"
              className="p-1.5 rounded hover:bg-card-hover hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
              title="Previous Page (Up Arrow)"
            >
              <ChevronLeft size={15} />
            </button>

            <span className="px-2.5 text-xs font-mono font-semibold text-white min-w-[4rem] text-center select-none">
              <span className="text-accent-light font-bold">{activePage}</span>
              <span className="text-text-dim mx-1">/</span>
              <span>{numPages}</span>
            </span>

            <button
              type="button"
              onClick={goToNext}
              disabled={activePage >= numPages}
              aria-label="Next Page"
              className="p-1.5 rounded hover:bg-card-hover hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
              title="Next Page (Down Arrow)"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          <span className="hidden md:inline text-[11px] font-mono text-text-dim truncate max-w-[240px]" title={fileName}>
            {fileName}
          </span>
        </div>

        {/* Center/Right: Zoom, Layout & Rotation Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Fit Width & Fit Page Quick Actions */}
          <div className="hidden sm:flex items-center rounded-lg border border-border-default bg-card p-0.5 text-text-muted">
            <button
              type="button"
              onClick={fitWidth}
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-mono text-text-secondary hover:text-white hover:bg-card-hover rounded transition-colors cursor-pointer"
              title="Fit to Width"
            >
              <MoveHorizontal size={12} />
              <span>Fit Width</span>
            </button>
            <button
              type="button"
              onClick={fitPage}
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-mono text-text-secondary hover:text-white hover:bg-card-hover rounded transition-colors cursor-pointer"
              title="Fit Entire Page"
            >
              <Maximize size={12} />
              <span>Fit Page</span>
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center rounded-lg border border-border-default bg-card p-0.5 text-text-muted">
            <button
              type="button"
              onClick={zoomOut}
              disabled={scale <= 0.5}
              className="p-1.5 rounded hover:bg-card-hover hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
              title="Zoom Out (-)"
            >
              <ZoomOut size={14} />
            </button>

            <button
              type="button"
              onClick={resetZoom}
              className="px-2 text-xs font-mono font-bold text-accent-light hover:text-white transition-colors cursor-pointer min-w-[3.5rem] text-center"
              title="Reset to 100%"
            >
              {Math.round(scale * 100)}%
            </button>

            <button
              type="button"
              onClick={zoomIn}
              disabled={scale >= 2.5}
              className="p-1.5 rounded hover:bg-card-hover hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
              title="Zoom In (+)"
            >
              <ZoomIn size={14} />
            </button>
          </div>

          {/* Rotate Button */}
          <button
            type="button"
            onClick={rotateClockwise}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-default bg-card text-text-muted hover:bg-card-hover hover:text-white transition-colors cursor-pointer"
            title="Rotate 90° Clockwise"
          >
            <RotateCw size={14} />
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen((f) => !f)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-default bg-card text-text-muted hover:bg-card-hover hover:text-white transition-colors cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Expand Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>

          {/* Download Action */}
          {onDownload && (
            <button
              type="button"
              onClick={onDownload}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-accent bg-accent text-white hover:bg-accent-hover text-xs font-bold shadow-button transition-colors cursor-pointer"
              title="Download Original PDF"
            >
              <Download size={13} />
              <span className="hidden sm:inline">Download</span>
            </button>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* CONTINUOUS VERTICAL SCROLL VIEWPORT */}
      {/* ============================================================ */}
      <div
        ref={scrollContainerRef}
        className={`relative overflow-y-auto overflow-x-auto bg-[#070b14] p-4 sm:p-6 transition-all flex flex-col ${
          isFullscreen ? 'h-[calc(100vh-7rem)]' : 'h-[72vh] min-h-[500px]'
        }`}
      >
        {/* Subtle graticule grid pattern */}
        <div className="graticule-fine pointer-events-none absolute inset-0 opacity-20" />

        {/* Multi-page vertical stack */}
        <div className="w-full flex flex-col items-center py-2 space-y-6">
          {pdfDoc &&
            Array.from({ length: numPages }, (_, i) => i + 1).map((pageNumber) => (
              <PdfPageItem
                key={pageNumber}
                doc={pdfDoc}
                pageNumber={pageNumber}
                scale={scale}
                rotation={rotation}
                onVisible={(p) => setActivePage(p)}
              />
            ))}
        </div>
      </div>
    </div>
  )
}