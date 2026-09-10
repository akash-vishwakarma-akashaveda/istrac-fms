import { Monitor, Tablet, Smartphone, ExternalLink, ZoomIn, ZoomOut, RefreshCw } from "lucide-react"
import { useState, useRef, useEffect } from "react"
import { usePreviewRefresh } from "../context/PreviewRefreshContext"

type ViewportMode = "desktop" | "laptop" | "tablet" | "mobile"

interface ViewportConfig {
  label: string
  frameWidth: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
  hint: string
  mobileClass?: string
}

const VIEWPORTS: Record<ViewportMode, ViewportConfig> = {
  desktop: { label: "Desktop", frameWidth: "100%", icon: Monitor, hint: "1440px — Full workstation display" },
  laptop: { label: "Laptop", frameWidth: "1024px", icon: Monitor, hint: "1024px — Laptop / HD viewport" },
  tablet: { label: "Tablet", frameWidth: "768px", icon: Tablet, hint: "768px — iPad & tablet viewport", mobileClass: "max-w-[768px]" },
  mobile: { label: "Mobile", frameWidth: "390px", icon: Smartphone, hint: "390px — iPhone / mobile viewport", mobileClass: "max-w-[390px]" },
}

const ZOOM_LEVELS = [50, 67, 75, 100] as const
type ZoomLevel = (typeof ZOOM_LEVELS)[number]

export function LivePreviewPanel() {
  const [viewport, setViewport] = useState<ViewportMode>("desktop")
  const [zoom, setZoom] = useState<ZoomLevel>(100)
  const { refreshKey, triggerRefresh, activeSection } = usePreviewRefresh()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [iframeReady, setIframeReady] = useState(false)

  const vp = VIEWPORTS[viewport]
  const isDeviceFrame = viewport === "mobile" || viewport === "tablet"

  // When iframe loads, mark it ready and fire pending scroll
  const handleIframeLoad = () => {
    setIframeReady(true)
  }

  // When activeSection changes and iframe is ready, postMessage scroll command
  useEffect(() => {
    if (!activeSection || !iframeReady || !iframeRef.current) return
    iframeRef.current.contentWindow?.postMessage(
      { type: "CMS_SCROLL_TO", sectionKey: activeSection },
      window.location.origin,
    )
  }, [activeSection, iframeReady])

  // When iframe first loads after a new tab is selected, send the scroll
  useEffect(() => {
    if (iframeReady && activeSection && iframeRef.current) {
      iframeRef.current.contentWindow?.postMessage(
        { type: "CMS_SCROLL_TO", sectionKey: activeSection },
        window.location.origin,
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iframeReady])

  function zoomIn() {
    const idx = ZOOM_LEVELS.indexOf(zoom)
    if (idx < ZOOM_LEVELS.length - 1) setZoom(ZOOM_LEVELS[idx + 1])
  }
  function zoomOut() {
    const idx = ZOOM_LEVELS.indexOf(zoom)
    if (idx > 0) setZoom(ZOOM_LEVELS[idx - 1])
  }

  const stripColor =
    viewport === "desktop" ? "bg-accent/50" :
    viewport === "laptop" ? "bg-accent/30" :
    viewport === "tablet" ? "bg-warning/40" : "bg-nominal/40"

  // Always use plain "/" so the key-based remount triggers a real fresh load
  const iframeSrc = "/"

  return (
    <div className="flex h-full min-h-[480px] flex-col overflow-hidden bg-card lg:min-h-0">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border-subtle bg-[#07101f] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="eyebrow shrink-0 text-text-dim">Live Preview</span>
          {activeSection && (
            <span className="num hidden sm:flex items-center gap-1 rounded-full bg-accent/10 border border-accent/25 px-2 py-0.5 text-[10px] text-accent-light">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              {activeSection}
            </span>
          )}
          <span className="hidden truncate num text-[10px] text-text-dim sm:block">{vp.hint}</span>
        </div>

        {/* Viewport switcher */}
        <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-border-subtle bg-[#040a14] p-0.5">
          {(Object.entries(VIEWPORTS) as [ViewportMode, ViewportConfig][]).map(([key, cfg]) => {
            const Icon = cfg.icon
            const isActive = viewport === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setViewport(key)}
                title={cfg.hint}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold transition-all ${
                  isActive ? "bg-accent/15 text-accent-light" : "text-text-dim hover:text-text-primary"
                }`}
              >
                <Icon size={12} strokeWidth={2} />
                <span className="hidden sm:inline">{cfg.label}</span>
              </button>
            )
          })}
        </div>

        {/* Zoom + actions */}
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={zoomOut} disabled={zoom === ZOOM_LEVELS[0]} title="Zoom out"
            className="rounded p-1 text-text-dim hover:text-text-primary disabled:opacity-30 transition-colors">
            <ZoomOut size={13} />
          </button>
          <span className="num text-[10px] text-text-dim w-8 text-center">{zoom}%</span>
          <button type="button" onClick={zoomIn} disabled={zoom === ZOOM_LEVELS[ZOOM_LEVELS.length - 1]} title="Zoom in"
            className="rounded p-1 text-text-dim hover:text-text-primary disabled:opacity-30 transition-colors">
            <ZoomIn size={13} />
          </button>
          <div className="w-px h-4 bg-border-subtle mx-1" />
          <button type="button" onClick={() => { setIframeReady(false); triggerRefresh() }} title="Hard refresh preview"
            className="rounded p-1 text-text-dim hover:text-accent-light transition-colors">
            <RefreshCw size={13} />
          </button>
          <a href="/" target="_blank" rel="noreferrer" title="Open in new tab"
            className="rounded p-1 text-text-dim hover:text-accent-light transition-colors">
            <ExternalLink size={13} />
          </a>
        </div>
      </header>

      {/* Active device color indicator strip */}
      <div className={`h-0.5 shrink-0 transition-all duration-300 ${stripColor}`} />

      {/* Preview area */}
      <div className="graticule flex flex-1 items-start justify-center overflow-auto bg-page p-4">
        <div style={{
          width: isDeviceFrame ? vp.frameWidth : "100%",
          minWidth: !isDeviceFrame ? "100%" : undefined,
          transform: `scale(${zoom / 100})`,
          transformOrigin: "top center",
          transition: "transform 0.2s ease, width 0.25s ease",
        }}>
          {isDeviceFrame ? (
            <div className={`relative mx-auto rounded-3xl border-4 border-border-default bg-[#030709] shadow-card-lg overflow-hidden ${vp.mobileClass}`}>
              {viewport === "mobile" && (
                <div className="flex justify-center pt-2 pb-1">
                  <div className="h-1.5 w-16 rounded-full bg-border-default" />
                </div>
              )}
              {viewport === "tablet" && (
                <div className="flex justify-end pr-4 pt-2 pb-1">
                  <div className="h-2 w-2 rounded-full bg-border-default" />
                </div>
              )}
              <iframe
                ref={iframeRef}
                key={`${refreshKey}-${viewport}`}
                src={iframeSrc}
                title="Landing page preview"
                onLoad={handleIframeLoad}
                style={{ width: "100%", height: viewport === "mobile" ? "75vh" : "62vh", border: "none", display: "block" }}
              />
              {viewport === "mobile" && (
                <div className="flex justify-center py-2">
                  <div className="h-1 w-24 rounded-full bg-border-default" />
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border-default shadow-card-lg">
              <div className="flex items-center gap-2 bg-[#0c1424] border-b border-border-subtle px-3 py-2">
                <div className="flex gap-1.5 shrink-0">
                  <div className="h-2.5 w-2.5 rounded-full bg-critical/60" />
                  <div className="h-2.5 w-2.5 rounded-full bg-warning/60" />
                  <div className="h-2.5 w-2.5 rounded-full bg-nominal/60" />
                </div>
                <div className="flex-1 mx-2 rounded-md bg-[#060c18] border border-border-subtle px-3 py-1">
                  <span className="num text-[10px] text-text-dim">
                    istrac.isro.gov.in
                  </span>
                </div>
                <span className="num text-[10px] text-text-dim hidden sm:block">
                  {viewport === "desktop" ? "1440px" : "1024px"}
                </span>
              </div>
              <iframe
                ref={iframeRef}
                key={`${refreshKey}-${viewport}`}
                src={iframeSrc}
                title="Landing page preview"
                onLoad={handleIframeLoad}
                style={{ width: "100%", height: "65vh", border: "none", display: "block" }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
