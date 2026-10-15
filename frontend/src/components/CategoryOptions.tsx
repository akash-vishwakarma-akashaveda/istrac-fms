import { useMemo } from 'react'
import { useReportCategories } from '../hooks/useReportPresets'

/**
 * <option>s for a report-category filter, built from the admin-managed presets so newly
 * added custom categories appear immediately. Values are category codes, which is what the
 * API filters on. `extraCodes` adds codes seen in data that have no preset (e.g. legacy).
 */
export function CategoryOptions({
  allLabel = 'All Categories',
  extraCodes = [],
  onlyActiveWithFiles = false,
}: {
  allLabel?: string
  extraCodes?: string[]
  onlyActiveWithFiles?: boolean
}) {
  const { data: categories = [] } = useReportCategories()
  const filtered = onlyActiveWithFiles
    ? categories.filter((c) => (c.usageCount ?? 0) > 0)
    : categories
  const known = new Set(filtered.map((c) => c.code))
  const sorted = [...filtered].sort((a, b) =>
    a.code === 'GENERAL' ? -1 : b.code === 'GENERAL' ? 1 : a.name.localeCompare(b.name)
  )
  return (
    <>
      <option value="ALL">{allLabel}</option>
      {sorted.map((c) => (
        <option key={c.id} value={c.code}>
          {c.name}
        </option>
      ))}
      {!onlyActiveWithFiles &&
        extraCodes
          .filter((code) => code && !known.has(code))
          .map((code) => (
            <option key={code} value={code}>
              {code.replace(/_/g, ' ')}
            </option>
          ))}
    </>
  )
}

/** Maps a category code to its display name (falls back to the code). */
export function useCategoryLabel() {
  const { data: categories = [] } = useReportCategories()
  return useMemo(() => {
    const names = new Map(categories.map((c) => [c.code, c.name]))
    return (code?: string | null) => (code ? names.get(code) || code.replace(/_/g, ' ') : '')
  }, [categories])
}
