import { DATE_PRESET_OPTIONS, resolveDateRange, type DatePreset, type DateRangeValue } from '../lib/dateRange'

interface DateRangeFilterProps {
  value: DateRangeValue
  onChange: (value: DateRangeValue) => void
  selectClassName?: string
  /** Label prefix for the "Any date" option, e.g. "Uploaded". */
  allLabel?: string
}

const DEFAULT_SELECT =
  'w-full rounded-lg border border-border-default bg-surface px-2.5 py-1.5 text-base sm:text-xs text-text-primary outline-none focus:border-accent cursor-pointer'

export function DateRangeFilter({ value, onChange, selectClassName = DEFAULT_SELECT, allLabel }: DateRangeFilterProps) {
  const { error } = resolveDateRange(value)
  const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local time

  return (
    <div className="space-y-1.5">
      <select
        aria-label="Filter by upload date"
        value={value.preset}
        onChange={(e) => onChange({ ...value, preset: e.target.value as DatePreset })}
        className={selectClassName}
      >
        {DATE_PRESET_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.value === 'ALL' && allLabel ? allLabel : o.label}
          </option>
        ))}
      </select>

      {value.preset === 'custom' && (
        <div className="grid grid-cols-2 gap-1.5">
          <label className="text-[10px] font-semibold uppercase text-text-dim">
            From
            <input
              type="date"
              value={value.from}
              max={value.to || today}
              onChange={(e) => onChange({ ...value, from: e.target.value })}
              className={`${selectClassName} mt-0.5`}
            />
          </label>
          <label className="text-[10px] font-semibold uppercase text-text-dim">
            To
            <input
              type="date"
              value={value.to}
              min={value.from || undefined}
              max={today}
              onChange={(e) => onChange({ ...value, to: e.target.value })}
              className={`${selectClassName} mt-0.5`}
            />
          </label>
        </div>
      )}
      {error && <p className="text-[11px] font-medium text-critical">{error}</p>}
    </div>
  )
}
