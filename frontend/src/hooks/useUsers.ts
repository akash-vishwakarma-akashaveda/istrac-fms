import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi, type UserProfile, type PaginatedUsersResponse } from '../api'

export interface User extends Partial<UserProfile> {
  id: string
  name: string
  email: string
  employeeId?: string | null
  role: 'ADMIN' | 'MEMBER' | any
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED'
  createdAt: string
}

export type UsersResponse = PaginatedUsersResponse

interface UseUsersParams {
  page: number
  search: string
  status: string
  role: string
}

export function useUsers({ page, search, status, role }: UseUsersParams) {
  return useQuery({
    queryKey: ['users', page, search, status, role],
    queryFn: () =>
      usersApi.getUsers({
        page,
        pageSize: 20,
        search: search || undefined,
        status: status || undefined,
        role: role || undefined,
      }),
  })
}

export function useSuspendUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => usersApi.suspendUser(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  })
}

export function useForceLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => usersApi.forceLogout(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  })
}