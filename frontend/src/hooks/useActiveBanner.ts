import { useQuery } from '@tanstack/react-query'
import { eventsApi, type ActiveBannerData } from '../api/events.api'

export const ACTIVE_BANNER_QUERY_KEY = ['active-banner'] as const

export function useActiveBanner() {
  return useQuery<ActiveBannerData | null>({
    queryKey: ACTIVE_BANNER_QUERY_KEY,
    queryFn: () => eventsApi.getActiveBanner().catch(() => null),
    staleTime: 30_000,
    refetchInterval: 45_000,
    refetchOnWindowFocus: false,
  })
}
