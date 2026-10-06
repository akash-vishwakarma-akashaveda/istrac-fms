import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { notificationsApi, getErrorMessage, type NotificationItem } from '../api'
import { useToastStore } from '../store/toastStore'
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
    // Revoked broadcasts don't change the unread count once read, so refresh periodically too.
    refetchInterval: 60_000,
  })
}

export function useMarkAllRead() {
  const queryClient = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)
  const resetUnread = useNotificationStore((s) => s.resetUnread)
  return useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(),
    onSuccess: () => {
      resetUnread()
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      addToast({ message: 'All notifications marked as read.', variant: 'success' })
    },
    onError: (err) => addToast({ title: 'Could not mark notifications as read', message: getErrorMessage(err), variant: 'error' }),
  })
}

export function useMarkRead() {
  const queryClient = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)
  return useMutation({
    mutationFn: (id: string | number) => notificationsApi.markAsRead(String(id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    onError: (err) => addToast({ title: 'Could not mark notification as read', message: getErrorMessage(err), variant: 'error' }),
  })
}