import { useInfiniteQuery } from '@tanstack/react-query'
import { adminApi, type AuditLogEntry, type AuditLogPage, type AuditLogQueryParams } from '../api'

export type { AuditLogEntry, AuditLogPage }

export function useAuditLog(filters: AuditLogQueryParams) {
  return useInfiniteQuery({
    queryKey: ['audit-log', filters],
    queryFn: async ({ pageParam }) => {
      return adminApi.getAuditLogs({
        ...filters,
        cursor: pageParam as string | undefined,
        pageSize: 30,
      })
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
}