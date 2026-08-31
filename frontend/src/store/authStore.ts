import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

export interface User {
  id: string
  name: string
  designation?: string | null
  email: string
  employeeId?: string | null
  phone?: string | null
  role: "ADMIN" | "MEMBER"
  tempPass?: boolean
  departmentPreference?: string | null
  reasonForAccess?: string | null
  departmentAccess?: Array<{
    department?: {
      id: string
      name: string
      code?: string
    }
    accessLevel?: string
  }>
}

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  setAuth: (user: User, accessToken: string, refreshToken?: string | null) => void
  updateUser: (patch: Partial<User>) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,

      setAuth: (user, accessToken, refreshToken) =>
        set((state) => ({
          user,
          accessToken,
          refreshToken: refreshToken !== undefined ? refreshToken : state.refreshToken,
        })),

      updateUser: (patch) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...patch } : null,
        })),

      clearAuth: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
        }),
    }),
    {
      name: "istrac-auth-session",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
)
