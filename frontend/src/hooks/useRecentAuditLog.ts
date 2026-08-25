import { useQuery } from '@tanstack/react-query'
import { adminApi, type AuditLogEntry } from '../api'

export function useRecentAuditLog() {
  return useQuery({
    queryKey: ['audit-log-recent'],
    queryFn: async () => {
      const res = await adminApi.getAuditLogs({ pageSize: 10 })
      return res.data as AuditLogEntry[]
    },
  })
}