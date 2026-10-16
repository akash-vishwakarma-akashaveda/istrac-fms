import { useEffect, useState, useRef } from "react"
import { apiClient } from "../api/client"
import { useAuthStore } from "../store/authStore"

export function useInitAuth() {
  const [isChecking, setIsChecking] = useState(true)
  const hasRun = useRef(false)

  useEffect(() => {
    if (hasRun.current) return
    hasRun.current = true

    const currentUser = useAuthStore.getState().user
    const currentToken = useAuthStore.getState().accessToken
    const currentRefreshToken = useAuthStore.getState().refreshToken

    // If we have an active user and accessToken in localStorage, we are already authenticated!
    if (currentUser && currentToken) {
      setIsChecking(false)
      // Background sync latest user profile & department access permissions from DB
      apiClient
        .get("/auth/me")
        .then((res) => {
          const freshUser = res.data?.data || res.data
          if (freshUser?.id) {
            useAuthStore.getState().updateUser(freshUser)
          }
        })
        .catch(() => {})
      return
    }

    // If user exists without accessToken, attempt session restoration via refresh token / cookie
    if (currentUser && !currentToken && currentRefreshToken) {
      apiClient
        .post(
          "/auth/refresh",
          { refreshToken: currentRefreshToken },
          { headers: { "x-refresh-token": currentRefreshToken } }
        )
        .then((res) => {
          const token = res.data?.data?.accessToken || res.data?.accessToken
          const newRefresh = res.data?.data?.refreshToken || res.data?.refreshToken
          const refreshedUser = res.data?.data?.user || res.data?.user || currentUser
          if (token) {
            useAuthStore.getState().setAuth(refreshedUser, token, newRefresh)
          } else {
            useAuthStore.getState().clearAuth()
          }
        })
        .catch(() => {
          useAuthStore.getState().clearAuth()
          if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login") && window.location.pathname !== "/") {
            window.location.href = "/login?session_expired=true"
          }
        })
        .finally(() => {
          setIsChecking(false)
        })
      return
    }

    // Guest visitor
    setIsChecking(false)
  }, [])

  return { isChecking }
}
