import { useState } from "react"
import {
  Sparkles, FileText, Calendar, Building2,
  Headphones, Info, Radio, ExternalLink, BarChart3, Compass, MapPin, RefreshCw,
} from "lucide-react"
import { PreviewRefreshProvider, usePreviewRefresh } from "../context/PreviewRefreshContext"
import { LivePreviewPanel } from "../components/LivePreviewPanel"
import { HeroTab } from "../components/cms-editor/HeroTab"
import { ReportsTab } from "../components/cms-editor/ReportsTab"
import { EventsTab } from "../components/cms-editor/EventsTab"
import { DepartmentPagesTab } from "../components/cms-editor/DepartmentPagesTab"
import { ContactTab } from "../components/cms-editor/ContactTab"
import { InfoTab } from "../components/cms-editor/InfoTab"
import { QuickStatsTab } from "../components/cms-editor/QuickStatsTab"
import { NavTab } from "../components/cms-editor/NavTab"
import { FooterTab } from "../components/cms-editor/FooterTab"

const TABS = [
  {
    key: "nav",
    label: "Header & Navbar",
    shortLabel: "Navbar",
    icon: Compass,
    component: NavTab,
    section: "global" as const,
    description: "Brand logo text, subtitle, menu link titles, and quick action CTAs",
  },
  {
    key: "hero",
    label: "Hero & Carousel",
    shortLabel: "Hero",
    icon: Sparkles,
    component: HeroTab,
    section: "landing" as const,
    description: "Main headline, subtitle, CTA buttons, and rotating image carousel slides",
  },
  {
    key: "quick_stats",
    label: "Quick Stats",
    shortLabel: "Stats",
    icon: BarChart3,
    component: QuickStatsTab,
    section: "landing" as const,
    description: "Four highlighted statistics strip shown below the hero section",
  },
  {
    key: "featured_reports",
    label: "Featured Files",
    shortLabel: "Featured Files",
    icon: FileText,
    component: ReportsTab,
    section: "landing" as const,
    description: "Curated mission files and repository highlights for the public portal",
  },
  {
    key: "calendar_events",
    label: "Events & Calendar",
    shortLabel: "Calendar",
    icon: Calendar,
    component: EventsTab,
    section: "landing" as const,
    description: "Mission events, passes, maintenance windows, and operational milestones",
  },
  {
    key: "department_pages",
    label: "Division Portals",
    shortLabel: "Divisions",
    icon: Building2,
    component: DepartmentPagesTab,
    section: "landing" as const,
    description: "Custom content for each departmental showcase page (TTC, FDD, MOX, etc.)",
  },
  {
    key: "about",
    label: "About Center",
    shortLabel: "About",
    icon: Info,
    component: InfoTab,
    section: "landing" as const,
    description: "About ISTRAC mandate, organization overview, and ground complex image",
  },
  {
    key: "contact_info",
    label: "Contact & Support",
    shortLabel: "Contact",
    icon: Headphones,
    component: ContactTab,
    section: "landing" as const,
    description: "Helpdesk support email, EPABX hotline, facility location, and mission desk badge",
  },
  {
    key: "footer",
    label: "Footer & Stations",
    shortLabel: "Footer",
    icon: MapPin,
    component: FooterTab,
    section: "global" as const,
    description: "Brand subtitle, copyright colophon, ground stations, and quick links",
  },
] as const

type TabKey = (typeof TABS)[number]["key"]

function TabButton({
  tab,
  isActive,
  onClick,
}: {
  tab: (typeof TABS)[number]
  isActive: boolean
  onClick: () => void
}) {
  const Icon = tab.icon
  return (
    <button
      type="button"
      onClick={onClick}
      aria-selected={isActive}
      className={`group relative flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-150 cursor-pointer ${
        isActive
          ? "bg-accent/15 text-accent-light border border-accent/40 shadow-sm"
          : "text-text-secondary hover:bg-card-hover hover:text-text-primary border border-transparent"
      }`}
    >
      <Icon
        size={14}
        className={isActive ? "text-accent-light" : "text-text-dim group-hover:text-text-secondary"}
      />
      <span>{tab.shortLabel}</span>
      {isActive && (
        <span className="absolute -bottom-px left-3 right-3 h-0.5 rounded-full bg-accent" />
      )}
    </button>
  )
}

function CmsEditorInner() {
  const [activeTab, setActiveTab] = useState<TabKey>("hero")
  const { triggerRefresh, scrollToSection } = usePreviewRefresh()

  const currentTab = TABS.find((t) => t.key === activeTab) ?? TABS[0]
  const TabComponent = currentTab.component

  const handleTabChange = (key: TabKey) => {
    setActiveTab(key)
    scrollToSection(key)
  }

  return (
    <div className="w-full space-y-5 pb-16">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border-subtle pb-5">
        <div>
          <div className="eyebrow flex items-center gap-2 text-accent-light">
            <Radio size={12} className="animate-pulse" />
            <span>PORTAL CONTENT MANAGEMENT</span>
          </div>
          <h1 className="display text-2xl font-bold tracking-tight text-text-primary mt-1">
            ISTRAC Landing & Mission Portal CMS
          </h1>
        </div>

        {/* Live sync badge & Quick Action Buttons */}
        <div className="flex items-center gap-2.5">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-nominal/40 bg-nominal/10 px-3 py-1 text-xs font-mono font-medium text-nominal">
            <span className="h-2 w-2 rounded-full bg-nominal animate-pulse" />
            <span>Real-Time Sync</span>
          </div>

          <button
            type="button"
            onClick={triggerRefresh}
            title="Force refresh preview frame"
            className="flex items-center gap-1.5 rounded-lg border border-border-default bg-card px-2.5 py-1.5 text-xs text-text-secondary hover:border-accent hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw size={13} />
          </button>

          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-border-default bg-card px-3.5 py-1.5 text-xs font-semibold text-text-primary hover:border-accent hover:text-accent-light transition-colors"
          >
            <span>View Public Portal</span>
            <ExternalLink size={13} />
          </a>
        </div>
      </div>

      {/* Tabs Navigation Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-default bg-surface/80 p-1.5 backdrop-blur-sm">
        {/* Landing Section Tabs */}
        <div className="flex flex-wrap items-center gap-1">
          <span className="px-2 text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Sections
          </span>
          {TABS.filter((t) => t.section === "landing").map((tab) => (
            <TabButton
              key={tab.key}
              tab={tab}
              isActive={activeTab === tab.key}
              onClick={() => handleTabChange(tab.key)}
            />
          ))}
        </div>

        {/* Global/Layout Content Tabs */}
        <div className="flex flex-wrap items-center gap-1 border-t sm:border-t-0 sm:border-l border-border-subtle pt-1.5 sm:pt-0 sm:pl-3">
          <span className="px-2 text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Shell
          </span>
          {TABS.filter((t) => t.section === "global").map((tab) => (
            <TabButton
              key={tab.key}
              tab={tab}
              isActive={activeTab === tab.key}
              onClick={() => handleTabChange(tab.key)}
            />
          ))}
        </div>
      </div>

      {/* Active Tab Subheader Description */}
      <div className="flex items-center gap-2 px-1 text-xs text-text-secondary">
        <currentTab.icon size={13} className="text-accent-light" />
        <span className="font-semibold text-text-primary">{currentTab.label}</span>
        <span className="text-text-dim">·</span>
        <span className="font-mono text-[10px] text-accent-light bg-accent/10 px-1.5 py-0.5 rounded border border-accent/20">
          block:{currentTab.key}
        </span>
        <span className="text-text-dim">·</span>
        <span className="text-text-dim text-[11px]">{currentTab.description}</span>
      </div>

      {/* Split-Screen Workspace: Editor Form (Left) + Live Landing Preview (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column: Active Tab Editor Form */}
        <div className="xl:col-span-6 space-y-4">
          <TabComponent />
        </div>

        {/* Right Column: Interactive Live Preview Frame */}
        <div className="xl:col-span-6 sticky top-20">
          <LivePreviewPanel />
        </div>
      </div>

      {/* Footer Status Strip */}
      <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface/50 px-4 py-2 text-[11px] text-text-dim">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-nominal" />
          <span>Live WebSocket sync active</span>
          <span>·</span>
          <span>Changes publish instantly to the public landing portal</span>
        </div>
        <div className="num font-mono text-[10px]">31 Aug 2026 UTC</div>
      </div>
    </div>
  )
}

export function CmsEditor() {
  return (
    <PreviewRefreshProvider>
      <CmsEditorInner />
    </PreviewRefreshProvider>
  )
}
