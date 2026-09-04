import { useEffect, useState } from 'react'
import {
  Bell,
  ChevronDown,
  LogOut,
  Home,
  User,
  Key,
  ExternalLink,
} from 'lucide-react'
import { useNavigate, Link } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'
import { useNotificationStore } from '../store/notificationStore'
import { Avatar, UserProfileModal } from '../components'
import { useNotifications } from '../hooks/useNotifications'
import { wsClient } from '../lib/ws'
import { useToastStore } from '../store/toastStore'
import { authApi } from '../api'
import { useCms } from '../context/cmsContext'

/** Vertical hairline between readout fields. */
function FieldDivider() {
  return <span aria-hidden="true" className="h-4 w-px shrink-0 bg-border-subtle" />
}

export function Topbar() {
  const navigate = useNavigate()

  const user = useAuthStore((state) => state.user)
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const unreadCount = useNotificationStore((state) => state.unreadCount)
  const { addToast } = useToastStore()
  const { cmsBlocks } = useCms()

  const navData =
    (cmsBlocks['nav_header'] as any) ||
    (cmsBlocks['nav_footer'] as any)

  const brandTitle = navData?.brandTitle || 'ISTRAC'
  const brandHighlight = navData?.brandHighlight !== undefined ? navData.brandHighlight : '-SIMS'
  const brandSubtitle = navData?.brandSubtitle || 'ISRO Ground Network'

  const [menuOpen, setMenuOpen] = useState(false)
  const [bellMenuOpen, setBellMenuOpen] = useState(false)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [utcTime, setUtcTime] = useState('')
  const { data } = useNotifications()
  const recentFive: any[] =
    data?.pages && data.pages.length > 0 ? (data.pages[0].data?.slice(0, 5) ?? []) : []

  useEffect(() => {
    function updateTime() {
      // Full UTC stamp — the form every mission log is written in.
      setUtcTime(new Date().toISOString().slice(0, 19).replace('T', ' '))
    }

    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  async function handleLogout() {
    try {
      await authApi.logout()
    } catch (error) {
      addToast({ message: 'failed to logout', title: 'error', variant: 'warning' })
      console.error('Logout API error:', error)
    } finally {
      clearAuth()
      wsClient.disconnect()
      setMenuOpen(false)
      navigate('/login')
    }
  }

  function handleNotifications() {
    navigate('/notifications')
  }

  function toggleMenu() {
    setMenuOpen((current) => !current)
  }

  return (
    <>
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
            <span className="text-text-secondary font-bold">{user?.role ?? '—'}</span>
          </span>

          <FieldDivider />

          <span
            className="readout hidden md:inline-flex text-white font-bold truncate cursor-default"
            title={brandSubtitle}
          >
            {brandTitle}
            <span className="text-accent-light">{brandHighlight}</span>
            {brandSubtitle && (
              <span className="ml-1.5 font-normal text-text-dim text-[10px] hidden lg:inline">
                · {brandSubtitle}
              </span>
            )}
          </span>
        </div>

        {/* Controls */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Back to Home / Public Portal Button */}
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-[#080e1b] px-3 py-1.5 text-xs font-semibold text-text-secondary hover:border-accent hover:text-white transition-all shadow-sm group"
            title={`Return to ${brandTitle}${brandHighlight} Public Portal Homepage`}
          >
            <Home size={14} className="text-accent-light group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline">Back to Home</span>
          </Link>

          <FieldDivider />

          {/* Notifications */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setBellMenuOpen((v) => !v)}
              className="relative rounded-lg p-2 text-text-muted transition-colors duration-150 hover:bg-card-hover hover:text-text-primary border border-transparent hover:border-border-default"
              aria-label={
                unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
              }
              aria-haspopup="menu"
              aria-expanded={bellMenuOpen}
            >
              <Bell size={16} strokeWidth={1.8} />

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
                  className="absolute top-full right-0 z-20 mt-2 w-80 overflow-hidden rounded-xl border border-border-default bg-card shadow-2xl animate-fadeIn"
                  role="menu"
                >
                  <div className="flex items-center justify-between border-b border-border-subtle bg-surface px-3.5 py-2.5">
                    <span className="eyebrow text-text-secondary font-bold text-xs">
                      Live Transmissions
                    </span>

                    {unreadCount > 0 && (
                      <span className="num text-[10px] text-accent-light font-bold rounded-full bg-accent/20 px-2 py-0.5">
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
                      className={`border-b border-border-subtle border-l-2 px-3.5 py-2.5 text-[12px] leading-relaxed last:border-b-0 ${
                        n.readAt
                          ? 'border-l-transparent text-text-muted'
                          : 'border-l-accent text-text-primary bg-accent/[0.04]'
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
                    View all notifications
                  </button>
                </div>
              </>
            )}
          </div>

          <FieldDivider />

          {/* User Profile & Session Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={toggleMenu}
              className="flex items-center gap-2.5 rounded-lg py-1 pr-2 pl-1.5 transition-colors duration-150 hover:bg-card-hover border border-transparent hover:border-border-default"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <Avatar name={user?.name ?? '?'} size="sm" />

              <div className="hidden text-left sm:block">
                <span className="block text-xs font-bold leading-tight text-text-primary">
                  {user?.name}
                </span>
                <span className="num block text-[10px] leading-tight text-text-dim">
                  {user?.role} · {user?.employeeId || 'ISRO'}
                </span>
              </div>

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
                  className="absolute top-full right-0 z-20 mt-2 w-60 overflow-hidden rounded-xl border border-border-default bg-card shadow-2xl animate-fadeIn divide-y divide-border-subtle"
                  role="menu"
                >
                  {/* User Bio Header */}
                  <div className="bg-surface/80 px-3.5 py-3 space-y-1">
                    <p className="truncate text-xs font-bold text-white">{user?.name}</p>
                    <p className="num truncate text-[10px] text-text-dim font-mono">
                      {user?.email}
                    </p>
                    <div className="flex items-center gap-1.5 pt-1">
                      <span className="rounded bg-accent/20 border border-accent/30 px-1.5 py-0.2 text-[9px] font-bold uppercase num text-accent-light">
                        {user?.role}
                      </span>
                      {user?.employeeId && (
                        <span className="rounded bg-surface border border-border-subtle px-1.5 py-0.2 text-[9px] font-mono text-text-dim">
                          {user.employeeId}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="p-1.5 space-y-0.5">
                    {/* User Profile & Clearances */}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false)
                        setIsProfileModalOpen(true)
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-semibold text-text-primary rounded-lg transition-colors duration-150 hover:bg-card-hover hover:text-accent-light"
                    >
                      <User size={14} className="text-accent-light" />
                      <span>Officer Profile & Clearances</span>
                    </button>

                    {/* Change Password */}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false)
                        setIsProfileModalOpen(true)
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-semibold text-text-primary rounded-lg transition-colors duration-150 hover:bg-card-hover hover:text-accent-light"
                    >
                      <Key size={14} className="text-yellow-400" />
                      <span>Change Password & Security</span>
                    </button>

                    {/* Return to Public Portal */}
                    <Link
                      to="/"
                      onClick={() => setMenuOpen(false)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold text-text-secondary rounded-lg transition-colors duration-150 hover:bg-card-hover hover:text-white"
                    >
                      <span className="flex items-center gap-2.5">
                        <Home size={14} className="text-nominal" />
                        <span>Public Portal Homepage</span>
                      </span>
                      <ExternalLink size={11} className="text-text-dim" />
                    </Link>
                  </div>

                  {/* Logout */}
                  <div className="p-1.5">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-bold text-critical rounded-lg transition-colors duration-150 hover:bg-critical/10"
                    >
                      <LogOut size={14} strokeWidth={2} />
                      <span>Sign Out Session</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Global Officer Dossier & Security Profile Modal */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </>
  )
}
