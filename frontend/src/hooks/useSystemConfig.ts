import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi, type SystemConfig } from '../api'

export type { SystemConfig }

export const SYSTEM_CONFIG_QUERY_KEY = ['system-config'] as const

export function useSystemConfig() {
  return useQuery({
    queryKey: SYSTEM_CONFIG_QUERY_KEY,
    queryFn: () => adminApi.getSystemConfig(),
  })
}

export function useUpdateSetting() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) =>
      adminApi.updateSetting(key, value),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['system-config'] }),
  })
}