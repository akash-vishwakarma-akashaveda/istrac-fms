import { useEffect, useState } from "react"
import { Check, Plus, Trash2, RotateCcw, Image, Sparkles, Building2, ExternalLink } from "lucide-react"
import { useCms } from "../../context/cmsContext"
import { useUpdateCmsBlock } from "../../hooks/useUpdateCmsBlock"
import { useToastStore } from "../../store/toastStore"
import { usePreviewRefresh } from "../../context/PreviewRefreshContext"
import { Input, Panel, Textarea, Button } from ".."
import { SaveBar } from "./SaveBar"

interface AssuranceItem {
  title?: string
  text: string
}

interface InfoBlockContent {
  aboutEyebrow?: string
  aboutTitle?: string
  aboutText?: string
  aboutImageUrl?: string
  aboutImageAlt?: string
  facilityTag?: string
  frequencyTag?: string
  primaryNodeLabel?: string
  primaryNodeLocation?: string
  ctaText?: string
  ctaHref?: string
  assurances?: Array<string | AssuranceItem>
}

const DEFAULT_ASSURANCE_ITEMS: AssuranceItem[] = [
  {
    title: "Access Control",
    text: "Permission-aware departmental access controls (RBAC)",
  },
  {
    title: "Audit Logging",
    text: "Tamper-evident append-only audit activity logging",
  },
  {
    title: "Ground Scoping",
    text: "Multi-ground station satellite scoping (BLR / SHAR / PBL / MAU)",
  },
  {
    title: "Live Downlink",
    text: "Real-time WebSocket telemetry pass notifications",
  },
]

export function InfoTab() {
  const { cmsBlocks } = useCms()
  const info = cmsBlocks["info"] as InfoBlockContent | undefined
  const navHeader = cmsBlocks["nav_header"] as Record<string, any> | undefined
  const brandTitle = navHeader?.brandTitle || "ISTRAC"
  const brandHighlight = navHeader?.brandHighlight !== undefined ? navHeader.brandHighlight : "-SIMS"

  const updateBlock = useUpdateCmsBlock()
  const addToast = useToastStore((s) => s.addToast)
  const { triggerRefresh } = usePreviewRefresh()

  // Headings & Narrative
  const [aboutEyebrow, setAboutEyebrow] = useState("")
  const [aboutTitle, setAboutTitle] = useState("")
  const [aboutText, setAboutText] = useState("")

  // Showcase Media & Station Strip
  const [aboutImageUrl, setAboutImageUrl] = useState("")
  const [aboutImageAlt, setAboutImageAlt] = useState("")
  const [facilityTag, setFacilityTag] = useState("")
  const [frequencyTag, setFrequencyTag] = useState("")
  const [primaryNodeLabel, setPrimaryNodeLabel] = useState("")
  const [primaryNodeLocation, setPrimaryNodeLocation] = useState("")

  // Four Feature Cards with Ticks (Assurances)
  const [assurances, setAssurances] = useState<AssuranceItem[]>(DEFAULT_ASSURANCE_ITEMS)

  // CTA
  const [ctaText, setCtaText] = useState("")
  const [ctaHref, setCtaHref] = useState("")

  useEffect(() => {
    setAboutEyebrow(info?.aboutEyebrow ?? `About ${brandTitle}${brandHighlight} Telemetry Infrastructure`)
    setAboutTitle(info?.aboutTitle ?? "Information Infrastructure for Deep Space & Earth Observation Missions.")
    setAboutText(info?.aboutText ?? "")
    setAboutImageUrl(info?.aboutImageUrl ?? "")
    setAboutImageAlt(info?.aboutImageAlt ?? "Mission Operations Complex (MOX-2 Bengaluru)")
    setFacilityTag(info?.facilityTag ?? `${brandTitle} HEADQUARTERS`)
    setFrequencyTag(info?.frequencyTag ?? "AOS 2.2 GHz")
    setPrimaryNodeLabel(info?.primaryNodeLabel ?? "PRIMARY CONTROL NODE")
    setPrimaryNodeLocation(info?.primaryNodeLocation ?? "Bengaluru MOX Complex (BLR)")
    setCtaText(info?.ctaText ?? "Contact Mission Support")
    setCtaHref(info?.ctaHref ?? "#contact")

    if (info?.assurances && Array.isArray(info.assurances) && info.assurances.length > 0) {
      const normalized: AssuranceItem[] = info.assurances.map((item) => {
        if (typeof item === "string") {
          return { text: item }
        }
        return {
          title: item.title ?? "",
          text: item.text ?? "",
        }
      })
      setAssurances(normalized)
    } else {
      setAssurances(DEFAULT_ASSURANCE_ITEMS)
    }
  }, [info, brandTitle, brandHighlight])

  function handleAddCard() {
    setAssurances((prev) => [
      ...prev,
      { title: `Highlight #${prev.length + 1}`, text: "" },
    ])
  }

  function handleRemoveCard(index: number) {
    setAssurances((prev) => prev.filter((_, i) => i !== index))
  }

  function handleUpdateCard(index: number, patch: Partial<AssuranceItem>) {
    setAssurances((prev) =>
      prev.map((card, i) => (i === index ? { ...card, ...patch } : card))
    )
  }

  function handleResetCards() {
    setAssurances(DEFAULT_ASSURANCE_ITEMS)
    addToast({ message: "Reset to default 4 assurance cards", variant: "info" })
  }

  async function handleSave() {
    try {
      const cleanAssurances = assurances
        .map((a) => ({
          title: a.title?.trim() || undefined,
          text: a.text.trim(),
        }))
        .filter((a) => a.text.length > 0)

      await Promise.all([
        updateBlock.mutateAsync({
          blockKey: "info",
          content: {
            aboutEyebrow,
            aboutTitle,
            aboutText,
            aboutImageUrl,
            aboutImageAlt,
            facilityTag,
            frequencyTag,
            primaryNodeLabel,
            primaryNodeLocation,
            ctaText,
            ctaHref,
            assurances: cleanAssurances,
          },
        }),
        updateBlock.mutateAsync({
          blockKey: "org_overview",
          content: {
            text: aboutText,
          },
        }),
      ])

      addToast({ message: "About section & 4 tick cards updated successfully", variant: "success" })
      triggerRefresh()
    } catch {
      addToast({ message: "Failed to save about section", variant: "error" })
    }
  }

  return (
    <Panel title="About Section & Verification Cards" meta="block:info">
      <div className="space-y-6">
        {/* Section Intro Badge */}
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-accent/[0.06] border border-accent/20">
          <Sparkles size={16} className="text-accent-light shrink-0 mt-0.5" />
          <p className="text-xs text-text-secondary leading-relaxed">
            Customize the public <strong>About Section</strong>, including the center's mandate, facility media showcase, and the <strong>four cards shown with green verification ticks</strong>.
          </p>
        </div>

        {/* 1. Header & Text Narrative */}
        <div className="space-y-4 rounded-xl border border-border-default bg-[#070d1a] p-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-text-dim flex items-center gap-1.5">
            <Building2 size={13} className="text-accent-light" />
            Headline & Narrative
          </h4>

          <Input
            id="about-eyebrow"
            label="Section Eyebrow"
            value={aboutEyebrow}
            onChange={(e) => setAboutEyebrow(e.target.value)}
            placeholder={`About ${brandTitle}${brandHighlight} Telemetry Infrastructure`}
            hint="Appears in accent text above the main headline."
          />

          <Input
            id="about-title"
            label="Section Main Headline"
            value={aboutTitle}
            onChange={(e) => setAboutTitle(e.target.value)}
            placeholder="e.g. Information Infrastructure for Deep Space & Earth Observation Missions."
          />

          <Textarea
            id="about-text"
            label="Organization Overview & Mandate"
            rows={4}
            value={aboutText}
            onChange={(e) => setAboutText(e.target.value)}
            placeholder="Enter mission background, mandate, and organizational responsibilities..."
            hint="Displayed as the primary narrative paragraph in the About section."
          />
        </div>

        {/* 2. THE FOUR CARDS SHOWN WITH TICKS (ASSURANCES) */}
        <div className="space-y-4 rounded-xl border border-border-default bg-[#070d1a] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle pb-3">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-text-dim flex items-center gap-1.5">
                <Check size={14} className="text-nominal" strokeWidth={3} />
                Feature Cards with Ticks ({assurances.length} Active)
              </h4>
              <p className="text-[11px] text-text-dim mt-0.5">
                These cards display in a 2x2 grid with green tick marks beside the center overview.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetCards}
                className="text-[11px] h-7 px-2.5 text-text-dim hover:text-white"
                title="Reset to default 4 assurance cards"
              >
                <RotateCcw size={12} className="mr-1" />
                Reset Defaults
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleAddCard}
                className="text-[11px] h-7 px-2.5"
              >
                <Plus size={12} className="mr-1" />
                Add Card
              </Button>
            </div>
          </div>

          {/* List of cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {assurances.map((card, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-border-subtle bg-[#050914] p-3.5 space-y-2.5 relative group hover:border-accent/40 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-nominal/20 border border-nominal/40 text-nominal shadow-sm">
                      <Check size={11} strokeWidth={3} />
                    </div>
                    <span className="text-[10px] font-mono font-bold uppercase text-accent-light">
                      Card #{idx + 1}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveCard(idx)}
                    className="p-1 rounded text-text-dim hover:text-critical hover:bg-critical/10 transition-colors"
                    title="Remove this card"
                    aria-label={`Remove Card #${idx + 1}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <Input
                  id={`card-${idx}-title`}
                  label="Card Header / Badge (Optional)"
                  value={card.title ?? ""}
                  onChange={(e) => handleUpdateCard(idx, { title: e.target.value })}
                  placeholder="e.g. Access Control"
                  className="text-xs"
                />

                <div>
                  <label
                    htmlFor={`card-${idx}-text`}
                    className="block text-[11px] font-semibold text-text-secondary mb-1"
                  >
                    Card Text with Tick <span className="text-critical">*</span>
                  </label>
                  <textarea
                    id={`card-${idx}-text`}
                    rows={2}
                    value={card.text}
                    onChange={(e) => handleUpdateCard(idx, { text: e.target.value })}
                    placeholder="e.g. Permission-aware departmental access controls (RBAC)"
                    className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Visual Mini-Preview of Cards with Ticks */}
          <div className="mt-4 pt-3 border-t border-border-subtle/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-dim block mb-2">
              Preview of Cards with Ticks
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {assurances.map((card, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 rounded-lg border border-border-subtle bg-card/60 p-2.5 text-xs text-text-secondary"
                >
                  <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-nominal/20 text-nominal mt-0.5">
                    <Check size={10} strokeWidth={3} />
                  </div>
                  <div className="min-w-0">
                    {card.title && (
                      <div className="font-bold text-white text-[11px]">{card.title}</div>
                    )}
                    <span className="text-text-muted text-[11px] leading-relaxed">
                      {card.text || <em className="text-text-dim">Empty card text</em>}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 3. Facility Showcase Media & Node Badges */}
        <div className="space-y-4 rounded-xl border border-border-default bg-[#070d1a] p-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-text-dim flex items-center gap-1.5">
            <Image size={13} className="text-accent-light" />
            Showcase Image & Station Tags
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              id="about-image-url"
              label="Facility Image URL"
              value={aboutImageUrl}
              onChange={(e) => setAboutImageUrl(e.target.value)}
              placeholder="https://images.unsplash.com/photo-..."
              className="num text-xs"
              hint="Recommended aspect ratio 4:3."
            />

            <Input
              id="about-image-alt"
              label="Image Caption / Badge Text"
              value={aboutImageAlt}
              onChange={(e) => setAboutImageAlt(e.target.value)}
              placeholder="e.g. Mission Operations Complex (MOX-2 Bengaluru)"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
            <Input
              id="facility-tag"
              label="Top Tag (Image Header)"
              value={facilityTag}
              onChange={(e) => setFacilityTag(e.target.value)}
              placeholder={`${brandTitle} HEADQUARTERS`}
            />

            <Input
              id="frequency-tag"
              label="Telemetry Frequency Tag"
              value={frequencyTag}
              onChange={(e) => setFrequencyTag(e.target.value)}
              placeholder="AOS 2.2 GHz"
            />

            <Input
              id="primary-node-label"
              label="Node Badge Label"
              value={primaryNodeLabel}
              onChange={(e) => setPrimaryNodeLabel(e.target.value)}
              placeholder="PRIMARY CONTROL NODE"
            />

            <Input
              id="primary-node-loc"
              label="Node Location Text"
              value={primaryNodeLocation}
              onChange={(e) => setPrimaryNodeLocation(e.target.value)}
              placeholder="Bengaluru MOX Complex (BLR)"
            />
          </div>
        </div>

        {/* 4. Action CTA */}
        <div className="space-y-3 rounded-xl border border-border-default bg-[#070d1a] p-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-text-dim flex items-center gap-1.5">
            <ExternalLink size={13} className="text-accent-light" />
            Call-to-Action Link
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              id="cta-text"
              label="Button Text"
              value={ctaText}
              onChange={(e) => setCtaText(e.target.value)}
              placeholder="Contact Mission Support"
            />

            <Input
              id="cta-href"
              label="Button Target Link"
              value={ctaHref}
              onChange={(e) => setCtaHref(e.target.value)}
              placeholder="#contact or /login"
            />
          </div>
        </div>

        <SaveBar onSave={handleSave} isPending={updateBlock.isPending} />
      </div>
    </Panel>
  )
}
