import { useEffect, useState } from "react"
import { Compass } from "lucide-react"
import { useCms } from "../../context/cmsContext"
import { usePreviewRefresh } from "../../context/PreviewRefreshContext"
import { useUpdateCmsBlock } from "../../hooks/useUpdateCmsBlock"
import { useToastStore } from "../../store/toastStore"
import { Input, Panel } from ".."
import { SaveBar } from "./SaveBar"

export interface NavBlockContent {
  brandTitle?: string
  brandHighlight?: string
  brandSubtitle?: string
  homeLabel?: string
  departmentsLabel?: string
  calendarLabel?: string
  aboutLabel?: string
  contactLabel?: string
  showSearchButton?: boolean
  showAuthButton?: boolean
}

export function NavTab() {
  const { cmsBlocks } = useCms()
  const updateBlock = useUpdateCmsBlock()
  const addToast = useToastStore((s) => s.addToast)
  const { triggerRefresh } = usePreviewRefresh()

  const existingNav = (cmsBlocks["nav_header"] as NavBlockContent | undefined) ||
    (cmsBlocks["nav_footer"] as NavBlockContent | undefined)

  const [brandTitle, setBrandTitle] = useState("ISTRAC")
  const [brandHighlight, setBrandHighlight] = useState("-SIMS")
  const [brandSubtitle, setBrandSubtitle] = useState("ISRO Ground Network")
  const [homeLabel, setHomeLabel] = useState("Home")
  const [departmentsLabel, setDepartmentsLabel] = useState("Departments")
  const [calendarLabel, setCalendarLabel] = useState("Calendar & Passes")
  const [aboutLabel, setAboutLabel] = useState("About")
  const [contactLabel, setContactLabel] = useState("Contact")
  const [showSearchButton, setShowSearchButton] = useState(true)
  const [showAuthButton, setShowAuthButton] = useState(true)

  useEffect(() => {
    if (existingNav) {
      if (existingNav.brandTitle !== undefined) setBrandTitle(existingNav.brandTitle)
      if (existingNav.brandHighlight !== undefined) setBrandHighlight(existingNav.brandHighlight)
      if (existingNav.brandSubtitle !== undefined) setBrandSubtitle(existingNav.brandSubtitle)
      if (existingNav.homeLabel !== undefined) setHomeLabel(existingNav.homeLabel)
      if (existingNav.departmentsLabel !== undefined) setDepartmentsLabel(existingNav.departmentsLabel)
      if (existingNav.calendarLabel !== undefined) setCalendarLabel(existingNav.calendarLabel)
      if (existingNav.aboutLabel !== undefined) setAboutLabel(existingNav.aboutLabel)
      if (existingNav.contactLabel !== undefined) setContactLabel(existingNav.contactLabel)
      if (existingNav.showSearchButton !== undefined) setShowSearchButton(existingNav.showSearchButton)
      if (existingNav.showAuthButton !== undefined) setShowAuthButton(existingNav.showAuthButton)
    }
  }, [existingNav])

  async function handleSave() {
    try {
      await Promise.all([
        updateBlock.mutateAsync({
          blockKey: "nav_header",
          content: {
            brandTitle,
            brandHighlight,
            brandSubtitle,
            homeLabel,
            departmentsLabel,
            calendarLabel,
            aboutLabel,
            contactLabel,
            showSearchButton,
            showAuthButton,
          },
        }),
        updateBlock.mutateAsync({
          blockKey: "nav_footer",
          content: {
            ...(cmsBlocks["nav_footer"] as Record<string, unknown> || {}),
            brandSubtitle,
          },
        }),
      ])

      addToast({ message: "Navbar header configuration updated", variant: "success" })
      triggerRefresh()
    } catch {
      addToast({ message: "Failed to save navbar settings", variant: "error" })
    }
  }

  return (
    <div className="space-y-6">
      {/* Intro strip */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-accent/30 bg-accent/10">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-accent/20 flex items-center justify-center text-accent-light shrink-0">
            <Compass size={18} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">Header & Top Navigation Bar</h4>
            <p className="text-[11px] text-text-secondary mt-0.5">
              Customize portal logo branding, subtitles, navigation menu labels, and quick action buttons.
            </p>
          </div>
        </div>
      </div>

      {/* BRANDING SECTION */}
      <Panel title="Brand Identity & Subtitle" meta="block:nav_header">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              id="brand-title"
              label="Brand Logo Text"
              value={brandTitle}
              onChange={(e) => setBrandTitle(e.target.value)}
              placeholder="e.g. ISTRAC"
            />

            <Input
              id="brand-highlight"
              label="Brand Suffix Highlight"
              value={brandHighlight}
              onChange={(e) => setBrandHighlight(e.target.value)}
              placeholder="e.g. -SIMS"
              className="text-accent-light font-bold"
            />
          </div>

          <Input
            id="brand-sub"
            label="Brand Subtitle (under logo)"
            value={brandSubtitle}
            onChange={(e) => setBrandSubtitle(e.target.value)}
            placeholder="e.g. ISRO Ground Network"
          />

          {/* Live mini brand preview */}
          <div className="p-3.5 rounded-xl border border-border-default bg-[#060c18] space-y-1.5">
            <div className="text-[9px] uppercase tracking-widest text-text-dim">Brand Logo Preview</div>
            <div className="flex items-center gap-3">
              <img src="/logo/isro_logo.svg" alt="ISRO" className="h-9 w-auto object-contain" />
              <div>
                <div className="text-sm font-bold uppercase tracking-wider text-white">
                  {brandTitle}<span className="text-accent-light">{brandHighlight}</span>
                </div>
                <div className="text-[10px] text-text-dim tracking-widest uppercase">
                  {brandSubtitle || "ISRO Ground Network"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Panel>

      {/* NAVIGATION MENU LABELS */}
      <Panel title="Menu Links & Labels" meta="block:nav_header">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              id="nav-home"
              label="Home Link Label"
              value={homeLabel}
              onChange={(e) => setHomeLabel(e.target.value)}
              placeholder="Home"
            />

            <Input
              id="nav-depts"
              label="Departments Dropdown Label"
              value={departmentsLabel}
              onChange={(e) => setDepartmentsLabel(e.target.value)}
              placeholder="Departments"
            />

            <Input
              id="nav-cal"
              label="Calendar Link Label"
              value={calendarLabel}
              onChange={(e) => setCalendarLabel(e.target.value)}
              placeholder="Calendar & Passes"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              id="nav-about"
              label="About Link Label"
              value={aboutLabel}
              onChange={(e) => setAboutLabel(e.target.value)}
              placeholder="About"
            />

            <Input
              id="nav-contact"
              label="Contact Link Label"
              value={contactLabel}
              onChange={(e) => setContactLabel(e.target.value)}
              placeholder="Contact"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div
              className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                showSearchButton
                  ? "border-nominal/40 bg-nominal/[0.06]"
                  : "border-border-subtle bg-surface/50 text-text-dim"
              }`}
              onClick={() => setShowSearchButton(!showSearchButton)}
            >
              <div>
                <div className="text-xs font-semibold text-text-primary">Show Quick Search (Ctrl+K)</div>
                <div className="text-[10px] text-text-dim mt-0.5">Displays omni-search trigger icon</div>
              </div>
              <input
                type="checkbox"
                checked={showSearchButton}
                onChange={() => {}}
                className="h-4 w-4 accent-nominal pointer-events-none"
              />
            </div>

            <div
              className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                showAuthButton
                  ? "border-nominal/40 bg-nominal/[0.06]"
                  : "border-border-subtle bg-surface/50 text-text-dim"
              }`}
              onClick={() => setShowAuthButton(!showAuthButton)}
            >
              <div>
                <div className="text-xs font-semibold text-text-primary">Show Portal Login / Access CTA</div>
                <div className="text-[10px] text-text-dim mt-0.5">Displays Login / Console button</div>
              </div>
              <input
                type="checkbox"
                checked={showAuthButton}
                onChange={() => {}}
                className="h-4 w-4 accent-nominal pointer-events-none"
              />
            </div>
          </div>

          <SaveBar onSave={handleSave} isPending={updateBlock.isPending} />
        </div>
      </Panel>
    </div>
  )
}
