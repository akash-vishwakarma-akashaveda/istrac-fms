import { useEffect, useState, useRef } from 'react'
import { apiClient } from '../api/client'
import { useAuthStore } from '../store/authStore'

export function useInitAuth() {
  const [isChecking, setIsChecking] = useState(true)
  const hasRun = useRef(false)

  useEffect(() => {
    if (hasRun.current) return
    hasRun.current = true

    const currentUser = useAuthStore.getState().user
    if (!currentUser) {
      setIsChecking(false)
      return
    }

    apiClient
      .post('/auth/refresh')
      .then((res) => {
        const token = res.data?.data?.accessToken || res.data?.accessToken
        if (token) {
          useAuthStore.getState().setAuth(currentUser, token)
        } else {
          useAuthStore.getState().clearAuth()
        }
      })
      .catch(() => {
        useAuthStore.getState().clearAuth()
      })
      .finally(() => {
        setIsChecking(false)
      })
  }, [])

  return { isChecking }
}