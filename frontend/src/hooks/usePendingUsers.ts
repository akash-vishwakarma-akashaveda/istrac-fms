import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '../api'

export function usePendingUsers() {
  return useQuery({
    queryKey: ['pending-users'],
    queryFn: () => usersApi.getPendingUsers(),
  })
}

export function useApproveUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => usersApi.approveUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-users'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

export function useRejectUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      usersApi.rejectUser(userId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-users'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}