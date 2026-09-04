import { useEffect, useState } from "react"
import { Plus, Trash2, Image as ImageIcon, ToggleLeft, ToggleRight, LogIn, UserPlus, Search, LayoutDashboard, ArrowRight } from "lucide-react"
import { useCms, DEFAULT_CMS_BLOCKS } from "../../context/cmsContext"
import { usePreviewRefresh } from "../../context/PreviewRefreshContext"
import { useUpdateCmsBlock } from "../../hooks/useUpdateCmsBlock"
import { useToastStore } from "../../store/toastStore"
import { Input, Panel, Button } from ".."
import { SaveBar } from "./SaveBar"
import { isSafeUrl } from "../../lib/sanitize"

interface HeroSlide {
  url: string
  caption?: string
  alt?: string
}

interface HeroContent {
  title?: string
  subtitle?: string
  ctaText?: string
  badgeText?: string
  imageUrl?: string
  imageAlt?: string
  slides?: HeroSlide[]
  showLoginBtn?: boolean
  showRegisterBtn?: boolean
  showSearchBtn?: boolean
  showDashboardBtn?: boolean
  showFileRepoBtn?: boolean
  showBadge?: boolean
  carouselAutoplay?: boolean
  carouselIntervalMs?: number
}

const DEFAULT_HERO = (DEFAULT_CMS_BLOCKS["hero"] as unknown as HeroContent) || {}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      className={`flex items-center justify-between gap-3 p-3 rounded-lg border transition-all cursor-pointer select-none ${
        checked ? "border-nominal/40 bg-nominal/[0.06]" : "border-border-subtle bg-surface/50 hover:border-border-default"
      }`}
      onClick={() => onChange(!checked)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onChange(!checked) } }}
    >
      <div className="min-w-0 pointer-events-none">
        <div className="text-xs font-semibold text-text-primary">{label}</div>
        {hint && <div className="text-[10px] text-text-dim mt-0.5">{hint}</div>}
      </div>
      <div className={`shrink-0 pointer-events-none transition-colors ${checked ? "text-nominal" : "text-text-dim"}`}>
        {checked ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
      </div>
    </div>
  )
}

export function HeroTab() {
  const { cmsBlocks } = useCms()
  const updateBlock = useUpdateCmsBlock()
  const addToast = useToastStore((s) => s.addToast)
  const { triggerRefresh } = usePreviewRefresh()

  const existing = (cmsBlocks["hero"] as HeroContent | undefined) || DEFAULT_HERO

  // Text fields
  const [title, setTitle] = useState(existing.title ?? DEFAULT_HERO.title ?? "")
  const [subtitle, setSubtitle] = useState(existing.subtitle ?? DEFAULT_HERO.subtitle ?? "")
  const [ctaText, setCtaText] = useState(existing.ctaText ?? DEFAULT_HERO.ctaText ?? "Log In")
  const [badgeText, setBadgeText] = useState(existing.badgeText ?? DEFAULT_HERO.badgeText ?? "")

  // Visibility toggles
  const [showBadge, setShowBadge] = useState(existing.showBadge ?? true)
  const [showLoginBtn, setShowLoginBtn] = useState(existing.showLoginBtn ?? true)
  const [showRegisterBtn, setShowRegisterBtn] = useState(existing.showRegisterBtn ?? true)
  const [showSearchBtn, setShowSearchBtn] = useState(existing.showSearchBtn ?? true)
  const [showDashboardBtn, setShowDashboardBtn] = useState(existing.showDashboardBtn ?? true)
  const [showFileRepoBtn, setShowFileRepoBtn] = useState(existing.showFileRepoBtn ?? true)

  // Carousel
  const [slides, setSlides] = useState<HeroSlide[]>(existing.slides ?? DEFAULT_HERO.slides ?? [])
  const [carouselAutoplay, setCarouselAutoplay] = useState(existing.carouselAutoplay ?? true)
  const [carouselIntervalMs, setCarouselIntervalMs] = useState(existing.carouselIntervalMs ?? 4500)

  // Collapsed sections
  const [buttonsExpanded, setButtonsExpanded] = useState(true)
  const [slidesExpanded, setSlidesExpanded] = useState(true)

  // Sync only on external change when existing differs
  useEffect(() => {
    if (existing && Object.keys(existing).length > 0) {
      if (existing.title !== undefined) setTitle(existing.title)
      if (existing.subtitle !== undefined) setSubtitle(existing.subtitle)
      if (existing.ctaText !== undefined) setCtaText(existing.ctaText)
      if (existing.badgeText !== undefined) setBadgeText(existing.badgeText)
      if (existing.showBadge !== undefined) setShowBadge(existing.showBadge)
      if (existing.showLoginBtn !== undefined) setShowLoginBtn(existing.showLoginBtn)
      if (existing.showRegisterBtn !== undefined) setShowRegisterBtn(existing.showRegisterBtn)
      if (existing.showSearchBtn !== undefined) setShowSearchBtn(existing.showSearchBtn)
      if (existing.showDashboardBtn !== undefined) setShowDashboardBtn(existing.showDashboardBtn)
      if (existing.showFileRepoBtn !== undefined) setShowFileRepoBtn(existing.showFileRepoBtn)
      if (existing.carouselAutoplay !== undefined) setCarouselAutoplay(existing.carouselAutoplay)
      if (existing.carouselIntervalMs !== undefined) setCarouselIntervalMs(existing.carouselIntervalMs)
      if (existing.slides && existing.slides.length > 0) {
        setSlides(existing.slides)
      }
    }
  }, [cmsBlocks])

  const handleAddSlide = () => setSlides((prev) => [...prev, { url: "", caption: "", alt: "" }])
  const handleRemoveSlide = (i: number) => setSlides((prev) => prev.filter((_, idx) => idx !== i))
  const handleUpdateSlide = (i: number, field: keyof HeroSlide, val: string) =>
    setSlides((prev) => { const n = [...prev]; n[i] = { ...n[i], [field]: val }; return n })

  function handleSave() {
    const validSlides = slides.filter((s) => s.url && s.url.trim().length > 0)
    const primaryImage = validSlides[0]?.url ?? (DEFAULT_HERO.slides?.[0]?.url || "")
    const primaryAlt = validSlides[0]?.caption ?? (DEFAULT_HERO.slides?.[0]?.caption || "")

    updateBlock.mutate(
      {
        blockKey: "hero",
        content: {
          title, subtitle, ctaText, badgeText,
          imageUrl: primaryImage, imageAlt: primaryAlt,
          slides: validSlides,
          showBadge, showLoginBtn, showRegisterBtn, showSearchBtn, showDashboardBtn, showFileRepoBtn,
          carouselAutoplay, carouselIntervalMs,
        },
      },
      {
        onSuccess: () => { addToast({ message: "Hero section updated", variant: "success" }); triggerRefresh() },
        onError: () => { addToast({ message: "Failed to save hero CMS", variant: "error" }) },
      },
    )
  }

  return (
    <Panel title="Hero & Multi-Image Carousel" meta="block:hero">
      <div className="space-y-6">

        {/* ── Section 1: Status Badge ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-1 border-b border-border-subtle">
            <span className="text-[10px] font-bold uppercase tracking-wider text-accent-light">Status Badge</span>
          </div>
          <Toggle
            label="Show Status Badge Pill"
            hint="The green pulsing badge shown above the headline"
            checked={showBadge}
            onChange={setShowBadge}
          />
          {showBadge && (
            <Input
              id="hero-badge"
              label="Badge Text"
              value={badgeText}
              onChange={(e) => setBadgeText(e.target.value)}
              placeholder="e.g. ISTRAC Ground Network Active · 24/7 Mission Operations"
            />
          )}
        </div>

        {/* ── Section 2: Main Text Content ── */}
        <div className="space-y-3 pt-2 border-t border-border-subtle">
          <div className="flex items-center gap-2 pb-1 border-b border-border-subtle">
            <span className="text-[10px] font-bold uppercase tracking-wider text-accent-light">Hero Text Content</span>
          </div>
          <Input
            id="hero-title"
            label="Main Headline"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. ISRO Telemetry, Tracking & Command Network"
          />
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-text-dim mb-1.5">Subtitle / Description</label>
            <textarea
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              rows={4}
              placeholder="The nerve centre for spacecraft operations, deep space tracking..."
              className="w-full rounded-md border border-border-default bg-[#09101f] px-3.5 py-2.5 text-sm text-text-primary outline-none transition-colors duration-150 placeholder:text-text-dim hover:border-border-bright focus:border-accent focus:bg-[#0c162b] resize-y"
            />
          </div>
        </div>

        {/* ── Section 3: Action Buttons ── */}
        <div className="space-y-3 pt-2 border-t border-border-subtle">
          <button
            type="button"
            className="flex w-full items-center justify-between pb-1 border-b border-border-subtle"
            onClick={() => setButtonsExpanded((v) => !v)}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-accent-light">Action Buttons & Toggles</span>
            <span className="text-[10px] text-text-dim">{buttonsExpanded ? "▲ collapse" : "▼ expand"}</span>
          </button>

          {buttonsExpanded && (
            <div className="space-y-4">
              <p className="text-xs text-text-secondary">
                Click any button toggle below to turn it on or off on the live landing page.
              </p>

              {/* Guest buttons */}
              <div className="space-y-2">
                <div className="text-[10px] font-mono uppercase text-accent-light px-0.5">Guest (Logged-Out) Visitors</div>
                <Toggle
                  label="Log In button"
                  hint="Primary CTA for unauthenticated visitors"
                  checked={showLoginBtn}
                  onChange={setShowLoginBtn}
                />
                <Toggle
                  label="Request Access button"
                  hint="Registration button for new accounts"
                  checked={showRegisterBtn}
                  onChange={setShowRegisterBtn}
                />
                <Toggle
                  label="Search Files button"
                  hint="Quick search trigger with Ctrl+K shortcut"
                  checked={showSearchBtn}
                  onChange={setShowSearchBtn}
                />
              </div>

              {/* Authenticated buttons */}
              <div className="space-y-2 pt-2 border-t border-border-subtle">
                <div className="text-[10px] font-mono uppercase text-accent-light px-0.5">Member (Logged-In) Users</div>
                <Toggle
                  label="Go To Dashboard button"
                  hint="Primary CTA for signed-in operators"
                  checked={showDashboardBtn}
                  onChange={setShowDashboardBtn}
                />
                <Toggle
                  label="File Repositories button"
                  hint="Secondary CTA linking to file management"
                  checked={showFileRepoBtn}
                  onChange={setShowFileRepoBtn}
                />
              </div>

              {/* CTA text */}
              <Input
                id="hero-cta"
                label="Log In Button Custom Label"
                value={ctaText}
                onChange={(e) => setCtaText(e.target.value)}
                placeholder="e.g. Enter Mission Portal"
                hint="Changes the text of the primary Log In button"
              />

              {/* Live button preview strip */}
              <div className="p-3 rounded-lg border border-border-subtle bg-[#060c18] space-y-2">
                <div className="text-[9px] uppercase tracking-widest text-text-dim">Active Guest Buttons Preview</div>
                <div className="flex flex-wrap gap-2">
                  {showLoginBtn && (
                    <div className="flex items-center gap-1.5 rounded-lg bg-accent/20 border border-accent/40 px-3 py-1.5 text-xs text-accent-light font-semibold">
                      <LogIn size={13} />{ctaText || "Log In"}<ArrowRight size={12} />
                    </div>
                  )}
                  {showRegisterBtn && (
                    <div className="flex items-center gap-1.5 rounded-lg border border-border-default px-3 py-1.5 text-xs text-text-secondary font-semibold">
                      <UserPlus size={13} />Request Access
                    </div>
                  )}
                  {showSearchBtn && (
                    <div className="flex items-center gap-1.5 rounded-lg border border-border-default bg-surface/80 px-3 py-1.5 text-xs text-text-dim font-semibold">
                      <Search size={13} className="text-accent-light" />Search Files
                    </div>
                  )}
                </div>
                <div className="text-[9px] uppercase tracking-widest text-text-dim mt-2">Active Member Buttons Preview</div>
                <div className="flex flex-wrap gap-2">
                  {showDashboardBtn && (
                    <div className="flex items-center gap-1.5 rounded-lg bg-accent/20 border border-accent/40 px-3 py-1.5 text-xs text-accent-light font-semibold">
                      <LayoutDashboard size={13} />Go To Dashboard<ArrowRight size={12} />
                    </div>
                  )}
                  {showFileRepoBtn && (
                    <div className="flex items-center gap-1.5 rounded-lg border border-border-default px-3 py-1.5 text-xs text-text-secondary font-semibold">
                      File Repositories
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Section 4: Carousel Slides ── */}
        <div className="space-y-3 pt-2 border-t border-border-subtle">
          <button
            type="button"
            className="flex w-full items-center justify-between pb-1 border-b border-border-subtle"
            onClick={() => setSlidesExpanded((v) => !v)}
          >
            <div className="flex items-center gap-2">
              <ImageIcon size={13} className="text-accent-light" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-accent-light">
                Carousel Slides ({slides.length})
              </span>
            </div>
            <span className="text-[10px] text-text-dim">{slidesExpanded ? "▲ collapse" : "▼ expand"}</span>
          </button>

          {slidesExpanded && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Toggle
                  label="Auto-Play Carousel"
                  hint="Auto-cycle through slides"
                  checked={carouselAutoplay}
                  onChange={setCarouselAutoplay}
                />
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-text-dim mb-1.5">
                    Interval (ms)
                  </label>
                  <input
                    type="number"
                    value={carouselIntervalMs}
                    min={1000}
                    max={15000}
                    step={500}
                    onChange={(e) => setCarouselIntervalMs(Number(e.target.value))}
                    disabled={!carouselAutoplay}
                    className="w-full rounded-md border border-border-default bg-[#09101f] px-3 py-2.5 text-xs num text-white outline-none focus:border-accent disabled:opacity-40"
                  />
                </div>
              </div>

              <div className="space-y-3">
                {slides.map((slide, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl border border-border-default bg-[#060c18] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold uppercase text-accent-light bg-accent/10 border border-accent/30 px-2 py-0.5 rounded">
                        Slide #{idx + 1}
                      </span>
                      {slides.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSlide(idx)}
                          className="text-critical hover:text-critical p-1 rounded hover:bg-critical/10 transition-colors"
                          title="Delete this slide"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] text-text-dim mb-1">Image URL *</label>
                      <input
                        type="url"
                        value={slide.url}
                        onChange={(e) => handleUpdateSlide(idx, "url", e.target.value)}
                        placeholder="https://images.unsplash.com/... or /assets/..."
                        className="w-full rounded-md border border-border-default bg-[#09101f] px-3 py-2 text-xs text-white outline-none focus:border-accent font-mono text-[11px]"
                      />
                      {slide.url && isSafeUrl(slide.url) && (
                        <div className="mt-1.5 relative h-16 w-full rounded-md overflow-hidden border border-border-subtle">
                          <img src={slide.url} alt={slide.caption ?? ""} className="h-full w-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                          <span className="absolute bottom-1 left-2 text-[9px] text-white/70 num">preview</span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] text-text-dim mb-1">Slide Caption</label>
                      <input
                        type="text"
                        value={slide.caption ?? ""}
                        onChange={(e) => handleUpdateSlide(idx, "caption", e.target.value)}
                        placeholder="e.g. Indian Deep Space Network 32-Meter Antenna Dish at Byalalu"
                        className="w-full rounded-md border border-border-default bg-[#09101f] px-3 py-2 text-xs text-white outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <Button type="button" variant="outline" size="sm" onClick={handleAddSlide} className="w-full flex items-center gap-1.5">
                <Plus size={13} />
                Add Slide
              </Button>
            </div>
          )}
        </div>

        <SaveBar onSave={handleSave} isPending={updateBlock.isPending} />
      </div>
    </Panel>
  )
}
