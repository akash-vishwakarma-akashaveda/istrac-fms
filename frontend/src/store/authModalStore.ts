import { create } from 'zustand'

export type AuthMode = 'login' | 'register' | 'reset'

interface AuthModalState {
  isOpen: boolean
  mode: AuthMode
  prefillEmail?: string
  openLogin: (emailOrEvent?: string | unknown) => void
  openRegister: () => void
  openReset: (emailOrEvent?: string | unknown) => void
  setMode: (mode: AuthMode) => void
  setPrefillEmail: (email?: string) => void
  closeModal: () => void
}

export const useAuthModalStore = create<AuthModalState>((set) => ({
  isOpen: false,
  mode: 'login',
  prefillEmail: undefined,
  openLogin: (emailOrEvent?: unknown) =>
    set({
      isOpen: true,
      mode: 'login',
      prefillEmail: typeof emailOrEvent === 'string' ? emailOrEvent : undefined,
    }),
  openRegister: () => set({ isOpen: true, mode: 'register' }),
  openReset: (emailOrEvent?: unknown) =>
    set({
      isOpen: true,
      mode: 'reset',
      prefillEmail: typeof emailOrEvent === 'string' ? emailOrEvent : undefined,
    }),
  setMode: (mode) => set({ mode }),
  setPrefillEmail: (email) => set({ prefillEmail: email }),
  closeModal: () => set({ isOpen: false }),
}))
