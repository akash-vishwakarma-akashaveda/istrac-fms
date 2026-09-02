import { useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '../api'

interface BroadcastPayload {
  message: string
  type?: string
  category?: string
  target?: string
  departmentIds?: string[]
}

export function useBroadcast() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: BroadcastPayload) => notificationsApi.sendBroadcast(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['active-banner'] })
      queryClient.invalidateQueries({ queryKey: ['public-notifications'] })
      queryClient.invalidateQueries({ queryKey: ['events'] })
    },
  })
}