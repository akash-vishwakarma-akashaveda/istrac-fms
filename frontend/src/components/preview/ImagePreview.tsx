import { useState } from 'react'
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'

export function ImagePreview({ fileUrl, fileName }: { fileUrl: string; fileName: string }) {
  const [zoom, setZoom] = useState(1)

  if (!fileUrl) return null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex max-h-[60vh] items-center justify-center overflow-auto rounded-lg border border-border-subtle bg-page">
        <img
          src={fileUrl}
          alt={fileName}
          style={{ transform: `scale(${zoom})`, transition: 'transform 0.15s' }}
          className="max-w-none"
        />
      </div>

      {/* Zoom transport — one hairline frame, mono readout in the middle. */}
      <div className="flex items-center justify-center">
        <div className="flex items-center overflow-hidden rounded-md border border-border-default">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
            aria-label="Zoom out"
            className="p-1.5 text-text-muted transition-colors duration-150 hover:bg-card-hover hover:text-text-primary"
          >
            <ZoomOut size={14} strokeWidth={1.8} />
          </button>

          <span aria-hidden="true" className="w-px self-stretch bg-border-default" />

          <span className="num w-14 text-center text-[11px] text-text-secondary">
            {Math.round(zoom * 100)}%
          </span>

          <span aria-hidden="true" className="w-px self-stretch bg-border-default" />

          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
            aria-label="Zoom in"
            className="p-1.5 text-text-muted transition-colors duration-150 hover:bg-card-hover hover:text-text-primary"
          >
            <ZoomIn size={14} strokeWidth={1.8} />
          </button>

          <span aria-hidden="true" className="w-px self-stretch bg-border-default" />

          <button
            type="button"
            onClick={() => setZoom(1)}
            aria-label="Reset zoom"
            className="p-1.5 text-text-muted transition-colors duration-150 hover:bg-card-hover hover:text-text-primary"
          >
            <RotateCcw size={13} strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </div>
  )
}
