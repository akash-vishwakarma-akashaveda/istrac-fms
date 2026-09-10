import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { reportPresetsApi, type CategoryPreset, type NamingPreset } from '../api/reportPresets.api'

export const REPORT_CATEGORIES_QUERY_KEY = ['report-categories'] as const
export const NAMING_PRESETS_QUERY_KEY = ['naming-presets'] as const

export function useReportCategories() {
  return useQuery<CategoryPreset[]>({
    queryKey: REPORT_CATEGORIES_QUERY_KEY,
    queryFn: () => reportPresetsApi.getCategories(),
    staleTime: 1000 * 60 * 5, // 5 minutes fresh
  })
}

export function useNamingPresets() {
  return useQuery<NamingPreset[]>({
    queryKey: NAMING_PRESETS_QUERY_KEY,
    queryFn: () => reportPresetsApi.getNamingPresets(),
    staleTime: 1000 * 60 * 5, // 5 minutes fresh
  })
}

export function useCreateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { name: string; code: string; description?: string }) =>
      reportPresetsApi.createCategory(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: REPORT_CATEGORIES_QUERY_KEY }),
  })
}

export function useDeleteCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => reportPresetsApi.deleteCategory(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: REPORT_CATEGORIES_QUERY_KEY }),
  })
}

export function useCreateNamingPreset() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { name: string; template: string; description?: string }) =>
      reportPresetsApi.createNamingPreset(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NAMING_PRESETS_QUERY_KEY }),
  })
}

export function useDeleteNamingPreset() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => reportPresetsApi.deleteNamingPreset(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NAMING_PRESETS_QUERY_KEY }),
  })
}
