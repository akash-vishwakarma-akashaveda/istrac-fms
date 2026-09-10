import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { notificationsApi, type NotificationItem } from '../api'
import { useNotificationStore } from '../store/notificationStore'

export type { NotificationItem }

export interface NotificationsPageData {
  data: NotificationItem[]
  nextCursor: string | null
}

export function useNotifications(category?: string) {
  return useInfiniteQuery<NotificationsPageData, Error, InfiniteData<NotificationsPageData>, (string | undefined)[], number>({
    queryKey: ['notifications', category],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await notificationsApi.getNotifications({ page: pageParam, limit: 20 })
      return {
        data: res.data || [],
        nextCursor: res.page * res.limit < res.total ? String(res.page + 1) : null,
      }
    },
    initialPageParam: 1,
    getNextPageParam: (last) => (last.nextCursor ? Number(last.nextCursor) : undefined),
  })
}

export function useMarkAllRead() {
  const queryClient = useQueryClient()
  const resetUnread = useNotificationStore((s) => s.resetUnread)
  return useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(),
    onSuccess: () => {
      resetUnread()
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useMarkRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string | number) => notificationsApi.markAsRead(String(id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })
}