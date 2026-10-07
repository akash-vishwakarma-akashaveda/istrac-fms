import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi, getErrorMessage, type SystemConfig } from '../api'
import { useToastStore } from '../store/toastStore'

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
  const addToast = useToastStore((s) => s.addToast)
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) =>
      adminApi.updateSetting(key, value),
    onSuccess: (_data, { key }) => {
      addToast({ title: 'Setting saved', message: `${key} was updated.`, variant: 'success' })
      queryClient.invalidateQueries({ queryKey: ['system-config'] })
    },
    onError: (err, { key }) =>
      addToast({ title: `Could not save ${key}`, message: getErrorMessage(err), variant: 'error' }),
  })
}