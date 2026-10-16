import { useEffect } from 'react'
import { wsClient } from '../lib/ws'
import { useAuthStore } from '../store/authStore'

const DEFAULT_IDLE_TIMEOUT = 30 * 60 * 1000 // 30 minutes

export function useIdleTimeout(
  timeoutMs = DEFAULT_IDLE_TIMEOUT
) {
  const user = useAuthStore((state) => state.user)

  useEffect(() => {
    if (!user) {
      return
    }

    let timer: ReturnType<typeof setTimeout>

    const resetTimer = () => {
      clearTimeout(timer)

      timer = setTimeout(() => {
        useAuthStore.getState().clearAuth()
        wsClient.disconnect()

        window.location.replace('/login?reason=idle')
      }, timeoutMs)
    }

    const events = [
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
      'mousemove',
    ] as const

    events.forEach((event) => {
      window.addEventListener(event, resetTimer, {
        passive: true,
      })
    })

    resetTimer()

    return () => {
      clearTimeout(timer)

      events.forEach((event) => {
        window.removeEventListener(event, resetTimer)
      })
    }
  }, [user, timeoutMs])
}