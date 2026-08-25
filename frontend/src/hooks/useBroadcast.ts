import { useMutation } from '@tanstack/react-query'
import { notificationsApi } from '../api'

interface BroadcastPayload {
  message: string
  type?: string
  category?: string
  target?: string
  departmentIds?: string[]
}

export function useBroadcast() {
  return useMutation({
    mutationFn: (payload: BroadcastPayload) => notificationsApi.sendBroadcast(payload),
  })
}