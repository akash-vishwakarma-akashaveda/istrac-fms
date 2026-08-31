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

    // If we have an active user and accessToken in localStorage, we are already authenticated!
    if (currentUser && currentToken) {
      setIsChecking(false)

      // Silent background validation (do NOT log out if refresh fails due to cross-origin or network hiccup,
      // as long as access token is valid)
      apiClient
        .post("/auth/refresh")
        .then((res) => {
          const token = res.data?.data?.accessToken || res.data?.accessToken
          if (token) {
            useAuthStore.getState().setAuth(currentUser, token)
          }
        })
        .catch(() => {
          // Keep current token; 401 interceptor will handle expired token when actual API requests are made
        })
      return
    }

    // If user exists without accessToken, attempt session restoration via cookie
    if (currentUser && !currentToken) {
      apiClient
        .post("/auth/refresh")
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
      return
    }

    // Guest visitor
    setIsChecking(false)
  }, [])

  return { isChecking }
}
