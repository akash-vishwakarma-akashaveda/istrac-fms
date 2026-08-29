import axios, { type AxiosError, type AxiosRequestConfig } from 'axios'
import { useAuthStore } from '../store/authStore'


const apiUrl = import.meta.env.VITE_API_URL

if (import.meta.env.PROD && !apiUrl) {
  throw new Error('VITE_API_URL must be set for production builds')
}

export const apiClient = axios.create({
  baseURL: apiUrl || '/api',
  withCredentials: true, // sends httpOnly refresh cookies automatically
  timeout:30_000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Attach current access token to every outgoing request
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    // Quick exp check without verification (server still validates signature)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      if (payload.exp && payload.exp * 1000 < Date.now() + 30_000) {
        // Token expires in <30s — proactively refresh before attaching
        // (only if not already refreshing)
      }
    } catch(intercepterr) { 
      Promise.reject(intercepterr)
    }
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
// In-flight refresh lock to avoid stampede on multiple simultaneous 401s
let isRefreshing = false
let refreshQueue: Array<(token: string) => void> = []

apiClient.interceptors.response.use(
  (response) => {
    // If response body is wrapped in { data: ..., requestId: ... }, unwrap if needed
    return response
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean }

    // Only attempt refresh on 401, not on auth routes themselves
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      originalRequest._retry = true

      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshQueue.push((newToken: string) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`
            }
            resolve(apiClient(originalRequest))
          })
        })
      }

      isRefreshing = true

      try {
        const refreshUrl = `${import.meta.env.VITE_API_URL || '/api'}/auth/refresh`
        const { data: refreshRes } = await axios.post(refreshUrl, {}, { withCredentials: true })

        const newToken = refreshRes?.data?.accessToken || refreshRes?.accessToken

        if (newToken) {
          const currentUser = useAuthStore.getState().user
          if (currentUser) {
            useAuthStore.getState().setAuth(currentUser, newToken)
          }

          refreshQueue.forEach((cb) => cb(newToken))
          refreshQueue = []

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`
          }
          return apiClient(originalRequest)
        }
      } catch (refreshErr) {
        useAuthStore.getState().clearAuth()
        refreshQueue = []
        if (
          typeof window !== 'undefined' &&
          (window.location.pathname.startsWith('/dashboard') ||
            window.location.pathname.startsWith('/admin'))
        ) {
          window.location.href = '/login'
        }
        return Promise.reject(refreshErr)
      } finally {
        isRefreshing = false
      }
    }

    if (error.response?.status === 403) {
  const user = useAuthStore.getState().user
  if (user?.role === 'ADMIN') {
    // Role may have been revoked — re-fetch profile
    useAuthStore.getState().clearAuth()
    window.location.href = '/login'
  }
}

    return Promise.reject(error)
  },
)

/** Helper to extract data cleanly from standardized API envelopes */
export function extractData<T>(response: { data: { data?: T } | T }): T {
  if (response.data && typeof response.data === 'object' && 'data' in response.data) {
    return (response.data as { data: T }).data
  }
  return response.data as T
}
