import { useEffect, useState } from "react"
import { BarChart3, TrendingUp } from "lucide-react"
import { useCms } from "../../context/cmsContext"
import { useUpdateCmsBlock } from "../../hooks/useUpdateCmsBlock"
import { useToastStore } from "../../store/toastStore"
import { usePreviewRefresh } from "../../context/PreviewRefreshContext"
import { Input, Panel } from ".."
import { SaveBar } from "./SaveBar"

interface QuickStatsContent {
  stat1Value?: string
  stat1Label?: string
  stat2Value?: string
  stat2Label?: string
  stat3Value?: string
  stat3Label?: string
  stat4Value?: string
  stat4Label?: string
}

export function QuickStatsTab() {
  const { cmsBlocks } = useCms()
  const updateBlock = useUpdateCmsBlock()
  const addToast = useToastStore((s) => s.addToast)
  const { triggerRefresh } = usePreviewRefresh()

  const existing = cmsBlocks["quick_stats"] as QuickStatsContent | undefined

  const [stat1Value, setStat1Value] = useState("")
  const [stat1Label, setStat1Label] = useState("")
  const [stat2Value, setStat2Value] = useState("")
  const [stat2Label, setStat2Label] = useState("")
  const [stat3Value, setStat3Value] = useState("")
  const [stat3Label, setStat3Label] = useState("")
  const [stat4Value, setStat4Value] = useState("")
  const [stat4Label, setStat4Label] = useState("")

  useEffect(() => {
    setStat1Value(existing?.stat1Value ?? "5 Stations")
    setStat1Label(existing?.stat1Label ?? "Global Ground Network")
    setStat2Value(existing?.stat2Value ?? "10+ Missions")
    setStat2Label(existing?.stat2Label ?? "Deep Space & LEO")
    setStat3Value(existing?.stat3Value ?? "24/7 MOX Ops")
    setStat3Label(existing?.stat3Label ?? "Continuous Telemetry")
    setStat4Value(existing?.stat4Value ?? "SHA-256")
    setStat4Label(existing?.stat4Label ?? "Cryptographic Integrity")
  }, [existing])

  function handleSave() {
    updateBlock.mutate(
      {
        blockKey: "quick_stats",
        content: { stat1Value, stat1Label, stat2Value, stat2Label, stat3Value, stat3Label, stat4Value, stat4Label },
      },
      {
        onSuccess: () => { addToast({ message: "Quick Stats strip updated", variant: "success" }); triggerRefresh() },
        onError: () => { addToast({ message: "Failed to save quick stats", variant: "error" }) },
      },
    )
  }

  const stats = [
    { value: stat1Value, label: stat1Label, setValue: setStat1Value, setLabel: setStat1Label, key: "1" },
    { value: stat2Value, label: stat2Label, setValue: setStat2Value, setLabel: setStat2Label, key: "2" },
    { value: stat3Value, label: stat3Label, setValue: setStat3Value, setLabel: setStat3Label, key: "3" },
    { value: stat4Value, label: stat4Label, setValue: setStat4Value, setLabel: setStat4Label, key: "4" },
  ]

  return (
    <Panel title="Quick Stats Strip" meta="block:quick_stats">
      <div className="space-y-5">
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-accent/[0.05] border border-accent/20">
          <TrendingUp size={14} className="text-accent-light shrink-0 mt-0.5" />
          <p className="text-xs text-text-secondary">
            These 4 statistics appear as a highlight strip directly below the hero section. Each stat has a bold metric value and a short descriptive label.
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
            {stats.map((stat) => (
              <div key={stat.key} className="text-center">
                <div className="text-sm font-extrabold text-white num">{stat.value || "—"}</div>
                <div className="text-[10px] text-text-dim mt-0.5">{stat.label || "—"}</div>
              </div>
            ))}
          </div>
        </div>

        <SaveBar onSave={handleSave} isPending={updateBlock.isPending} />
      </div>
    </Panel>
  )
}
