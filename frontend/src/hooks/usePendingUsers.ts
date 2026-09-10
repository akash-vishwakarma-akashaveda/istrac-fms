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
    mutationFn: ({
      userId,
      role,
      employeeId,
      departments,
    }: {
      userId: string
      role?: string
      employeeId?: string
      departments?: Array<{ departmentId: string; accessLevel?: 'READ_ONLY' | 'READ_WRITE' }>
    }) => usersApi.approveUser(userId, { role, employeeId, departments }),
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