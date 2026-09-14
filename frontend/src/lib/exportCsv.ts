 const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r']
export function exportToCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return

  const headers = Object.keys(rows[0])
  const csvLines = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((h) => {
         const val = String(row[h] ?? '')

const safeVal = FORMULA_PREFIXES.some((prefix) =>
  val.startsWith(prefix)
)
  ? `'${val}`
  : val

return safeVal.includes(',') || safeVal.includes('"')
  ? `"${safeVal.replace(/"/g, '""')}"`
  : safeVal
        })
        .join(',')
    ),
  ]

  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}