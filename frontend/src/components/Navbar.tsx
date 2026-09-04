import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  Menu,
  X,
  Search,
  ChevronDown,
  LogIn,
  UserPlus,
  UserCheck,
  Layers,
  Home,
  Calendar,
  Info,
  Headphones,
  Radio,
  Bell,
  LogOut,
} from "lucide-react"
import { useAuthStore } from "../store/authStore"
import { useNotificationStore } from "../store/notificationStore"
import { useAuthModalStore } from "../store/authModalStore"
import { useToastStore } from "../store/toastStore"
import { authApi } from "../api/auth.api"
import { wsClient } from "../lib/ws"
import { departmentsApi, type Department } from "../api/departments.api"
import { Button } from "."
import { SearchModal } from "./SearchModal"
import { useCms } from "../context/cmsContext"

interface NavBlockContent {
  brandTitle?: string
  brandHighlight?: string
  brandSubtitle?: string
  homeLabel?: string
  departmentsLabel?: string
  calendarLabel?: string
  aboutLabel?: string
  contactLabel?: string
  showSearchButton?: boolean
  showAuthButton?: boolean
}

export function Navbar() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const { addToast } = useToastStore()
  const { openLogin, openRegister } = useAuthModalStore()
  const { cmsBlocks } = useCms()

  async function handleLogout() {
    try {
      await authApi.logout()
      addToast({ message: "Signed out successfully", variant: "success" })
    } catch (error) {
      console.error("Logout API error:", error)
      addToast({ message: "Session signed out", variant: "info" })
    } finally {
      clearAuth()
      wsClient.disconnect()
      navigate("/login")
    }
  }

  const navData =
    (cmsBlocks["nav_header"] as NavBlockContent | undefined) ||
    (cmsBlocks["nav_footer"] as NavBlockContent | undefined)

  const brandTitle = navData?.brandTitle || "ISTRAC"
  const brandHighlight = navData?.brandHighlight !== undefined ? navData.brandHighlight : "-SIMS"
  const brandSubtitle = navData?.brandSubtitle || "ISRO Ground Network"
  const homeLabel = navData?.homeLabel || "Home"
  const departmentsLabel = navData?.departmentsLabel || "Departments"
  const calendarLabel = navData?.calendarLabel || "Calendar & Passes"
  const aboutLabel = navData?.aboutLabel || "About"
  const contactLabel = navData?.contactLabel || "Contact"
  const showSearchButton = navData?.showSearchButton !== false
  const showAuthButton = navData?.showAuthButton !== false

  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [deptOpen, setDeptOpen] = useState(false)
  const [mobileDeptOpen, setMobileDeptOpen] = useState(false)
  const [departments, setDepartments] = useState<Department[]>([])

  useEffect(() => {
    departmentsApi
      .getPublicDepartments()
      .then((data) => setDepartments(data || []))
      .catch(() => {})
  }, [])

  // Lock background scroll when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [mobileOpen])

  return (
    <>
      <header className="sticky top-0 z-[100] border-b border-border-subtle bg-[#050811]/95 backdrop-blur-xl transition-all shadow-md">
        <nav
          className="shell flex h-16 items-center justify-between gap-3 px-4 sm:px-6"
          aria-label="Main navigation"
        >
          {/* Brand Identity */}
          <Link
            to="/"
            className="group flex shrink-0 items-center gap-2.5 sm:gap-3 text-text-primary"
            aria-label="ISTRAC-SIMS home"
          >
            <img
              src="/logo/isro_logo.svg"
              alt="ISRO Logo"
              className="h-9 sm:h-11 w-auto object-contain shrink-0 transition-transform duration-200 group-hover:scale-105"
            />

            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-wider uppercase leading-tight sm:text-base">
                {brandTitle}
                <span className="text-accent-light">{brandHighlight}</span>
              </span>
              <span className="text-[9px] sm:text-[10px] text-text-dim uppercase tracking-widest truncate max-w-[140px] sm:max-w-none">
                {brandSubtitle}
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <div className="hidden h-full items-center gap-1 md:flex">
            <a
              href="/#hero"
              className="eyebrow flex h-full items-center px-3.5 text-text-muted transition-colors hover:text-text-primary"
            >
              {homeLabel}
            </a>

            {/* Departments Dropdown */}
            <div
              className="relative h-full flex items-center"
              onMouseLeave={() => setDeptOpen(false)}
            >
              <button
                type="button"
                onClick={() => setDeptOpen((prev) => !prev)}
                onMouseEnter={() => setDeptOpen(true)}
                className="eyebrow flex h-full items-center gap-1 px-3.5 text-text-muted transition-colors hover:text-text-primary cursor-pointer"
              >
                <span>{departmentsLabel}</span>
                <ChevronDown
                  size={12}
                  className={`transition-transform duration-150 ${
                    deptOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {deptOpen && (
                <div className="absolute top-full left-0 w-72 rounded-xl border border-border-default bg-[#0b1220] shadow-2xl p-2 z-50 animate-rise backdrop-blur-xl">
                  <div className="px-3 py-2 border-b border-border-subtle text-[10px] uppercase font-bold text-text-dim flex items-center justify-between">
                    <span>ISTRAC Divisions</span>
                    <span className="text-accent-light num">{departments.length} Units</span>
                  </div>
                  <div className="py-1 max-h-64 overflow-y-auto space-y-0.5">
                    {departments.map((dept) => (
                      <Link
                        key={dept.id}
                        to={`/departments/${dept.id}`}
                        onClick={() => setDeptOpen(false)}
                        className="flex items-center justify-between rounded-lg px-3 py-2 text-xs text-text-secondary hover:bg-accent/15 hover:text-white transition-all group"
                      >
                        <span className="truncate font-medium group-hover:translate-x-0.5 transition-transform">
                          {dept.name}
                        </span>
                        {dept.code && (
                          <span className="num text-[10px] text-accent-light rounded bg-surface px-1.5 py-0.5 border border-border-subtle shrink-0">
                            {dept.code}
                          </span>
                        )}
                      </Link>
                    ))}
                    {departments.length === 0 && (
                      <div className="px-3 py-3 text-xs text-text-dim text-center">
                        No departments listed.
                      </div>
                    )}
                  </div>
                  <div className="border-t border-border-subtle pt-1.5">
                    <Link
                      to="/departments"
                      onClick={() => setDeptOpen(false)}
                      className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-accent-light hover:bg-accent/10 hover:text-white transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        <Layers size={13} />
                        <span>Explore All Divisions</span>
                      </span>
                      <span>→</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <a
              href="/#calendar"
              className="eyebrow flex h-full items-center px-3.5 text-text-muted transition-colors hover:text-text-primary"
            >
              {calendarLabel}
            </a>

            <a
              href="/#about"
              className="eyebrow flex h-full items-center px-3.5 text-text-muted transition-colors hover:text-text-primary"
            >
              {aboutLabel}
            </a>

            <a
              href="/#contact"
              className="eyebrow flex h-full items-center px-3.5 text-text-muted transition-colors hover:text-text-primary"
            >
              {contactLabel}
            </a>
          </div>

          {/* Desktop Right Actions */}
          <div className="hidden items-center gap-3 md:flex">
            {showSearchButton && (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="flex items-center gap-2 rounded-xl border border-border-default bg-[#070c18] px-3 py-1.5 text-xs text-text-muted hover:border-accent/50 hover:text-text-primary transition-all cursor-pointer shadow-inner"
              >
                <Search size={13} className="text-accent-light" />
                <span>Search Repository</span>
                <kbd className="num rounded bg-card px-1.5 py-0.5 text-[10px] text-text-dim border border-border-subtle font-mono">
                  Ctrl K
                </kbd>
              </button>
            )}

            {showAuthButton && (
              user ? (
                <div className="flex items-center gap-2">
                  <Link
                    to="/notifications"
                    className="relative flex h-8 w-8 items-center justify-center rounded-xl border border-border-default bg-[#070c18] text-text-muted hover:border-accent/50 hover:text-white transition-all shadow-inner"
                    title="Mission Notifications & Alerts"
                  >
                    <Bell size={14} className={unreadCount > 0 ? "text-accent-light animate-pulse" : ""} />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-critical px-1 text-[9px] font-bold text-white shadow-sm ring-2 ring-[#050811]">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </Link>

                  <Link to="/app">
                    <Button
                      variant="primary"
                      size="sm"
                      className="gap-1.5 shadow-sm shadow-accent/20 font-semibold"
                    >
                      <UserCheck size={14} />
                      <span>Mission Console</span>
                    </Button>
                  </Link>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLogout}
                    className="gap-1.5 border-border-default bg-[#070c18] text-text-secondary hover:border-critical/60 hover:text-critical font-semibold cursor-pointer shadow-inner transition-colors"
                    title="Sign Out Session"
                  >
                    <LogOut size={13} className="text-critical/90" />
                    <span>Logout</span>
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openRegister}
                    className="gap-1.5 font-semibold text-text-secondary hover:text-white hover:border-accent/50 cursor-pointer"
                  >
                    <UserPlus size={14} className="text-accent-light" />
                    <span>Request Access</span>
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={openLogin}
                    className="gap-1.5 shadow-sm shadow-accent/20 font-semibold cursor-pointer"
                  >
                    <LogIn size={14} />
                    <span>Portal Sign In</span>
                  </Button>
                </div>
              )
            )}
          </div>

          {/* Mobile Actions: Search Icon + Logout (if logged in) + Hamburger Toggle */}
          <div className="flex items-center gap-1.5 md:hidden">
            {showSearchButton && (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-border-subtle bg-surface/80 text-text-secondary hover:border-accent/50 hover:text-white transition-colors cursor-pointer"
                aria-label="Search"
              >
                <Search size={18} />
              </button>
            )}

            {user && (
              <button
                type="button"
                onClick={handleLogout}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-border-subtle bg-surface/80 text-text-secondary hover:border-critical/60 hover:text-critical transition-colors cursor-pointer"
                title="Logout"
                aria-label="Logout"
              >
                <LogOut size={17} className="text-critical" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border-subtle bg-surface/80 text-text-secondary hover:border-accent/50 hover:text-white transition-colors cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileOpen ? <X size={20} className="text-accent-light" /> : <Menu size={20} />}
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile Full-Screen Navigation Drawer (Outside Header to eliminate overflow & stacking context clipping) */}
      {mobileOpen && (
        <div className="fixed inset-0 top-16 z-[999] bg-[#040711]/98 backdrop-blur-2xl md:hidden overflow-y-auto animate-fade-in flex flex-col justify-between p-5 space-y-6">
          <div className="space-y-4">
            {/* Quick Search Bar in Mobile Menu */}
            {showSearchButton && (
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false)
                  setSearchOpen(true)
                }}
                className="flex w-full items-center justify-between rounded-xl border border-border-default bg-[#0b1220] p-3.5 text-xs text-text-muted hover:border-accent/50 hover:text-white transition-all shadow-inner cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <Search size={16} className="text-accent-light" />
                  <span>Search telemetry records & files…</span>
                </span>
                <span className="num text-[10px] text-text-dim bg-surface px-2 py-0.5 rounded border border-border-subtle">
                  Search
                </span>
              </button>
            )}

            {/* Navigation Items */}
            <div className="space-y-1 rounded-2xl border border-border-default bg-[#070c18] p-2">
              <a
                href="/#hero"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold text-text-primary hover:bg-accent/15 hover:text-accent-light transition-all"
              >
                <Home size={16} className="text-accent-light shrink-0" />
                <span>{homeLabel}</span>
              </a>

              {/* Mobile Expandable Departments Section */}
              <div>
                <button
                  type="button"
                  onClick={() => setMobileDeptOpen(!mobileDeptOpen)}
                  className="flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-sm font-semibold text-text-primary hover:bg-accent/15 hover:text-accent-light transition-all cursor-pointer"
                >
                  <span className="flex items-center gap-3">
                    <Layers size={16} className="text-accent-light shrink-0" />
                    <span>{departmentsLabel}</span>
                  </span>
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 text-text-dim ${
                      mobileDeptOpen ? "rotate-180 text-accent-light" : ""
                    }`}
                  />
                </button>

                {mobileDeptOpen && (
                  <div className="mx-2 mb-2 rounded-xl border border-border-subtle bg-[#0b1220] p-2 space-y-1 animate-fade-in">
                    {departments.map((dept) => (
                      <Link
                        key={dept.id}
                        to={`/departments/${dept.id}`}
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center justify-between rounded-lg px-3 py-2 text-xs text-text-secondary hover:bg-card-hover hover:text-white transition-colors"
                      >
                        <span className="truncate">{dept.name}</span>
                        {dept.code && (
                          <span className="num text-[10px] text-accent-light bg-surface px-1.5 py-0.5 rounded border border-border-subtle">
                            {dept.code}
                          </span>
                        )}
                      </Link>
                    ))}
                    <Link
                      to="/departments"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-bold text-accent-light hover:bg-accent/10 transition-colors pt-2 border-t border-border-subtle"
                    >
                      <span>View All Divisions Directory</span>
                      <span>→</span>
                    </Link>
                  </div>
                )}
              </div>

              <a
                href="/#calendar"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold text-text-primary hover:bg-accent/15 hover:text-accent-light transition-all"
              >
                <Calendar size={16} className="text-accent-light shrink-0" />
                <span>{calendarLabel}</span>
              </a>

              <a
                href="/#about"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold text-text-primary hover:bg-accent/15 hover:text-accent-light transition-all"
              >
                <Info size={16} className="text-accent-light shrink-0" />
                <span>{aboutLabel}</span>
              </a>

              <a
                href="/#contact"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold text-text-primary hover:bg-accent/15 hover:text-accent-light transition-all"
              >
                <Headphones size={16} className="text-accent-light shrink-0" />
                <span>{contactLabel}</span>
              </a>
            </div>
          </div>

          {/* Mobile Footer & Auth Button */}
          <div className="space-y-4 pt-4 border-t border-border-subtle">
            {showAuthButton && (
              <div>
                {user ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between rounded-xl border border-border-default bg-[#0b1220] p-3 text-xs">
                      <div className="truncate pr-2">
                        <div className="font-bold text-text-primary truncate">{user.name}</div>
                        <div className="num text-[10px] text-text-dim font-mono truncate">{user.email}</div>
                      </div>
                      <span className="rounded bg-accent/20 border border-accent/30 px-2 py-0.5 text-[9px] font-bold uppercase num text-accent-light shrink-0">
                        {user.role}
                      </span>
                    </div>

                    <Link to="/app" onClick={() => setMobileOpen(false)}>
                      <Button variant="primary" size="lg" className="w-full justify-center gap-2 shadow-lg shadow-accent/20">
                        <UserCheck size={16} />
                        <span>Launch Mission Console</span>
                      </Button>
                    </Link>

                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => {
                        setMobileOpen(false)
                        handleLogout()
                      }}
                      className="w-full justify-center gap-2 border-border-default text-text-secondary hover:border-critical/60 hover:text-critical cursor-pointer"
                    >
                      <LogOut size={16} className="text-critical" />
                      <span>Sign Out / Logout</span>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Button
                      variant="primary"
                      size="lg"
                      onClick={() => {
                        setMobileOpen(false)
                        openLogin()
                      }}
                      className="w-full justify-center gap-2 shadow-lg shadow-accent/20 cursor-pointer"
                    >
                      <LogIn size={16} />
                      <span>Sign In to Mission Portal</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => {
                        setMobileOpen(false)
                        openRegister()
                      }}
                      className="w-full justify-center gap-2 border-border-default hover:border-accent/50 cursor-pointer"
                    >
                      <UserPlus size={16} className="text-accent-light" />
                      <span>Request Operational Access</span>
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Status pill in mobile drawer */}
            <div className="flex items-center justify-between text-[11px] text-text-dim px-1">
              <span className="flex items-center gap-1.5 text-nominal">
                <Radio size={12} className="animate-pulse" /> 24/7 Ops Active
              </span>
              <span>MOX Bengaluru · ISRO</span>
            </div>
          </div>
        </div>
      )}

      {/* Global Search Modal */}
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
