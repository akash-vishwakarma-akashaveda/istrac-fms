import { useEffect, useState } from 'react'
import { apiClient } from '../api/client'
import { useAuthStore } from '../store/authStore'

export function useInitAuth() {
  const [isChecking, setIsChecking] = useState(true)
  const user = useAuthStore((s) => s.user)
  const setAuth = useAuthStore((s) => s.setAuth)
  const clearAuth = useAuthStore((s) => s.clearAuth)

  useEffect(() => {
    if (!user) {
      setIsChecking(false)
      return
    }

    apiClient
      .post('/auth/refresh')
      .then((res) => {
        const token = res.data?.data?.accessToken || res.data?.accessToken
        if (token) {
          setAuth(user, token)
        } else {
          clearAuth()
        }
      })
      .catch(() => clearAuth())
      .finally(() => setIsChecking(false))
  }, [user, setAuth, clearAuth])

  return { isChecking }
}