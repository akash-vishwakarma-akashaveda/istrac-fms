import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  trend?: string
}

/**
 * A single telemetry readout. The figure is set in mono because it came from
 * the system, and it's the largest thing in the cell — the icon is reduced to
 * a quiet marker in the corner rather than a coloured badge competing with it.
 */
export function StatCard({ label, value, icon: Icon, trend }: StatCardProps) {
  return (
    <div className="group relative rounded-xl border border-border-default bg-card p-4.5 shadow-card transition-all duration-300 hover:border-secondary/50 hover:shadow-card-hover hover:-translate-y-1 overflow-hidden">
      {/* Subtle ambient telemetry glow in the background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-5 -top-5 h-20 w-20 rounded-full bg-secondary/10 blur-xl transition-all duration-300 group-hover:bg-accent/15 group-hover:scale-125"
      />

      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="col-label font-mono text-[10px] tracking-wider text-text-dim uppercase">{label}</p>
          <p className="num mt-2 text-[28px] font-black leading-none text-text-primary tracking-tight">{value}</p>
        </div>

        {/* Precision aerospace icon pedestal */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-secondary/25 bg-secondary/10 text-secondary-light shadow-inner transition-all duration-200 group-hover:border-accent/40 group-hover:bg-accent/15 group-hover:text-accent-light group-hover:scale-105">
          <Icon
            size={18}
            strokeWidth={1.8}
            aria-hidden="true"
          />
        </div>
      </div>

      {trend && (
        <p className="relative z-10 mt-3 truncate text-[11px] text-text-secondary font-medium">{trend}</p>
      )}

      {/* Hairline baseline: reads as an active telemetry gauge */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-accent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />
    </div>
  )
}