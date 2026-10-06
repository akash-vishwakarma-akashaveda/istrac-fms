import { create } from 'zustand'
import { uid } from '../lib/browserCompat'

export type ToastVariant = 'success' | 'info' | 'warning' | 'error'

interface Toast {
  id: string
  message: string
  title?: string
  variant: ToastVariant
  duration: number
  createdAt: number
  remainingOnPause: number // ms left when paused, used to resume correctly
  isPaused: boolean
}

interface ToastState {
  visible: Toast[]
  queue: Toast[]
  addToast: (opts: { message: string; title?: string; variant?: ToastVariant; duration?: number }) => void
  removeToast: (id: string) => void
  pauseToast: (id: string) => void
  resumeToast: (id: string) => void
}

const MAX_VISIBLE = 5

export const useToastStore = create<ToastState>((set, get) => ({
  visible: [],
  queue: [],

  addToast: ({ message, title, variant = 'info', duration = 5000 }) => {
    const toast: Toast = {
      id: uid(),
      message,
      title,
      variant,
      duration,
      createdAt: Date.now(),
      remainingOnPause: duration,
      isPaused: false,
    }

    const { visible, queue } = get()
    if (visible.length < MAX_VISIBLE) {
      set({ visible: [toast, ...visible] }) // newest on top, per FE-037 spec
    } else {
      set({ queue: [...queue, toast] }) // overflow queued
    }
  },

  removeToast: (id) => {
    set((s) => {
      const stillVisible = s.visible.filter((t) => t.id !== id)
      // Promote the next queued toast into the visible slot that just opened up
      if (s.queue.length > 0 && stillVisible.length < MAX_VISIBLE) {
        const [next, ...restQueue] = s.queue
        return { visible: [...stillVisible, { ...next, createdAt: Date.now() }], queue: restQueue }
      }
      return { visible: stillVisible }
    })
  },

  pauseToast: (id) => {
    set((s) => ({
      visible: s.visible.map((t) =>
        t.id === id && !t.isPaused
          ? { ...t, isPaused: true, remainingOnPause: t.duration - (Date.now() - t.createdAt) }
          : t
      ),
    }))
  },

  resumeToast: (id) => {
    set((s) => ({
      visible: s.visible.map((t) =>
        t.id === id ? { ...t, isPaused: false, createdAt: Date.now(), duration: t.remainingOnPause } : t
      ),
    }))
  },
}))