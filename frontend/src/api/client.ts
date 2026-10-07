import axios, { type AxiosError, type AxiosRequestConfig } from "axios"
import { useAuthStore } from "../store/authStore"

const apiUrl = import.meta.env.VITE_API_URL || "/api"

export const apiClient = axios.create({
  baseURL: apiUrl,
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
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  return config
})

// In-flight refresh lock to avoid stampede on multiple simultaneous 401s
let isRefreshing = false
let refreshQueue: Array<(token: string) => void> = []

apiClient.interceptors.response.use(
  (response) => {
    // Detect when an API endpoint returned an HTML document (e.g. Nginx SPA fallback or 502/404 HTML)
    if (
      typeof response.data === 'string' &&
      (response.data.trim().startsWith('<!doctype') ||
        response.data.trim().startsWith('<!DOCTYPE') ||
        response.data.trim().startsWith('<html'))
    ) {
      const error = new Error(
        `API endpoint returned HTML instead of JSON (${response.config.url || 'unknown'}). Ensure backend service is running and reverse proxy is active.`
      )
      return Promise.reject(error)
    }
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
      !originalRequest.url?.includes("/auth/logout") &&
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
          const refreshedUser = refreshRes?.data?.user || refreshRes?.user || useAuthStore.getState().user
          if (refreshedUser) {
            useAuthStore.getState().setAuth(refreshedUser, newToken, newRefreshToken)
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

        // If refresh token is genuinely revoked or expired, clear session and log out
        const wasAuthenticated = !!useAuthStore.getState().user
        if (wasAuthenticated) {
          useAuthStore.getState().clearAuth()
          if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
            window.location.href = "/login?session_expired=true"
          }
        }
        return Promise.reject(refreshErr)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(normalizeError(error))
  }
)

const STATUS_MESSAGES: Record<number, string> = {
  401: 'Your session has expired. Please sign in again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested item could not be found. It may have been moved or deleted.',
  413: 'The file is too large to upload.',
  429: 'Too many requests. Please wait a moment and try again.',
  502: 'The server is temporarily unavailable. Please try again shortly.',
  503: 'The server is temporarily unavailable. Please try again shortly.',
  504: 'The server took too long to respond. Please try again.',
}

/**
 * Guarantees every rejected request carries a readable message at
 * `error.response.data.error.message` (what the UI already reads) and `error.message`.
 */
function normalizeError(error: AxiosError<any>): AxiosError<any> {
  if (!error.response) {
    error.message =
      error.code === 'ECONNABORTED'
        ? 'The request timed out. Check your connection and try again.'
        : 'Cannot reach the server. Check your network connection and try again.'
    return error
  }
  const data = error.response.data
  const existing = data && typeof data === 'object' ? data.error?.message : undefined
  const message =
    existing ||
    STATUS_MESSAGES[error.response.status] ||
    (error.response.status >= 500
      ? 'Something went wrong on the server. Please try again.'
      : 'The request could not be completed. Please check your input and try again.')
  if (!existing) {
    error.response.data = {
      ...(data && typeof data === 'object' ? data : {}),
      error: { code: data?.error?.code || `http_${error.response.status}`, message },
    }
  }
  error.message = message
  return error
}

/** Readable message for any thrown value; use the fallback only for non-request errors. */
export function getErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const e = err as AxiosError<any> | undefined
  return e?.response?.data?.error?.message || (e?.isAxiosError ? e.message : '') || fallback
}

/** Helper to extract data cleanly from standardized API envelopes */
export function extractData<T>(response: { data: { data?: T } | T }): T {
  if (response.data && typeof response.data === "object" && "data" in response.data) {
    return (response.data as { data: T }).data
  }
  return response.data as T
}
