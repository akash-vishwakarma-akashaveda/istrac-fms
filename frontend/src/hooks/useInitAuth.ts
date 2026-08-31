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

    // If we already have user and a valid token in localStorage, we can immediately show the authenticated app
    // while silently refreshing in the background
    if (currentUser && currentToken) {
      setIsChecking(false)

      // Background silent refresh check using httpOnly cookie
      apiClient
        .post("/auth/refresh")
        .then((res) => {
          const token = res.data?.data?.accessToken || res.data?.accessToken
          if (token) {
            useAuthStore.getState().setAuth(currentUser, token)
          }
        })
        .catch((err) => {
          // If the refresh cookie expired or was invalid (401), clear auth
          if (err.response?.status === 401) {
            useAuthStore.getState().clearAuth()
          }
        })
      return
    }

    // If user exists without accessToken or first load, try cookie refresh
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

    // Guest / Public visitor
    setIsChecking(false)
  }, [])

  return { isChecking }
}
