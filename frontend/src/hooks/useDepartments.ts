import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  departmentsApi,
  type Department,
  type CreateDepartmentPayload,
  type UpdateDepartmentPayload,
} from '../api'

export type { Department }

export const PUBLIC_DEPARTMENTS_QUERY_KEY = ['public-departments'] as const
export const USER_DEPARTMENTS_QUERY_KEY = ['departments'] as const
export const ADMIN_DEPARTMENTS_QUERY_KEY = ['admin-departments'] as const

export function useDepartments() {
  return useQuery({
    queryKey: USER_DEPARTMENTS_QUERY_KEY,
    queryFn: () => departmentsApi.getUserDepartments(),
  })
}

export function usePublicDepartments() {
  return useQuery({
    queryKey: PUBLIC_DEPARTMENTS_QUERY_KEY,
    queryFn: () => departmentsApi.getPublicDepartments(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

export function useAdminDepartments(options?: { satelliteId?: string; activeOnly?: boolean } | string) {
  const satelliteId = typeof options === 'string' ? options : options?.satelliteId
  const activeOnly = typeof options === 'object' ? options?.activeOnly : undefined
  return useQuery({
    queryKey: ['admin-departments', satelliteId, activeOnly],
    queryFn: () => departmentsApi.getAllAdminDepartments(typeof options === 'object' ? options : { satelliteId }),
  })
}

export function useCreateDepartment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateDepartmentPayload) => departmentsApi.createDepartment(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USER_DEPARTMENTS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ADMIN_DEPARTMENTS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: PUBLIC_DEPARTMENTS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ['user-departments'] })
    },
  })
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & UpdateDepartmentPayload) =>
      departmentsApi.updateDepartment(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USER_DEPARTMENTS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ADMIN_DEPARTMENTS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: PUBLIC_DEPARTMENTS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ['user-departments'] })
    },
  })
}

export function useArchiveDepartment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      departmentsApi.updateDepartment(id, { archived }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USER_DEPARTMENTS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ADMIN_DEPARTMENTS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: PUBLIC_DEPARTMENTS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ['user-departments'] })
    },
  })
}