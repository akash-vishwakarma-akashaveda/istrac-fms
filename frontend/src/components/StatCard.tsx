import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  trend?: string
}

/** A dashboard figure: label, value, one-line context, and a soft-blue icon tile. */
export function StatCard({ label, value, icon: Icon, trend }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-text-muted">{label}</p>
          <p className="num mt-2 text-[28px] font-bold leading-none tracking-tight text-text-primary">{value}</p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-blue-soft text-accent-light" aria-hidden="true">
          <Icon size={19} strokeWidth={1.8} />
        </span>
      </div>
      {trend && <p className="mt-3 truncate text-[13px] text-text-secondary">{trend}</p>}
    </div>
  )
}
