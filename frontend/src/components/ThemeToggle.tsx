import { Moon, Sun } from 'lucide-react'
import { useThemeStore } from '../store/themeStore'

export function ThemeToggle({ className = '' }: { className?: string }) {
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border-default text-text-secondary transition-colors hover:bg-card-hover hover:text-text-primary ${className}`}
    >
      {theme === 'dark' ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
    </button>
  )
}
