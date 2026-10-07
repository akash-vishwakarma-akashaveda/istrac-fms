// Report categories are admin-managed presets (ReportCategoryPreset.code). Uploads store the
// chosen code in Report.customCategory; Report.category is a legacy fixed enum that only
// knows a handful of values. Everything that filters or displays a category goes through here
// so custom categories behave exactly like the built-in ones.

type LegacyCategory = 'SPECIAL_OPERATIONS' | 'ANOMALY' | 'STUDY' | 'DAILY_REPORT' | 'OTHER'

const CODE_TO_ENUM: Record<string, LegacyCategory> = {
  DAILYOPS: 'DAILY_REPORT',
  DAILY_REPORT: 'DAILY_REPORT',
  SPECOPS: 'SPECIAL_OPERATIONS',
  SPECIAL_OPERATIONS: 'SPECIAL_OPERATIONS',
  ANOMALY: 'ANOMALY',
  STUDY: 'STUDY',
  GENERAL: 'OTHER',
  OTHER: 'OTHER',
}

const ENUM_TO_CODE: Record<LegacyCategory, string> = {
  DAILY_REPORT: 'DAILYOPS',
  SPECIAL_OPERATIONS: 'SPECOPS',
  ANOMALY: 'ANOMALY',
  STUDY: 'STUDY',
  OTHER: 'GENERAL',
}

export function normalizeCategoryCode(raw: unknown): string {
  return String(raw ?? '').replace(/[^a-zA-Z0-9_]/g, '').toUpperCase()
}

/** Legacy enum value to store alongside a category code (custom codes map to OTHER). */
export function categoryEnumFor(code: unknown): LegacyCategory {
  return CODE_TO_ENUM[normalizeCategoryCode(code)] ?? 'OTHER'
}

/** The category code of a report, falling back to the legacy enum for old rows. */
export function categoryCodeOf(report?: { category?: string | null; customCategory?: string | null } | null): string | null {
  if (!report) return null
  if (report.customCategory) return normalizeCategoryCode(report.customCategory)
  return report.category ? ENUM_TO_CODE[report.category as LegacyCategory] ?? report.category : null
}

/** Prisma `Report` filter matching a category code (new rows by code, old rows by enum). */
export function reportCategoryWhere(code: unknown) {
  const clean = normalizeCategoryCode(code)
  const legacy = CODE_TO_ENUM[clean]
  return {
    OR: [
      { customCategory: clean },
      ...(legacy ? [{ customCategory: null, category: legacy }] : []),
    ],
  }
}
