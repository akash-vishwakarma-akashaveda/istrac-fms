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
} from 'lucide-react'
import { apiClient } from '../../api/client'

// Initialize in-memory Blob Worker (100% self-contained, no network request, no Amplify .mjs MIME issue)
try {
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    const blob = new Blob([workerCode], { type: 'text/javascript' })
    pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob)
  }
} catch (e) {
  console.warn('Worker blob initialization:', e)
}

interface PdfPreviewProps {
  fileUrl: string
  fileName?: string
  onDownload?: () => void
}

export function PdfPreview({ fileUrl, fileName = 'telemetry_document.pdf', onDownload }: PdfPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [pageNum, setPageNum] = useState(1)
  const [numPages, setNumPages] = useState(0)
  const [scale, setScale] = useState(1.2)
  const [rotation, setRotation] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isRendering, setIsRendering] = useState(false)
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
        setPageNum(1)
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

  // 2. High-DPI Canvas Rendering
  const renderCurrentPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return
    setIsRendering(true)

    try {
      const page = await pdfDoc.getPage(pageNum)
      const canvas = canvasRef.current
      if (!canvas) return
      const context = canvas.getContext('2d')
      if (!context) return

      const dpr = window.devicePixelRatio || 1
      const viewport = page.getViewport({ scale, rotation })

      canvas.width = Math.floor(viewport.width * dpr)
      canvas.height = Math.floor(viewport.height * dpr)
      canvas.style.width = `${Math.floor(viewport.width)}px`
      canvas.style.height = `${Math.floor(viewport.height)}px`

      context.setTransform(dpr, 0, 0, dpr, 0, 0)

      const renderContext = {
        canvasContext: context,
        viewport,
        canvas,
      }

      await page.render(renderContext).promise
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
        console.error('Page render error:', err)
      }
    } finally {
      setIsRendering(false)
    }
  }, [pdfDoc, pageNum, scale, rotation])

  useEffect(() => {
    renderCurrentPage()
  }, [renderCurrentPage])

  // 3. Navigation Controls
  const goToPrev = () => setPageNum((p) => Math.max(1, p - 1))
  const goToNext = () => setPageNum((p) => Math.min(numPages, p + 1))
  const zoomIn = () => setScale((s) => Math.min(2.5, +(s + 0.2).toFixed(1)))
  const zoomOut = () => setScale((s) => Math.max(0.6, +(s - 0.2).toFixed(1)))
  const resetZoom = () => setScale(1.2)
  const rotateClockwise = () => setRotation((r) => (r + 90) % 360)

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        goToPrev()
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault()
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
  }, [numPages])

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
      ref={containerRef}
      className={`flex flex-col rounded-2xl border border-white/10 bg-[#060a14] overflow-hidden shadow-2xl transition-all ${
        isFullscreen ? 'fixed inset-4 z-50' : 'w-full'
      }`}
    >
      {/* ============================================================ */}
      {/* CUSTOM ISTRAC TELEMETRY TOOLBAR */}
      {/* ============================================================ */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#0b1222]/90 px-4 py-2.5 backdrop-blur-md">
        {/* Left: Document Info & Page Stepper */}
        <div className="flex items-center gap-3">
          {/* Page Stepper */}
          <div className="flex items-center rounded-lg border border-white/10 bg-white/5 p-0.5 text-text-muted">
            <button
              type="button"
              onClick={goToPrev}
              disabled={pageNum <= 1}
              aria-label="Previous Page"
              className="p-1.5 rounded hover:bg-white/10 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
              title="Previous Page (Left Arrow)"
            >
              <ChevronLeft size={15} />
            </button>

            <span className="px-2.5 text-xs font-mono font-semibold text-white min-w-[4rem] text-center select-none">
              <span className="text-accent-light">{pageNum}</span>
              <span className="text-white/40 mx-1">/</span>
              <span>{numPages}</span>
            </span>

            <button
              type="button"
              onClick={goToNext}
              disabled={pageNum >= numPages}
              aria-label="Next Page"
              className="p-1.5 rounded hover:bg-white/10 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
              title="Next Page (Right Arrow)"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          <span className="hidden sm:inline text-[11px] font-mono text-text-dim truncate max-w-[200px]" title={fileName}>
            {fileName}
          </span>
        </div>

        {/* Center/Right: Zoom & Rotation Controls */}
        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <div className="flex items-center rounded-lg border border-white/10 bg-white/5 p-0.5 text-text-muted">
            <button
              type="button"
              onClick={zoomOut}
              disabled={scale <= 0.6}
              className="p-1.5 rounded hover:bg-white/10 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
              title="Zoom Out (-)"
            >
              <ZoomOut size={14} />
            </button>

            <button
              type="button"
              onClick={resetZoom}
              className="px-2 text-xs font-mono font-medium text-slate-300 hover:text-white transition-colors cursor-pointer min-w-[3.5rem] text-center"
              title="Click to Reset Zoom"
            >
              {Math.round(scale * 100)}%
            </button>

            <button
              type="button"
              onClick={zoomIn}
              disabled={scale >= 2.5}
              className="p-1.5 rounded hover:bg-white/10 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
              title="Zoom In (+)"
            >
              <ZoomIn size={14} />
            </button>
          </div>

          {/* Rotate Button */}
          <button
            type="button"
            onClick={rotateClockwise}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-text-muted hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            title="Rotate 90° Clockwise"
          >
            <RotateCw size={14} />
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen((f) => !f)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-text-muted hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Expand Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>

          {/* Download Action */}
          {onDownload && (
            <button
              type="button"
              onClick={onDownload}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-accent/40 bg-accent/15 text-accent-light hover:bg-accent/25 hover:text-white transition-all text-xs font-medium cursor-pointer shadow-sm"
              title="Download PDF Document"
            >
              <Download size={13} />
              <span className="hidden sm:inline">Download</span>
            </button>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* CANVAS VIEWPORT CONTAINER */}
      {/* ============================================================ */}
      <div
        className={`relative flex items-center justify-center overflow-auto bg-[#070b14] p-6 transition-all ${
          isFullscreen ? 'h-[calc(100vh-8rem)]' : 'max-h-[66vh] min-h-[420px]'
        }`}
      >
        {/* Subtle graticule grid pattern */}
        <div className="graticule-fine pointer-events-none absolute inset-0 opacity-20" />

        {/* Rendering Indicator */}
        {isRendering && (
          <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 rounded-full border border-white/15 bg-[#0b1222]/80 px-2.5 py-1 text-[10px] font-mono text-accent-light backdrop-blur-md">
            <RefreshCw size={11} className="animate-spin" />
            <span>Rendering…</span>
          </div>
        )}

        {/* High-Resolution Document Canvas */}
        <div className="relative z-10 transition-transform duration-150 rounded-lg shadow-[0_12px_40px_rgba(0,0,0,0.8)] border border-white/15 overflow-hidden bg-white">
          <canvas ref={canvasRef} className="block" />
        </div>
      </div>
    </div>
  )
}