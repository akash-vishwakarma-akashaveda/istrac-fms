import { useState, useEffect, useRef } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { ChevronLeft, ChevronRight, AlertTriangle, RefreshCw } from 'lucide-react'
import { apiClient } from '../../api/client'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

interface PdfPreviewProps {
  fileUrl: string
  fileName?: string
}

export function PdfPreview({ fileUrl }: PdfPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [pageNum, setPageNum] = useState(1)
  const [numPages, setNumPages] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setLoadError(null)

    async function loadPdf() {
      try {
        // Fetch through authenticated apiClient with Bearer token & refresh handling
        const res = await apiClient.get(fileUrl, { responseType: 'arraybuffer' })
        if (cancelled) return

        const data = new Uint8Array(res.data)
        const doc = await pdfjsLib.getDocument({ data }).promise
        if (cancelled) return

        setPdfDoc(doc)
        setNumPages(doc.numPages)
        setPageNum(1)
        setIsLoading(false)
      } catch (err: any) {
        if (cancelled) return
        console.error('PDF load error:', err)
        setLoadError(err?.response?.data?.error?.message || err?.message || 'Could not load PDF document')
        setIsLoading(false)
      }
    }

    loadPdf()
    return () => {
      cancelled = true
    }
  }, [fileUrl])

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return
    let renderTask: any = null

    pdfDoc.getPage(pageNum).then((page) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const context = canvas.getContext('2d')
      if (!context) return

      const viewport = page.getViewport({ scale: 1.3 })
      canvas.height = viewport.height
      canvas.width = viewport.width

      renderTask = page.render({ canvasContext: context, viewport, canvas })
    })

    return () => {
      if (renderTask) {
        try {
          renderTask.cancel?.()
        } catch {}
      }
    }
  }, [pdfDoc, pageNum])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-text-dim border border-border-subtle bg-page rounded-xl">
        <RefreshCw size={24} className="animate-spin text-accent-light mb-2" />
        <p className="num text-xs text-text-secondary">Rendering Mission PDF Document…</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-text-dim border border-border-subtle bg-page rounded-xl">
        <AlertTriangle size={24} className="text-warning mb-2" />
        <p className="text-sm font-semibold text-white">Preview Rendering Error</p>
        <p className="text-xs text-text-dim mt-1 max-w-sm">{loadError}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex max-h-[60vh] justify-center overflow-auto rounded-lg border border-border-subtle bg-page">
        <canvas ref={canvasRef} />
      </div>

      {/* Page transport */}
      {numPages > 1 && (
        <div className="flex items-center justify-center">
          <div className="flex items-center overflow-hidden rounded-md border border-border-default bg-surface">
            <button
              type="button"
              onClick={() => setPageNum((p) => Math.max(1, p - 1))}
              disabled={pageNum <= 1}
              aria-label="Previous page"
              className="p-1.5 text-text-muted transition-colors duration-150 hover:bg-card-hover hover:text-text-primary disabled:pointer-events-none disabled:opacity-30 cursor-pointer"
            >
              <ChevronLeft size={14} strokeWidth={2} />
            </button>

            <span aria-hidden="true" className="w-px self-stretch bg-border-default" />

            <span className="num px-3 text-[11px] text-text-secondary">
              {pageNum} <span className="text-text-dim">/</span> {numPages}
            </span>

            <span aria-hidden="true" className="w-px self-stretch bg-border-default" />

            <button
              type="button"
              onClick={() => setPageNum((p) => Math.min(numPages, p + 1))}
              disabled={pageNum >= numPages}
              aria-label="Next page"
              className="p-1.5 text-text-muted transition-colors duration-150 hover:bg-card-hover hover:text-text-primary disabled:pointer-events-none disabled:opacity-30 cursor-pointer"
            >
              <ChevronRight size={14} strokeWidth={2} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}