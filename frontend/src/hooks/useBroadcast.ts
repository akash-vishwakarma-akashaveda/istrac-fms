import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '../api'

interface BroadcastPayload {
  message: string
  type?: string
  label?: string
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

export function useBroadcastCategories() {
  return useQuery({
    queryKey: ['broadcast-categories'],
    queryFn: () => notificationsApi.getBroadcastCategories(),
    staleTime: 60_000,
  })
}

export function useRevokeBroadcast() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => notificationsApi.revokeBroadcast(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['active-banner'] })
      queryClient.invalidateQueries({ queryKey: ['public-notifications'] })
    },
  })
}