import { useEffect, useState } from 'react'
import { Bell, ChevronDown, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'
import { useNotificationStore } from '../store/notificationStore'
import { Avatar } from '../components'
import { useNotifications } from '../hooks/useNotifications'

/** Vertical hairline between readout fields. */
function FieldDivider() {
  return <span aria-hidden="true" className="h-4 w-px shrink-0 bg-border-subtle" />
}

export function Topbar() {
  const navigate = useNavigate()

  const user = useAuthStore((state) => state.user)
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const unreadCount = useNotificationStore((state) => state.unreadCount)

  const [menuOpen, setMenuOpen] = useState(false)
  const [bellMenuOpen, setBellMenuOpen] = useState(false)
  const [utcTime, setUtcTime] = useState('')
  const { data } = useNotifications()
  const recentFive: any[] = data?.pages && data.pages.length > 0 ? (data.pages[0].data?.slice(0, 5) ?? []) : []

  useEffect(() => {
    function updateTime() {
      // Full UTC stamp — the form every mission log is written in.
      setUtcTime(new Date().toISOString().slice(0, 19).replace('T', ' '))
    }

    updateTime()

    const interval = setInterval(updateTime, 1000)

    return () => clearInterval(interval)
  }, [])

  function handleLogout() {
    clearAuth()
    setMenuOpen(false)
    navigate('/login')
  }

  function handleNotifications() {
    navigate('/notifications')
  }

  function toggleMenu() {
    setMenuOpen((current) => !current)
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border-subtle bg-surface px-4">
      {/* Readout strip — everything here is machine-produced, so it's all mono. */}
      <div className="flex min-w-0 items-center gap-3">
        <span className="readout text-text-secondary">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-nominal animate-tick"
          />
          <span className="truncate">{utcTime}</span>
          <span className="text-text-dim">UTC</span>
        </span>

        <FieldDivider />

        <span className="readout hidden text-text-dim sm:inline-flex">
          ACCESS
          <span className="text-text-secondary">{user?.role ?? '—'}</span>
        </span>
      </div>

      {/* Controls */}
      <div className="flex shrink-0 items-center gap-1.5">
        {/* Notifications */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setBellMenuOpen((v) => !v)}
            className="relative rounded-md p-2 text-text-muted transition-colors duration-150 hover:bg-card-hover hover:text-text-primary"
            aria-label={
              unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
            }
            aria-haspopup="menu"
            aria-expanded={bellMenuOpen}
          >
            <Bell size={17} strokeWidth={1.8} />

            {unreadCount > 0 && (
              <span className="num absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-critical px-1 text-[9px] leading-none text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {bellMenuOpen && (
            <>
              <button
                type="button"
                aria-label="Close notifications"
                className="fixed inset-0 z-10 cursor-default"
                onClick={() => setBellMenuOpen(false)}
              />

              <div
                className="absolute top-full right-0 z-20 mt-2 w-80 overflow-hidden rounded-lg border border-border-default bg-card shadow-xl"
                role="menu"
              >
                <div className="flex items-center justify-between border-b border-border-subtle bg-surface px-3 py-2.5">
                  <span className="eyebrow text-text-secondary">Notifications</span>

                  {unreadCount > 0 && (
                    <span className="num text-[10px] text-text-dim">
                      {unreadCount} unread
                    </span>
                  )}
                </div>

                {recentFive.length === 0 && (
                  <p className="px-3 py-6 text-center text-xs text-text-muted">
                    Nothing yet. Activity on your files will show up here.
                  </p>
                )}

                {recentFive.map((n) => (
                  <div
                    key={n.id}
                    className={`border-b border-border-subtle border-l-2 px-3 py-2.5 text-[13px] leading-5 last:border-b-0 ${
                      n.readAt
                        ? 'border-l-transparent text-text-muted'
                        : 'border-l-accent text-text-secondary'
                    }`}
                  >
                    {n.message}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    setBellMenuOpen(false)
                    handleNotifications()
                  }}
                  className="w-full border-t border-border-subtle bg-surface py-2.5 text-center text-[11px] font-bold tracking-[0.06em] text-accent-light uppercase transition-colors duration-150 hover:bg-card-hover"
                >
                  View all
                </button>
              </div>
            </>
          )}
        </div>

        <span aria-hidden="true" className="mx-1 h-5 w-px bg-border-subtle" />

        {/* Session */}
        <div className="relative">
          <button
            type="button"
            onClick={toggleMenu}
            className="flex items-center gap-2 rounded-md py-1 pr-1.5 pl-1 transition-colors duration-150 hover:bg-card-hover"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <Avatar name={user?.name ?? '?'} size="sm" />

            <span className="hidden text-left sm:block">
              <span className="block text-xs leading-tight text-text-primary">
                {user?.name}
              </span>
              <span className="num block text-[10px] leading-tight text-text-dim">
                {user?.role}
              </span>
            </span>

            <ChevronDown size={13} className="shrink-0 text-text-dim" />
          </button>

          {menuOpen && (
            <>
              <button
                type="button"
                aria-label="Close user menu"
                className="fixed inset-0 z-10 cursor-default"
                onClick={() => setMenuOpen(false)}
              />

              <div
                className="absolute top-full right-0 z-20 mt-2 w-52 overflow-hidden rounded-lg border border-border-default bg-card shadow-xl"
                role="menu"
              >
                <div className="border-b border-border-subtle bg-surface px-3 py-2.5">
                  <p className="truncate text-xs text-text-primary">{user?.name}</p>
                  <p className="num mt-0.5 truncate text-[10px] text-text-dim">
                    {user?.email ?? user?.role}
                  </p>
                </div>

                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] text-text-secondary transition-colors duration-150 hover:bg-card-hover hover:text-critical"
                >
                  <LogOut size={14} strokeWidth={1.8} />
                  Log out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
