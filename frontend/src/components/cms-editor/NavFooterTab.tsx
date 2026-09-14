import { useEffect, useState } from "react"
import { Layers, MapPin } from "lucide-react"
import { useCms } from "../../context/cmsContext"
import { useUpdateCmsBlock } from "../../hooks/useUpdateCmsBlock"
import { useToastStore } from "../../store/toastStore"
import { usePreviewRefresh } from "../../context/PreviewRefreshContext"
import { Input, Panel, Textarea } from ".."
import { SaveBar } from "./SaveBar"

interface NavFooterContent {
  brandSubtitle?: string
  groundStations?: string
  footerCopyright?: string
  footerQuickLinks?: string
}

export function NavFooterTab() {
  const { cmsBlocks } = useCms()
  const updateBlock = useUpdateCmsBlock()
  const addToast = useToastStore((s) => s.addToast)
  const { triggerRefresh } = usePreviewRefresh()

  const existing = cmsBlocks["nav_footer"] as NavFooterContent | undefined

  const [brandSubtitle, setBrandSubtitle] = useState("")
  const [groundStations, setGroundStations] = useState("")
  const [footerCopyright, setFooterCopyright] = useState("")
  const [footerQuickLinks, setFooterQuickLinks] = useState("")

  useEffect(() => {
    setBrandSubtitle(existing?.brandSubtitle ?? "ISRO Ground Network")
    setGroundStations(existing?.groundStations ?? "BLR, MOX, SHAR, PBL, MAU, BLR-IDSN")
    setFooterCopyright(existing?.footerCopyright ?? "Indian Space Research Organisation (ISRO). ISTRAC - Telemetry, Tracking & Command Network")
    setFooterQuickLinks(existing?.footerQuickLinks ?? "Mission Overview,File Repositories,Passes & Events,Departments")
  }, [existing])

  function handleSave() {
    updateBlock.mutate(
      {
        blockKey: "nav_footer",
        content: { brandSubtitle, groundStations, footerCopyright, footerQuickLinks },
      },
      {
        onSuccess: () => { addToast({ message: "Navbar & Footer content updated", variant: "success" }); triggerRefresh() },
        onError: () => { addToast({ message: "Failed to save nav/footer", variant: "error" }) },
      },
    )
  }

  const stationList = groundStations.split(",").map((s) => s.trim()).filter(Boolean)
  const quickLinkList = footerQuickLinks.split(",").map((s) => s.trim()).filter(Boolean)

  return (
    <Panel title="Navbar & Footer Customizer" meta="block:nav_footer">
      <div className="space-y-6">
        {/* Navbar Section */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-accent-light border-b border-border-subtle pb-2 flex items-center gap-1.5">
            <Layers size={12} />
            Navbar Brand
          </h3>

          <Input
            id="brand-subtitle"
            label="Brand Subtitle (shown below ISTRAC-SIMS logo)"
            value={brandSubtitle}
            onChange={(e) => setBrandSubtitle(e.target.value)}
            placeholder="e.g. ISRO Ground Network"
          />

          <div className="p-3 rounded-lg border border-border-subtle bg-[#060c18] space-y-1">
            <div className="text-[9px] uppercase tracking-widest text-text-dim mb-2">Navbar Preview</div>
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded bg-accent/20 flex items-center justify-center shrink-0">
                <span className="text-[8px] font-bold text-accent-light">IS</span>
              </div>
              <div>
                <div className="text-xs font-bold text-white">ISTRAC-SIMS</div>
                <div className="text-[10px] text-text-dim">{brandSubtitle || "ISRO Ground Network"}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Section */}
        <div className="space-y-4 border-t border-border-subtle pt-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-accent-light border-b border-border-subtle pb-2 flex items-center gap-1.5">
            <MapPin size={12} />
            Footer Content
          </h3>

          <div>
            <Input
              id="ground-stations"
              label="Ground Station List (comma-separated)"
              value={groundStations}
              onChange={(e) => setGroundStations(e.target.value)}
              placeholder="BLR, MOX, SHAR, PBL, MAU, BLR-IDSN"
              hint="Each item displays as a station badge in the footer."
            />
            {stationList.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {stationList.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1 rounded-full border border-border-default bg-surface px-2 py-0.5 text-[10px] font-mono font-semibold text-text-secondary"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-nominal" />
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>

          <Textarea
            id="footer-copyright"
            label="Footer Copyright Text"
            rows={2}
            value={footerCopyright}
            onChange={(e) => setFooterCopyright(e.target.value)}
            placeholder="Indian Space Research Organisation (ISRO). ISTRAC - Telemetry, Tracking & Command Network"
          />

          <div>
            <Input
              id="footer-quick-links"
              label="Footer Quick Links (comma-separated labels)"
              value={footerQuickLinks}
              onChange={(e) => setFooterQuickLinks(e.target.value)}
              placeholder="Mission Overview,File Repositories,Passes & Events,Departments"
              hint="These labels appear in the footer quick links column."
            />
            {quickLinkList.length > 0 && (
              <div className="mt-2 space-y-1">
                {quickLinkList.map((link) => (
                  <div key={link} className="flex items-center gap-1.5 text-[10px] text-text-dim">
                    <span className="text-accent-light">›</span>
                    {link}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <SaveBar onSave={handleSave} isPending={updateBlock.isPending} />
      </div>
    </Panel>
  )
}
