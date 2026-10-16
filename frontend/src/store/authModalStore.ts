import { create } from 'zustand'

export type AuthMode = 'login' | 'register'

interface AuthModalState {
  isOpen: boolean
  mode: AuthMode
  openLogin: () => void
  openRegister: () => void
  setMode: (mode: AuthMode) => void
  closeModal: () => void
}

export const useAuthModalStore = create<AuthModalState>((set) => ({
  isOpen: false,
  mode: 'login',
  openLogin: () => set({ isOpen: true, mode: 'login' }),
  openRegister: () => set({ isOpen: true, mode: 'register' }),
  setMode: (mode) => set({ mode }),
  closeModal: () => set({ isOpen: false }),
}))
