import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  departmentsApi,
  type Department,
  type CreateDepartmentPayload,
  type UpdateDepartmentPayload,
} from '../api'

export type { Department }

export function useDepartments() {
  return useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.getUserDepartments(),
  })
}

export function useAdminDepartments(satelliteId?: string) {
  return useQuery({
    queryKey: ['admin-departments', satelliteId],
    queryFn: () => departmentsApi.getAllAdminDepartments(satelliteId),
  })
}

export function useCreateDepartment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateDepartmentPayload) => departmentsApi.createDepartment(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['departments'] }),
  })
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & UpdateDepartmentPayload) =>
      departmentsApi.updateDepartment(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['departments'] }),
  })
}

export function useArchiveDepartment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      departmentsApi.updateDepartment(id, { archived }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['departments'] }),
  })
}