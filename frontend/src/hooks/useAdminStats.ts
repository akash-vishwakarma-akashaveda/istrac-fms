import { useQuery } from '@tanstack/react-query'
import { adminApi, type AdminStats } from '../api'

export type { AdminStats }

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminApi.getStats(),
    refetchInterval: 30_000,
  })
}