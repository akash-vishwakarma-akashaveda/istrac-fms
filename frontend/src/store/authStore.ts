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
  setAuth: (user: User, accessToken: string) => void
  updateUser: (patch: Partial<User>) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,

      setAuth: (user, accessToken) =>
        set({
          user,
          accessToken,
        }),

      updateUser: (patch) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...patch } : null,
        })),

      clearAuth: () =>
        set({
          user: null,
          accessToken: null,
        }),
    }),
    {
      name: "istrac-auth-session",
      storage: createJSONStorage(() => localStorage),
      // Persist user and accessToken in localStorage so browser refreshes preserve active session & navigation route
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
      }),
    }
  )
)
