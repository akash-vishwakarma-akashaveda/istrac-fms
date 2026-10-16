import { useEffect, useState } from "react"
import { MapPin } from "lucide-react"
import { useCms } from "../../context/cmsContext"
import { usePreviewRefresh } from "../../context/PreviewRefreshContext"
import { useUpdateCmsBlock } from "../../hooks/useUpdateCmsBlock"
import { useToastStore } from "../../store/toastStore"
import { Input, Panel, Textarea } from ".."
import { SaveBar } from "./SaveBar"

export interface FooterBlockContent {
  brandTitle?: string
  brandHighlight?: string
  brandDescription?: string
  groundStations?: string
  copyrightText?: string
  quickLinks?: string
  statusText?: string
  portalBadge?: string
}

export function FooterTab() {
  const { cmsBlocks } = useCms()
  const updateBlock = useUpdateCmsBlock()
  const addToast = useToastStore((s) => s.addToast)
  const { triggerRefresh } = usePreviewRefresh()

  const existing = (cmsBlocks["footer_custom"] as FooterBlockContent | undefined) ||
    (cmsBlocks["nav_footer"] as FooterBlockContent | undefined)

  const [brandTitle, setBrandTitle] = useState("ISRO ·")
  const [brandHighlight, setBrandHighlight] = useState("ISTRAC")
  const [brandDescription, setBrandDescription] = useState(
    "ISRO Telemetry, Tracking and Command Network · Department of Space, Government of India."
  )
  const [groundStations, setGroundStations] = useState("BLR · SHAR · PBL · MAU · BIK · BYALALU")
  const [copyrightText, setCopyrightText] = useState("© 2026 ISTRAC · Indian Space Research Organisation (ISRO).")
  const [quickLinks, setQuickLinks] = useState("Home, Reports, Calendar, Departments, About, Support")
  const [statusText, setStatusText] = useState("24/7 Operations Live")
  const [portalBadge, setPortalBadge] = useState("Official Intranet Portal")

  useEffect(() => {
    if (existing) {
      if (existing.brandTitle !== undefined) setBrandTitle(existing.brandTitle)
      if (existing.brandHighlight !== undefined) setBrandHighlight(existing.brandHighlight)
      if (existing.brandDescription !== undefined) setBrandDescription(existing.brandDescription)
      if (existing.groundStations !== undefined) setGroundStations(existing.groundStations)
      if (existing.copyrightText !== undefined) setCopyrightText(existing.copyrightText)
      if (existing.quickLinks !== undefined) setQuickLinks(existing.quickLinks)
      if (existing.statusText !== undefined) setStatusText(existing.statusText)
      if (existing.portalBadge !== undefined) setPortalBadge(existing.portalBadge)
    }
  }, [existing])

  async function handleSave() {
    try {
      await Promise.all([
        updateBlock.mutateAsync({
          blockKey: "footer_custom",
          content: {
            brandTitle,
            brandHighlight,
            brandDescription,
            groundStations,
            copyrightText,
            quickLinks,
            statusText,
            portalBadge,
          },
        }),
        updateBlock.mutateAsync({
          blockKey: "nav_footer",
          content: {
            ...(cmsBlocks["nav_footer"] as Record<string, unknown> || {}),
            groundStations,
            footerCopyright: copyrightText,
            footerQuickLinks: quickLinks,
          },
        }),
      ])

      addToast({ message: "Footer layout and links updated", variant: "success" })
      triggerRefresh()
    } catch {
      addToast({ message: "Failed to save footer settings", variant: "error" })
    }
  }

  const stationList = groundStations.split(/[,·]/).map((s) => s.trim()).filter(Boolean)
  const linkList = quickLinks.split(",").map((s) => s.trim()).filter(Boolean)

  return (
    <div className="space-y-6">
      {/* Intro strip */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-accent/30 bg-accent/10">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-accent/20 flex items-center justify-center text-accent-light shrink-0">
            <MapPin size={18} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">Footer & Ground Stations Network</h4>
            <p className="text-[11px] text-text-secondary mt-0.5">
              Customize footer colophon, copyright notice, active station codes, status badges, and navigation shortcuts.
            </p>
          </div>
        </div>
      </div>

      {/* BRAND & DESCRIPTION */}
      <Panel title="Footer Brand & Description" meta="block:footer_custom">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              id="foot-brand-title"
              label="Brand Prefix"
              value={brandTitle}
              onChange={(e) => setBrandTitle(e.target.value)}
              placeholder="e.g. ISRO ·"
            />

            <Input
              id="foot-brand-highlight"
              label="Brand Highlight Text"
              value={brandHighlight}
              onChange={(e) => setBrandHighlight(e.target.value)}
              placeholder="e.g. ISTRAC"
              className="text-accent-light font-bold"
            />
          </div>

          <Textarea
            id="foot-desc"
            label="Organization & Government Subtitle"
            rows={2}
            value={brandDescription}
            onChange={(e) => setBrandDescription(e.target.value)}
            placeholder="ISRO Telemetry, Tracking and Command Network · Department of Space..."
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <Input
              id="foot-status"
              label="Operations Status Label"
              value={statusText}
              onChange={(e) => setStatusText(e.target.value)}
              placeholder="24/7 Operations Live"
            />

            <Input
              id="foot-badge"
              label="Portal Security Badge"
              value={portalBadge}
              onChange={(e) => setPortalBadge(e.target.value)}
              placeholder="Official Intranet Portal"
            />
          </div>
        </div>
      </Panel>

      {/* STATIONS & COPYRIGHT */}
      <Panel title="Ground Stations, Links & Copyright" meta="block:footer_custom">
        <div className="space-y-4">
          <div>
            <Input
              id="foot-stations"
              label="Ground Stations (separated by · or commas)"
              value={groundStations}
              onChange={(e) => setGroundStations(e.target.value)}
              placeholder="BLR · SHAR · PBL · MAU · BIK · BYALALU"
            />
            {stationList.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {stationList.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1 rounded-md border border-border-default bg-[#060c18] px-2 py-0.5 text-[10px] font-mono font-semibold text-text-secondary"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-nominal" />
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>

          <Input
            id="foot-links"
            label="Quick Link Labels (comma-separated)"
            value={quickLinks}
            onChange={(e) => setQuickLinks(e.target.value)}
            placeholder="Home, Reports, Calendar, Departments, About, Support"
          />

          {linkList.length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs text-text-muted">
              {linkList.map((l) => (
                <span key={l} className="rounded bg-surface px-2 py-0.5 border border-border-subtle text-[11px]">
                  {l}
                </span>
              ))}
            </div>
          )}

          <Textarea
            id="foot-copy"
            label="Copyright Text"
            rows={2}
            value={copyrightText}
            onChange={(e) => setCopyrightText(e.target.value)}
            placeholder="© 2026 ISTRAC · Indian Space Research Organisation (ISRO)."
          />

          <SaveBar onSave={handleSave} isPending={updateBlock.isPending} />
        </div>
      </Panel>
    </div>
  )
}
