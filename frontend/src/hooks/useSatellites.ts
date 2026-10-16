import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  satellitesApi,
  type Satellite,
  type CreateSatellitePayload,
  type UpdateSatellitePayload,
} from '../api/satellites.api'

export type { Satellite }

export const SATELLITES_QUERY_KEY = ['satellites'] as const
export const ADMIN_SATELLITES_QUERY_KEY = ['admin-satellites'] as const

/**
 * Hook to fetch active satellites with React Query caching (5 min staleTime).
 * Automatically deduplicates network calls across multiple components.
 */
export function useSatellites() {
  return useQuery({
    queryKey: SATELLITES_QUERY_KEY,
    queryFn: () => satellitesApi.getActiveSatellites(),
    staleTime: 1000 * 60 * 5, // 5 minutes fresh
  })
}

/**
 * Alias for useSatellites for singular naming preference
 */
export const useSatellite = useSatellites

/**
 * Hook to fetch all admin satellites (including ground complexes and inactive)
 * with React Query caching.
 */
export function useAdminSatellites() {
  return useQuery({
    queryKey: ADMIN_SATELLITES_QUERY_KEY,
    queryFn: () => satellitesApi.getAllAdminSatellites(),
    staleTime: 1000 * 60 * 5,
  })
}

/**
 * Hook to fetch a single satellite by its ID
 */
export function useSatelliteDetail(id?: string) {
  return useQuery({
    queryKey: ['satellite', id],
    queryFn: () => (id ? satellitesApi.getSatellite(id) : null),
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 5,
  })
}

/**
 * Hook to create a new satellite and automatically invalidate satellite caches
 */
export function useCreateSatellite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateSatellitePayload) => satellitesApi.createSatellite(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SATELLITES_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ADMIN_SATELLITES_QUERY_KEY })
    },
  })
}

/**
 * Hook to update a satellite and automatically invalidate satellite caches
 */
export function useUpdateSatellite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & UpdateSatellitePayload) =>
      satellitesApi.updateSatellite(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SATELLITES_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ADMIN_SATELLITES_QUERY_KEY })
    },
  })
}

/**
 * Hook to delete a satellite and automatically invalidate satellite caches
 */
export function useDeleteSatellite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => satellitesApi.deleteSatellite(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SATELLITES_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ADMIN_SATELLITES_QUERY_KEY })
    },
  })
}
