import { useEffect, useState } from "react"
import { BarChart3, TrendingUp, Globe, Radio, Activity, ShieldCheck, CheckCircle2, Check, Satellite, Database, Clock, Lock } from "lucide-react"
import { useCms } from "../../context/cmsContext"
import { useUpdateCmsBlock } from "../../hooks/useUpdateCmsBlock"
import { useToastStore } from "../../store/toastStore"
import { usePreviewRefresh } from "../../context/PreviewRefreshContext"
import { Input, Panel } from ".."
import { SaveBar } from "./SaveBar"

interface QuickStatsContent {
  stat1Value?: string
  stat1Label?: string
  stat1Icon?: string
  stat2Value?: string
  stat2Label?: string
  stat2Icon?: string
  stat3Value?: string
  stat3Label?: string
  stat3Icon?: string
  stat4Value?: string
  stat4Label?: string
  stat4Icon?: string
}

const STAT_ICONS = [
  { id: "globe", label: "Globe (Network)", icon: Globe },
  { id: "radio", label: "Radio (Telemetry)", icon: Radio },
  { id: "activity", label: "Pulse / Activity", icon: Activity },
  { id: "shield", label: "Shield (Security)", icon: ShieldCheck },
  { id: "check", label: "Verified Tick", icon: CheckCircle2 },
  { id: "tick", label: "Plain Tick (Check)", icon: Check },
  { id: "satellite", label: "Satellite", icon: Satellite },
  { id: "database", label: "Database", icon: Database },
  { id: "clock", label: "Clock (24/7 Ops)", icon: Clock },
  { id: "lock", label: "Lock (Secure)", icon: Lock },
]

export function QuickStatsTab() {
  const { cmsBlocks } = useCms()
  const updateBlock = useUpdateCmsBlock()
  const addToast = useToastStore((s) => s.addToast)
  const { triggerRefresh } = usePreviewRefresh()

  const existing = cmsBlocks["quick_stats"] as QuickStatsContent | undefined

  const [stat1Value, setStat1Value] = useState("")
  const [stat1Label, setStat1Label] = useState("")
  const [stat1Icon, setStat1Icon] = useState("globe")

  const [stat2Value, setStat2Value] = useState("")
  const [stat2Label, setStat2Label] = useState("")
  const [stat2Icon, setStat2Icon] = useState("radio")

  const [stat3Value, setStat3Value] = useState("")
  const [stat3Label, setStat3Label] = useState("")
  const [stat3Icon, setStat3Icon] = useState("activity")

  const [stat4Value, setStat4Value] = useState("")
  const [stat4Label, setStat4Label] = useState("")
  const [stat4Icon, setStat4Icon] = useState("shield")

  useEffect(() => {
    setStat1Value(existing?.stat1Value ?? "5 Stations")
    setStat1Label(existing?.stat1Label ?? "Global Ground Network")
    setStat1Icon(existing?.stat1Icon ?? "globe")

    setStat2Value(existing?.stat2Value ?? "10+ Missions")
    setStat2Label(existing?.stat2Label ?? "Deep Space & LEO")
    setStat2Icon(existing?.stat2Icon ?? "radio")

    setStat3Value(existing?.stat3Value ?? "24/7 MOX Ops")
    setStat3Label(existing?.stat3Label ?? "Continuous Telemetry")
    setStat3Icon(existing?.stat3Icon ?? "activity")

    setStat4Value(existing?.stat4Value ?? "SHA-256")
    setStat4Label(existing?.stat4Label ?? "Cryptographic Integrity")
    setStat4Icon(existing?.stat4Icon ?? "shield")
  }, [existing])

  function handleSave() {
    updateBlock.mutate(
      {
        blockKey: "quick_stats",
        content: {
          stat1Value,
          stat1Label,
          stat1Icon,
          stat2Value,
          stat2Label,
          stat2Icon,
          stat3Value,
          stat3Label,
          stat3Icon,
          stat4Value,
          stat4Label,
          stat4Icon,
        },
      },
      {
        onSuccess: () => {
          addToast({ message: "Quick Stats strip updated", variant: "success" })
          triggerRefresh()
        },
        onError: () => {
          addToast({ message: "Failed to save quick stats", variant: "error" })
        },
      },
    )
  }

  const stats = [
    {
      value: stat1Value,
      label: stat1Label,
      icon: stat1Icon,
      setValue: setStat1Value,
      setLabel: setStat1Label,
      setIcon: setStat1Icon,
      key: "1",
    },
    {
      value: stat2Value,
      label: stat2Label,
      icon: stat2Icon,
      setValue: setStat2Value,
      setLabel: setStat2Label,
      setIcon: setStat2Icon,
      key: "2",
    },
    {
      value: stat3Value,
      label: stat3Label,
      icon: stat3Icon,
      setValue: setStat3Value,
      setLabel: setStat3Label,
      setIcon: setStat3Icon,
      key: "3",
    },
    {
      value: stat4Value,
      label: stat4Label,
      icon: stat4Icon,
      setValue: setStat4Value,
      setLabel: setStat4Label,
      setIcon: setStat4Icon,
      key: "4",
    },
  ]

  return (
    <Panel title="Quick Stats Strip" meta="block:quick_stats">
      <div className="space-y-5">
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-accent/[0.05] border border-accent/20">
          <TrendingUp size={14} className="text-accent-light shrink-0 mt-0.5" />
          <p className="text-xs text-text-secondary">
            These 4 statistics appear as a highlight strip directly below the hero section. Each stat has a selectable icon, bold metric value, and a short descriptive label.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {stats.map((stat) => (
            <div key={stat.key} className="rounded-xl border border-border-default bg-[#060c18] p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase text-accent-light bg-accent/10 border border-accent/30 px-2 py-0.5 rounded">
                  Stat #{stat.key}
                </span>
                {stat.value && (
                  <div className="text-right">
                    <div className="text-sm font-bold text-text-primary num">{stat.value}</div>
                    <div className="text-[9px] text-text-dim">{stat.label}</div>
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor={`stat-${stat.key}-icon`}
                  className="block text-[11px] font-semibold text-text-secondary mb-1"
                >
                  Card Icon
                </label>
                <select
                  id={`stat-${stat.key}-icon`}
                  value={stat.icon}
                  onChange={(e) => stat.setIcon(e.target.value)}
                  className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  {STAT_ICONS.map((opt) => (
                    <option key={opt.id} value={opt.id} className="bg-card text-white">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                id={`stat-${stat.key}-value`}
                label="Metric Value"
                value={stat.value}
                onChange={(e) => stat.setValue(e.target.value)}
                placeholder="e.g. 5 Stations"
              />

              <Input
                id={`stat-${stat.key}-label`}
                label="Description Label"
                value={stat.label}
                onChange={(e) => stat.setLabel(e.target.value)}
                placeholder="e.g. Global Ground Network"
              />
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-text-dim flex items-center gap-1.5">
            <BarChart3 size={11} />
            Live Strip Preview
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-lg border border-border-subtle bg-surface">
            {stats.map((stat) => {
              const matchedIcon = STAT_ICONS.find((i) => i.id === stat.icon) || STAT_ICONS[0]
              const IconComponent = matchedIcon.icon

              return (
                <div key={stat.key} className="text-center p-2 rounded bg-card/40 border border-border-subtle/50">
                  <div className="flex justify-center mb-1 text-accent-light">
                    <IconComponent size={16} />
                  </div>
                  <div className="text-sm font-extrabold text-white num">{stat.value || "—"}</div>
                  <div className="text-[10px] text-text-dim mt-0.5">{stat.label || "—"}</div>
                </div>
              )
            })}
          </div>
        </div>

        <SaveBar onSave={handleSave} isPending={updateBlock.isPending} />
      </div>
    </Panel>
  )
}
