import axios, { type AxiosError, type AxiosRequestConfig } from "axios"
import { useAuthStore } from "../store/authStore"

const apiUrl = import.meta.env.VITE_API_URL

if (import.meta.env.PROD && !apiUrl) {
  throw new Error("VITE_API_URL must be set for production builds")
}

export const apiClient = axios.create({
  baseURL: apiUrl || "/api",
  withCredentials: true,
  timeout: 30_000,
  headers: {
    "Content-Type": "application/json",
  },
})

// Attach current access token to every outgoing request
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// In-flight refresh lock to avoid stampede on multiple simultaneous 401s
let isRefreshing = false
let refreshQueue: Array<(token: string) => void> = []

apiClient.interceptors.response.use(
  (response) => {
    return response
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean }

    const storedRefreshToken = useAuthStore.getState().refreshToken
    const storedAccessToken = useAuthStore.getState().accessToken

    // Only attempt refresh on 401 if user was actually authenticated
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/login") &&
      !originalRequest.url?.includes("/auth/refresh") &&
      (storedRefreshToken || storedAccessToken)
    ) {
      originalRequest._retry = true

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push((newToken: string) => {
            if (newToken) {
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${newToken}`
              }
              resolve(apiClient(originalRequest))
            } else {
              reject(error)
            }
          })
        })
      }

      isRefreshing = true

      try {
        const refreshUrl = `${import.meta.env.VITE_API_URL || "/api"}/auth/refresh`
        const storedRefreshToken = useAuthStore.getState().refreshToken

        // Send refresh token both via body and via cookie (cross-origin compatibility)
        const { data: refreshRes } = await axios.post(
          refreshUrl,
          { refreshToken: storedRefreshToken },
          {
            withCredentials: true,
            headers: storedRefreshToken ? { "x-refresh-token": storedRefreshToken } : {},
          }
        )

        const newToken = refreshRes?.data?.accessToken || refreshRes?.accessToken
        const newRefreshToken = refreshRes?.data?.refreshToken || refreshRes?.refreshToken || storedRefreshToken

        if (newToken) {
          const currentUser = useAuthStore.getState().user
          if (currentUser) {
            useAuthStore.getState().setAuth(currentUser, newToken, newRefreshToken)
          }

          refreshQueue.forEach((cb) => cb(newToken))
          refreshQueue = []

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`
          }
          return apiClient(originalRequest)
        } else {
          throw new Error("No token returned from refresh")
        }
      } catch (refreshErr) {
        refreshQueue.forEach((cb) => cb(""))
        refreshQueue = []

        // If refresh token is genuinely revoked or expired, clear session and redirect to login
        if (
          typeof window !== "undefined" &&
          (window.location.pathname.startsWith("/dashboard") ||
            window.location.pathname.startsWith("/admin") ||
            window.location.pathname.startsWith("/notifications"))
        ) {
          useAuthStore.getState().clearAuth()
          window.location.href = "/login"
        }
        return Promise.reject(refreshErr)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

/** Helper to extract data cleanly from standardized API envelopes */
export function extractData<T>(response: { data: { data?: T } | T }): T {
  if (response.data && typeof response.data === "object" && "data" in response.data) {
    return (response.data as { data: T }).data
  }
  return response.data as T
}
