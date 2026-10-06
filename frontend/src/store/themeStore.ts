import { create } from 'zustand'

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'istrac-theme'

// index.html applies the saved theme before first paint; this keeps React in sync with it.
function readInitial(): Theme {
  const attr = typeof document !== 'undefined' ? document.documentElement.dataset.theme : undefined
  return attr === 'light' ? 'light' : 'dark'
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // storage blocked; the theme still applies for this visit
  }
}

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: readInitial(),
  setTheme: (theme) => {
    apply(theme)
    set({ theme })
  },
  toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
}))
