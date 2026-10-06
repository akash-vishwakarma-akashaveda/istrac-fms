import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '../api/notifications.api'
import { useNotificationStore } from '../store/notificationStore'
import { useAuthStore } from '../store/authStore'
import { useToastStore } from '../store/toastStore'

export function useLiveNotificationSync() {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount)
  const addToast = useToastStore((s) => s.addToast)
  const prevCountRef = useRef<number | null>(null)

  useEffect(() => {
    if (!user) {
      prevCountRef.current = null
      return
    }

    let isMounted = true

    async function checkNotifications() {
      try {
        const count = await notificationsApi.getUnreadCount()
        if (!isMounted) return

        setUnreadCount(count)

        // Any change (new notification, or a broadcast revoked by an admin) refreshes the lists.
        if (prevCountRef.current !== null && count !== prevCountRef.current) {
          queryClient.invalidateQueries({ queryKey: ['notifications'] })
          queryClient.invalidateQueries({ queryKey: ['active-banner'] })
        }

        // Only an increase gets a toast for the newest item.
        if (prevCountRef.current !== null && count > prevCountRef.current) {

          // Fetch the newest unread notification to display in toast
          try {
            const res = await notificationsApi.getNotifications({ unread: true, limit: 1 })
            const latest = res.data?.[0]
            if (latest && isMounted) {
              addToast({
                title: latest.type === 'CRITICAL' ? 'CRITICAL ALERT' : 'Operations Notification',
                message: latest.message,
                variant: latest.type === 'CRITICAL' ? 'error' : 'info',
              })
            }
          } catch {}
        }

        prevCountRef.current = count
      } catch (err) {
        // Silent background poll fallback
      }
    }

    // Initial check
    checkNotifications()

    // 15-second background synchronization
    const timer = setInterval(checkNotifications, 15_000)

    return () => {
      isMounted = false
      clearInterval(timer)
    }
  }, [user, setUnreadCount, addToast, queryClient])
}
