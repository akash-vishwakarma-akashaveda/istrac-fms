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
    id?: string
    departmentId?: string
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
  /** True after the user deliberately signs out; route guards then go to "/" instead of the login popup. */
  signedOutByUser: boolean
  setAuth: (user: User, accessToken: string, refreshToken?: string | null) => void
  updateUser: (patch: Partial<User>) => void
  clearAuth: () => void
  /** Clears the session because the user chose to sign out. */
  signOut: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      signedOutByUser: false,

      setAuth: (user, accessToken, refreshToken) =>
        set((state) => ({
          signedOutByUser: false,
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

      signOut: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          signedOutByUser: true,
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
