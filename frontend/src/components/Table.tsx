import type { ReactNode } from 'react'

interface Column<T> {
  key: keyof T
  header: string
  render?: (row: T) => ReactNode
  /** Machine-produced column: set in mono and right-aligned so figures stack. */
  numeric?: boolean
}

interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  emptyMessage?: string
}

/**
 * Records table. Rows are separated by hairlines rather than boxed or striped,
 * the header is a small uppercase label row, and columns flagged `numeric` are
 * set in tabular mono so digits line up down the column.
 */
export function Table<T extends { id: string | number }>({
  columns,
  data,
  emptyMessage = 'No records.',
}: TableProps<T>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <thead>
          <tr className="border-b border-border-default bg-surface">
            {columns.map((column) => (
              <th
                key={String(column.key)}
                scope="col"
                className={`px-4 py-2.5 text-[11px] font-bold tracking-[0.06em] uppercase text-text-dim ${
                  column.numeric ? 'text-right' : 'text-left'
                }`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-border-subtle">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center">
                <span aria-hidden="true" className="num block text-sm text-text-dim">
                  —
                </span>
                <p className="mt-2 text-xs text-text-muted">{emptyMessage}</p>
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={row.id}
                className="transition-colors duration-100 hover:bg-card-hover"
              >
                {columns.map((column) => (
                  <td
                    key={String(column.key)}
                    className={`px-4 py-3 align-middle text-[13px] whitespace-nowrap ${
                      column.numeric
                        ? 'num text-right text-text-secondary'
                        : 'text-text-primary'
                    }`}
                  >
                    {column.render ? column.render(row) : String(row[column.key])}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
