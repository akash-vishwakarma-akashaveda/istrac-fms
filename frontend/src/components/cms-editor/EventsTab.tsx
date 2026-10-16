import { useEffect, useState } from "react"
import {
  Calendar,
  LayoutGrid,
  List,
  Columns,
  ExternalLink,
  CheckCircle2,
} from "lucide-react"
import { Link } from "react-router-dom"
import { useCms } from "../../context/cmsContext"
import { usePreviewRefresh } from "../../context/PreviewRefreshContext"
import { useUpdateCmsBlock } from "../../hooks/useUpdateCmsBlock"
import { useToastStore } from "../../store/toastStore"
import { Input, Panel } from ".."
import { SaveBar } from "./SaveBar"

export type CalendarLayoutMode = "dual_month" | "month_agenda" | "timeline_list"

interface CalendarCmsConfig {
  title?: string
  subtitle?: string
  layoutMode?: CalendarLayoutMode
  showLegend?: boolean
  showQuickStats?: boolean
  maxEventsShown?: number
}

const LAYOUT_OPTIONS: {
  id: CalendarLayoutMode
  name: string
  badge: string
  description: string
  icon: typeof Calendar
}[] = [
  {
    id: "dual_month",
    name: "Dual Month Mission Calendar",
    badge: "Interactive Grid",
    description: "Two-month side-by-side interactive radar calendar with date dots, badges, and detailed click modal.",
    icon: Columns,
  },
  {
    id: "month_agenda",
    name: "Month Grid + Live Agenda",
    badge: "Hybrid Split",
    description: "Full calendar on the left side with an upcoming events timeline list pinned on the right side.",
    icon: LayoutGrid,
  },
  {
    id: "timeline_list",
    name: "Timeline & Operational Passes",
    badge: "Chronological Feed",
    description: "Clean chronological passes, maneuvers, and maintenance windows grouped by time and urgency.",
    icon: List,
  },
]

export function EventsTab() {
  const { cmsBlocks } = useCms()
  const updateBlock = useUpdateCmsBlock()
  const addToast = useToastStore((s) => s.addToast)
  const { triggerRefresh } = usePreviewRefresh()

  const existing = cmsBlocks["calendar_events"] as CalendarCmsConfig | undefined

  const [title, setTitle] = useState("Upcoming Events & Mission Calendar")
  const [subtitle, setSubtitle] = useState("Live passes, orbit maneuvers, ground station maintenance, and telemetry acquisition windows.")
  const [layoutMode, setLayoutMode] = useState<CalendarLayoutMode>("dual_month")
  const [showLegend, setShowLegend] = useState(true)
  const [showQuickStats, setShowQuickStats] = useState(true)

  useEffect(() => {
    if (existing) {
      if (existing.title) setTitle(existing.title)
      if (existing.subtitle) setSubtitle(existing.subtitle)
      if (existing.layoutMode) setLayoutMode(existing.layoutMode)
      if (existing.showLegend !== undefined) setShowLegend(existing.showLegend)
      if (existing.showQuickStats !== undefined) setShowQuickStats(existing.showQuickStats)
    }
  }, [existing])

  function handleSave() {
    updateBlock.mutate(
      {
        blockKey: "calendar_events",
        content: {
          title,
          subtitle,
          layoutMode,
          showLegend,
          showQuickStats,
        },
      },
      {
        onSuccess: () => {
          addToast({ message: "Events & Calendar layout updated", variant: "success" })
          triggerRefresh()
        },
        onError: () => {
          addToast({ message: "Failed to save calendar configuration", variant: "error" })
        },
      }
    )
  }

  return (
    <div className="space-y-6">
      {/* DIRECT LINK TO EVENTS & CALENDAR MANAGEMENT */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-accent/30 bg-accent/10">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-accent/20 flex items-center justify-center text-accent-light shrink-0">
            <Calendar size={18} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">Events Automated from Mission Database</h4>
            <p className="text-[11px] text-text-secondary mt-0.5">
              Passes, launches, and maneuvers are created & managed in the <strong>Events & Calendar</strong> management page.
            </p>
          </div>
        </div>
        <Link
          to="/admin/events"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-accent bg-accent text-white text-xs font-semibold hover:bg-accent-hover transition-colors shadow-sm shrink-0"
        >
          <span>Manage Events</span>
          <ExternalLink size={12} />
        </Link>
      </div>

      {/* SECTION 1: LAYOUT MODE SELECTION */}
      <Panel
        title="Calendar Display Layout Presets"
        meta={`Active: ${LAYOUT_OPTIONS.find((o) => o.id === layoutMode)?.name}`}
      >
        <div className="space-y-4">
          <p className="text-xs text-text-secondary">
            Choose how mission events and tracking passes should be presented on the public landing page:
          </p>

          <div className="grid grid-cols-1 gap-3">
            {LAYOUT_OPTIONS.map((opt) => {
              const Icon = opt.icon
              const isSelected = layoutMode === opt.id

              return (
                <div
                  key={opt.id}
                  onClick={() => setLayoutMode(opt.id)}
                  className={`flex items-start gap-3.5 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? "border-accent bg-accent/10 text-white shadow-md shadow-accent/10"
                      : "border-border-subtle bg-[#060c18] hover:border-border-default hover:bg-card-hover text-text-secondary"
                  }`}
                >
                  <div
                    className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      isSelected
                        ? "bg-accent text-white shadow-sm"
                        : "bg-surface border border-border-subtle text-text-dim"
                    }`}
                  >
                    <Icon size={20} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-white flex items-center gap-2">
                        <span>{opt.name}</span>
                        {isSelected && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-accent-light">
                            <CheckCircle2 size={12} /> Selected
                          </span>
                        )}
                      </h4>
                      <span className="rounded bg-surface px-2 py-0.5 text-[9px] font-mono font-bold uppercase text-text-dim border border-border-subtle">
                        {opt.badge}
                      </span>
                    </div>

                    <p className="text-[11px] text-text-muted mt-1 leading-relaxed">
                      {opt.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </Panel>

      {/* SECTION 2: SECTION HEADERS & CONTROLS */}
      <Panel title="Section Text & Options">
        <div className="space-y-4">
          <Input
            id="cal-title"
            label="Section Headline"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Upcoming Events & Mission Calendar"
          />

          <Input
            id="cal-subtitle"
            label="Section Description"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="e.g. Live passes, orbit maneuvers, and ground station maintenance..."
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div
              className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                showLegend
                  ? "border-nominal/40 bg-nominal/[0.06]"
                  : "border-border-subtle bg-surface/50 text-text-dim"
              }`}
              onClick={() => setShowLegend(!showLegend)}
            >
              <div>
                <div className="text-xs font-semibold text-text-primary">Show Color Legend</div>
                <div className="text-[10px] text-text-dim mt-0.5">Pass, Maneuver, Maintenance badges</div>
              </div>
              <input
                type="checkbox"
                checked={showLegend}
                onChange={() => {}}
                className="h-4 w-4 accent-nominal pointer-events-none"
              />
            </div>

            <div
              className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                showQuickStats
                  ? "border-nominal/40 bg-nominal/[0.06]"
                  : "border-border-subtle bg-surface/50 text-text-dim"
              }`}
              onClick={() => setShowQuickStats(!showQuickStats)}
            >
              <div>
                <div className="text-xs font-semibold text-text-primary">Show Monthly Metrics</div>
                <div className="text-[10px] text-text-dim mt-0.5">Event count summary pills</div>
              </div>
              <input
                type="checkbox"
                checked={showQuickStats}
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
