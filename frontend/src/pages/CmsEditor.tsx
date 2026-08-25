import { useState } from 'react'
import {
  Sparkles,
  Megaphone,
  FileText,
  Calendar,
  Building2,
  AlertTriangle,
  Info,
  Radio,
  ExternalLink,
} from 'lucide-react'
import { PreviewRefreshProvider } from '../context/PreviewRefreshContext'
import { PageHeader } from '../components'
import { LivePreviewPanel } from '../components/LivePreviewPanel'
import { HeroTab } from '../components/cms-editor/HeroTab'
import { AnnouncementTab } from '../components/cms-editor/AnnouncementTab'
import { ReportsTab } from '../components/cms-editor/ReportsTab'
import { EventsTab } from '../components/cms-editor/EventsTab'
import { DepartmentPagesTab } from '../components/cms-editor/DepartmentPagesTab'
import { BannerTab } from '../components/cms-editor/BannerTab'
import { InfoTab } from '../components/cms-editor/InfoTab'

const TABS = [
  {
    key: 'hero',
    label: 'Hero & Mission Header',
    icon: Sparkles,
    component: HeroTab,
  },
  {
    key: 'announcements',
    label: 'Mission Notice',
    icon: Megaphone,
    component: AnnouncementTab,
  },
  {
    key: 'featured_reports',
    label: 'Featured Datasets',
    icon: FileText,
    component: ReportsTab,
  },
  {
    key: 'calendar_events',
    label: 'Events & Calendar',
    icon: Calendar,
    component: EventsTab,
  },
  {
    key: 'department_pages',
    label: 'Division Portals',
    icon: Building2,
    component: DepartmentPagesTab,
  },
  {
    key: 'banner',
    label: 'Alert Banner',
    icon: AlertTriangle,
    component: BannerTab,
  },
  {
    key: 'info',
    label: 'Facility Info & Support',
    icon: Info,
    component: InfoTab,
  },
] as const

export function CmsEditor() {
  const [activeTab, setActiveTab] =
    useState<(typeof TABS)[number]['key']>('hero')

  const ActiveComponent =
    TABS.find((tab) => tab.key === activeTab)?.component ?? HeroTab

  return (
    <PreviewRefreshProvider>
      <div className="space-y-5 max-w-7xl mx-auto pb-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border-subtle pb-5">
          <PageHeader
            eyebrow="Portal Content Management"
            title="ISTRAC Landing & Mission Portal CMS"
            description="Customize public mission blocks, event calendar, divisional showcase pages, and facility contact info with instant live sync."
          />

          <div className="flex items-center gap-2 shrink-0">
            <span className="flex items-center gap-1.5 rounded-full bg-nominal/15 px-2.5 py-1 text-[11px] font-bold text-nominal border border-nominal/30">
              <Radio size={12} className="animate-pulse" />
              <span>Real-Time Ingest Sync</span>
            </span>

            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-[#0c1424] px-3 py-1.5 text-xs font-semibold text-text-primary hover:border-accent hover:text-white transition-all shadow-sm"
            >
              <span>View Public Portal</span>
              <ExternalLink size={13} />
            </a>
          </div>
        </div>

        {/* Tab Rail with ISRO Accents */}
        <div className="flex gap-1.5 overflow-x-auto border-b border-border-subtle pb-px scrollbar-none">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key
            const Icon = tab.icon

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                aria-pressed={isActive}
                className={`-mb-px shrink-0 flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs font-bold transition-all ${
                  isActive
                    ? 'border-b-accent text-accent-light bg-accent/[0.06] rounded-t-lg'
                    : 'border-b-transparent text-text-dim hover:text-text-primary hover:bg-card-hover rounded-t-lg'
                }`}
              >
                <Icon size={14} className={isActive ? 'text-accent-light' : 'text-text-dim'} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        <div className="grid grid-cols-1 gap-5 lg:h-[calc(100vh-19rem)] lg:grid-cols-2">
          {/* Editor Column */}
          <div className="min-w-0 lg:overflow-y-auto lg:pr-1 space-y-4">
            <ActiveComponent />
          </div>

          {/* Live Preview Column */}
          <div className="min-w-0 rounded-xl border border-border-default bg-[#040810] overflow-hidden shadow-lg">
            <LivePreviewPanel />
          </div>
        </div>
      </div>
    </PreviewRefreshProvider>
  )
}
