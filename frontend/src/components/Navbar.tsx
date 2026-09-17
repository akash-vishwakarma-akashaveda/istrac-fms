import { useState, useEffect, useRef } from "react"
import { Link, useNavigate, useLocation } from "react-router-dom"
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
import { usePublicDepartments } from "../hooks/useDepartments"
import { useActiveBanner } from "../hooks/useActiveBanner"
import { Button } from "."
import { SearchModal } from "./SearchModal"
import { NotificationsModal, type NotificationModalItem } from "./NotificationsModal"
import { notificationsApi } from "../api/notifications.api"
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

export interface NavbarProps {
  id?: string
  className?: string
}

export function Navbar({ id, className = "" }: NavbarProps = {}) {
  const navigate = useNavigate()
  const location = useLocation()
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
  const { data: deptsData } = usePublicDepartments()
  const departments = deptsData || []
  const { data: bannerData } = useActiveBanner()
  const [notifsModalOpen, setNotifsModalOpen] = useState(false)
  const [notificationsList, setNotificationsList] = useState<NotificationModalItem[]>([])

  useEffect(() => {
    async function loadNotifs() {
      try {
        const [publicNotifs, authNotifs] = await Promise.allSettled([
          notificationsApi.getPublicNotifications(),
          user ? notificationsApi.getNotifications({ limit: 50 }) : Promise.resolve({ data: [] }),
        ])

        const items: NotificationModalItem[] = []

        if (bannerData) {
          const { events, broadcasts } = bannerData
          events?.forEach((ev) => {
            items.push({
              id: ev.id,
              title: ev.title,
              message: ev.description ?? `${ev.location ?? ""} · ${new Date(ev.eventDate).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`,
              category: ev.eventType,
              type: ev.urgency,
              timestamp: new Date(ev.eventDate).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
            })
          })
          broadcasts?.forEach((bc) => {
            items.push({
              id: bc.id,
              message: bc.message,
              category: "BROADCAST",
              type: "IMPORTANT",
              timestamp: new Date(bc.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
            })
          })
        }

        if (publicNotifs.status === "fulfilled" && publicNotifs.value) {
          publicNotifs.value.forEach((pn: any) => {
            if (!items.some((x) => x.id === pn.id || x.message === pn.message)) {
              items.push({
                id: pn.id,
                message: pn.message,
                category: pn.category ?? "BROADCAST",
                type: pn.type ?? "NOTICE",
                createdAt: pn.createdAt,
              })
            }
          })
        }

        if (authNotifs.status === "fulfilled" && (authNotifs.value as any)?.data) {
          const personal = (authNotifs.value as any).data
          if (Array.isArray(personal)) {
            personal.forEach((pn: any) => {
              if (!items.some((x) => x.id === pn.id || x.message === pn.message)) {
                items.push({
                  id: pn.id,
                  message: pn.message,
                  category: pn.category ?? pn.type ?? "NOTICE",
                  type: pn.type ?? "SYSTEM",
                  createdAt: pn.createdAt,
                })
              }
            })
          }
        }

        setNotificationsList(items)
      } catch (err) {
        console.error("Failed to load notifications for navbar bell:", err)
      }
    }

    loadNotifs()
  }, [user, bannerData])

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

  const [activeSection, setActiveSection] = useState<string>("home")
  const isScrollingRef = useRef(false)
  const scrollTimeoutRef = useRef<number | null>(null)

  // Synchronize active section based on current route and scroll position
  useEffect(() => {
    if (location.pathname.startsWith("/departments")) {
      setActiveSection("departments")
      return
    }

    if (location.pathname !== "/") {
      setActiveSection("")
      return
    }

    const sectionIds = [
      { id: "contact", key: "contact" },
      { id: "about", key: "about" },
      { id: "calendar", key: "calendar" },
      { id: "departments-showcase", key: "departments" },
      { id: "hero", key: "home" },
    ]

    let ticking = false
    function onScroll() {
      if (isScrollingRef.current) return

      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (isScrollingRef.current) {
            ticking = false
            return
          }

          // At top of page: hero/home section
          if (window.scrollY < 180) {
            setActiveSection("home")
            ticking = false
            return
          }

          // Check if reached very bottom of document
          const scrollBottom = window.innerHeight + window.scrollY
          const documentHeight = document.documentElement.scrollHeight
          if (scrollBottom >= documentHeight - 60) {
            setActiveSection("contact")
            ticking = false
            return
          }

          // Evaluate sections from bottom up using viewport position
          let current = "home"
          for (const { id, key } of sectionIds) {
            const el = document.getElementById(id)
            if (el) {
              const rect = el.getBoundingClientRect()
              if (rect.top <= 240) {
                current = key
                break
              }
            }
          }
          setActiveSection(current)
          ticking = false
        })
        ticking = true
      }
    }

    if (window.location.hash) {
      const h = window.location.hash.replace("#", "")
      if (h === "calendar") setActiveSection("calendar")
      else if (h === "about") setActiveSection("about")
      else if (h === "contact") setActiveSection("contact")
      else if (h === "hero") setActiveSection("home")
      else onScroll()
    } else {
      onScroll()
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      if (scrollTimeoutRef.current) window.clearTimeout(scrollTimeoutRef.current)
    }
  }, [location.pathname, location.hash])

  function handleSectionClick(e: React.MouseEvent<HTMLAnchorElement>, targetId: string, sectionKey: string) {
    if (location.pathname === "/") {
      e.preventDefault()
      setActiveSection(sectionKey)
      isScrollingRef.current = true
      if (scrollTimeoutRef.current) window.clearTimeout(scrollTimeoutRef.current)
      scrollTimeoutRef.current = window.setTimeout(() => {
        isScrollingRef.current = false
      }, 850)

      const el = document.getElementById(targetId)
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" })
        window.history.pushState(null, "", `/#${targetId}`)
      } else if (targetId === "hero") {
        window.scrollTo({ top: 0, behavior: "smooth" })
        window.history.pushState(null, "", "/#hero")
      }
    }
  }

  const isHomeActive = activeSection === "home"
  const isDeptActive = activeSection === "departments"
  const isCalendarActive = activeSection === "calendar"
  const isAboutActive = activeSection === "about"
  const isContactActive = activeSection === "contact"

  return (
    <>
      <header
        id={id}
        className={`sticky top-0 z-[100] w-full border-b border-[#121929] bg-[#020408]/98 backdrop-blur-2xl transition-all shadow-xl shadow-black/60 ${className}`.trim()}
      >
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
              <span className="text-sm font-bold tracking-wider uppercase leading-tight sm:text-base text-white">
                {brandTitle}
                <span className="text-accent-light">{brandHighlight}</span>
              </span>
              <span className="text-[9px] sm:text-[10px] text-slate-300 font-medium uppercase tracking-widest truncate max-w-[140px] sm:max-w-none">
                {brandSubtitle}
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <div className="hidden h-full items-center gap-1 lg:gap-2 md:flex">
            <a
              href="/#hero"
              onClick={(e) => handleSectionClick(e, "hero", "home")}
              className={`group relative flex h-full items-center px-3 lg:px-3.5 text-xs lg:text-[13px] font-semibold tracking-wider uppercase transition-colors select-none ${
                isHomeActive ? "text-white" : "text-slate-200 hover:text-white"
              }`}
            >
              <span>{homeLabel}</span>
              <span
                className={`absolute bottom-0 inset-x-2 h-[2px] rounded-full bg-accent-light transition-all duration-200 pointer-events-none ${
                  isHomeActive ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0"
                }`}
              />
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
                className={`group relative flex h-full items-center gap-1 px-3 lg:px-3.5 text-xs lg:text-[13px] font-semibold tracking-wider uppercase transition-colors select-none cursor-pointer ${
                  isDeptActive ? "text-white" : "text-slate-200 hover:text-white"
                }`}
              >
                <span>{departmentsLabel}</span>
                <ChevronDown
                  size={13}
                  className={`transition-transform duration-150 ${
                    deptOpen ? "rotate-180 text-accent-light" : isDeptActive ? "text-accent-light" : "text-slate-400"
                  }`}
                />
                <span
                  className={`absolute bottom-0 inset-x-2 h-[2px] rounded-full bg-accent-light transition-all duration-200 pointer-events-none ${
                    isDeptActive ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0"
                  }`}
                />
              </button>

              {deptOpen && (
                <div className="absolute top-full left-0 w-72 rounded-xl border border-[#223049] bg-[#02050e]/98 shadow-2xl shadow-black/80 p-2 z-50 animate-rise backdrop-blur-2xl">
                  <div className="px-3 py-2 border-b border-[#223049] text-[10px] uppercase font-bold text-slate-300 flex items-center justify-between">
                    <span>ISTRAC Divisions</span>
                    <span className="text-accent-light num font-mono">{departments.length} Units</span>
                  </div>
                  <div className="py-1 max-h-64 overflow-y-auto space-y-0.5">
                    {departments.map((dept) => (
                      <Link
                        key={dept.id}
                        to={`/departments/${dept.id}`}
                        onClick={() => setDeptOpen(false)}
                        className="flex items-center justify-between rounded-lg px-3 py-2 text-xs text-slate-200 hover:bg-accent/20 hover:text-white transition-all group"
                      >
                        <span className="truncate font-medium group-hover:translate-x-0.5 transition-transform">
                          {dept.name}
                        </span>
                        {dept.code && (
                          <span className="num text-[10px] text-accent-light rounded bg-[#0b1426] px-1.5 py-0.5 border border-[#223049] shrink-0 font-mono font-semibold">
                            {dept.code}
                          </span>
                        )}
                      </Link>
                    ))}
                    {departments.length === 0 && (
                      <div className="px-3 py-3 text-xs text-slate-400 text-center">
                        No departments listed.
                      </div>
                    )}
                  </div>
                  <div className="border-t border-[#223049] pt-1.5">
                    <Link
                      to="/departments"
                      onClick={() => setDeptOpen(false)}
                      className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold text-accent-light hover:bg-accent/15 hover:text-white transition-colors"
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
              onClick={(e) => handleSectionClick(e, "calendar", "calendar")}
              className={`group relative flex h-full items-center px-3 lg:px-3.5 text-xs lg:text-[13px] font-semibold tracking-wider uppercase transition-colors select-none ${
                isCalendarActive ? "text-white" : "text-slate-200 hover:text-white"
              }`}
            >
              <span>{calendarLabel}</span>
              <span
                className={`absolute bottom-0 inset-x-2 h-[2px] rounded-full bg-accent-light transition-all duration-200 pointer-events-none ${
                  isCalendarActive ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0"
                }`}
              />
            </a>

            <a
              href="/#about"
              onClick={(e) => handleSectionClick(e, "about", "about")}
              className={`group relative flex h-full items-center px-3 lg:px-3.5 text-xs lg:text-[13px] font-semibold tracking-wider uppercase transition-colors select-none ${
                isAboutActive ? "text-white" : "text-slate-200 hover:text-white"
              }`}
            >
              <span>{aboutLabel}</span>
              <span
                className={`absolute bottom-0 inset-x-2 h-[2px] rounded-full bg-accent-light transition-all duration-200 pointer-events-none ${
                  isAboutActive ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0"
                }`}
              />
            </a>

            <a
              href="/#contact"
              onClick={(e) => handleSectionClick(e, "contact", "contact")}
              className={`group relative flex h-full items-center px-3 lg:px-3.5 text-xs lg:text-[13px] font-semibold tracking-wider uppercase transition-colors select-none ${
                isContactActive ? "text-white" : "text-slate-200 hover:text-white"
              }`}
            >
              <span>{contactLabel}</span>
              <span
                className={`absolute bottom-0 inset-x-2 h-[2px] rounded-full bg-accent-light transition-all duration-200 pointer-events-none ${
                  isContactActive ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0"
                }`}
              />
            </a>
          </div>

          {/* Desktop Right Actions */}
          <div className="hidden items-center gap-2 lg:gap-3 md:flex">
            {showSearchButton && (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="flex items-center gap-1.5 lg:gap-2 rounded-xl border border-[#223049] bg-[#050c1b] px-2.5 lg:px-3 py-1.5 text-xs text-slate-200 hover:border-accent/70 hover:text-white hover:bg-[#08142a] transition-all cursor-pointer shadow-inner"
              >
                <Search size={13} className="text-accent-light" />
                <span className="hidden lg:inline font-medium">Search Repository</span>
                <span className="lg:hidden font-medium">Search</span>
                <kbd className="num hidden xl:inline-block rounded bg-[#0a1224] px-1.5 py-0.5 text-[10px] text-slate-400 border border-[#223049] font-mono font-medium">
                  Ctrl K
                </kbd>
              </button>
            )}

            {/* Operational Broadcasts & Mission Notices Bell Icon (Accessible to all) */}
            <button
              type="button"
              onClick={() => setNotifsModalOpen(true)}
              className="relative flex h-8 w-8 items-center justify-center rounded-xl border border-[#223049] bg-[#050c1b] text-slate-300 hover:border-accent/70 hover:text-white hover:bg-[#08142a] transition-all shadow-inner cursor-pointer"
              title="Operational Broadcasts & Mission Notices"
              aria-label="Operational Broadcasts & Mission Notices"
            >
              <Bell
                size={14}
                className={
                  unreadCount > 0
                    ? "text-critical animate-pulse"
                    : notificationsList.length > 0
                    ? "text-accent-light"
                    : ""
                }
              />
              {unreadCount > 0 ? (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-critical px-1 text-[9px] font-bold text-white shadow-sm ring-2 ring-[#020408]">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : notificationsList.length > 0 ? (
                <span className="absolute -top-1 -right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent px-1 text-[8px] font-bold text-white shadow-sm ring-1 ring-[#020408]">
                  {notificationsList.length > 9 ? "9+" : notificationsList.length}
                </span>
              ) : null}
            </button>

            {showAuthButton && (
              user ? (
                <div className="flex items-center gap-2">
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
                    className="gap-1.5 border-[#223049] bg-[#050c1b] text-slate-300 hover:border-critical/60 hover:text-critical font-semibold cursor-pointer shadow-inner transition-colors"
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
                    className="gap-1.5 font-semibold text-slate-200 hover:text-white border-[#223049] hover:border-accent/70 bg-[#050c1b] cursor-pointer"
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

          {/* Mobile Actions: Search Icon + Bell Icon + Logout (if logged in) + Hamburger Toggle */}
          <div className="flex items-center gap-1.5 md:hidden">
            {showSearchButton && (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#223049] bg-[#050c1b] text-slate-200 hover:border-accent/60 hover:text-white transition-colors cursor-pointer"
                aria-label="Search"
              >
                <Search size={18} />
              </button>
            )}

            {/* Mobile Bell Button */}
            <button
              type="button"
              onClick={() => setNotifsModalOpen(true)}
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#223049] bg-[#050c1b] text-slate-200 hover:border-accent/60 hover:text-white transition-colors cursor-pointer"
              title="Operational Broadcasts & Mission Notices"
              aria-label="Operational Broadcasts & Mission Notices"
            >
              <Bell
                size={18}
                className={
                  unreadCount > 0
                    ? "text-critical animate-pulse"
                    : notificationsList.length > 0
                    ? "text-accent-light"
                    : ""
                }
              />
              {unreadCount > 0 ? (
                <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-critical px-1 text-[9px] font-bold text-white shadow-sm ring-1 ring-[#020408]">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : notificationsList.length > 0 ? (
                <span className="absolute top-1.5 right-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent px-0.5 text-[8px] font-bold text-white shadow-sm ring-1 ring-[#020408]">
                  {notificationsList.length > 9 ? "9+" : notificationsList.length}
                </span>
              ) : null}
            </button>

            {user && (
              <button
                type="button"
                onClick={handleLogout}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#223049] bg-[#050c1b] text-slate-200 hover:border-critical/60 hover:text-critical transition-colors cursor-pointer"
                title="Logout"
                aria-label="Logout"
              >
                <LogOut size={17} className="text-critical" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#223049] bg-[#050c1b] text-slate-200 hover:border-accent/60 hover:text-white transition-colors cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileOpen ? <X size={20} className="text-accent-light" /> : <Menu size={20} />}
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile Full-Screen Navigation Drawer (Outside Header to eliminate overflow & stacking context clipping) */}
      {mobileOpen && (
        <div className="fixed inset-0 top-16 z-[999] bg-[#010309]/98 backdrop-blur-2xl md:hidden overflow-y-auto animate-fade-in flex flex-col justify-between p-5 pb-12 space-y-6">
          <div className="space-y-4">
            {/* Quick Search Bar in Mobile Menu */}
            {showSearchButton && (
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false)
                  setSearchOpen(true)
                }}
                className="flex w-full items-center justify-between rounded-xl border border-[#223049] bg-[#030612] p-3.5 text-xs text-slate-300 hover:border-accent/50 hover:text-white transition-all shadow-inner cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <Search size={16} className="text-accent-light" />
                  <span>Search telemetry records & files…</span>
                </span>
                <span className="num text-[10px] text-slate-400 bg-[#0a1020] px-2 py-0.5 rounded border border-[#223049]">
                  Search
                </span>
              </button>
            )}

            {/* Navigation Items */}
            <div className="space-y-1 py-1">
              <a
                href="/#hero"
                onClick={(e) => {
                  setMobileOpen(false)
                  handleSectionClick(e, "hero", "home")
                }}
                className="flex items-center gap-3 py-2.5 px-1 text-sm font-semibold transition-colors"
              >
                <Home size={16} className={isHomeActive ? "text-accent-light" : "text-slate-400"} />
                <span className={`relative pb-1 ${isHomeActive ? "text-white font-bold" : "text-slate-200 hover:text-white"}`}>
                  {homeLabel}
                  <span
                    className={`absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-accent-light transition-all duration-200 ${
                      isHomeActive ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0"
                    }`}
                  />
                </span>
              </a>

              {/* Mobile Expandable Departments Section */}
              <div>
                <button
                  type="button"
                  onClick={() => setMobileDeptOpen(!mobileDeptOpen)}
                  className="flex w-full items-center justify-between py-2.5 px-1 text-sm font-semibold transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-3">
                    <Layers size={16} className={isDeptActive ? "text-accent-light" : "text-slate-400"} />
                    <span className={`relative pb-1 ${isDeptActive ? "text-white font-bold" : "text-slate-200 hover:text-white"}`}>
                      {departmentsLabel}
                      <span
                        className={`absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-accent-light transition-all duration-200 ${
                          isDeptActive ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0"
                        }`}
                      />
                    </span>
                  </span>
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${
                      mobileDeptOpen ? "rotate-180 text-accent-light" : "text-slate-400"
                    }`}
                  />
                </button>

                {mobileDeptOpen && (
                  <div className="mx-2 my-1.5 rounded-xl border border-[#223049] bg-[#050b18] p-2 space-y-1 animate-fade-in">
                    {departments.map((dept) => (
                      <Link
                        key={dept.id}
                        to={`/departments/${dept.id}`}
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center justify-between rounded-lg px-3 py-2 text-xs text-slate-200 hover:bg-card-hover hover:text-white transition-colors"
                      >
                        <span className="truncate">{dept.name}</span>
                        {dept.code && (
                          <span className="num text-[10px] text-accent-light bg-[#02050e] px-1.5 py-0.5 rounded border border-[#223049] font-mono font-medium">
                            {dept.code}
                          </span>
                        )}
                      </Link>
                    ))}
                    <Link
                      to="/departments"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-bold text-accent-light hover:bg-accent/15 transition-colors pt-2 border-t border-[#223049]"
                    >
                      <span>View All Divisions Directory</span>
                      <span>→</span>
                    </Link>
                  </div>
                )}
              </div>

              <a
                href="/#calendar"
                onClick={(e) => {
                  setMobileOpen(false)
                  handleSectionClick(e, "calendar", "calendar")
                }}
                className="flex items-center gap-3 py-2.5 px-1 text-sm font-semibold transition-colors"
              >
                <Calendar size={16} className={isCalendarActive ? "text-accent-light" : "text-slate-400"} />
                <span className={`relative pb-1 ${isCalendarActive ? "text-white font-bold" : "text-slate-200 hover:text-white"}`}>
                  {calendarLabel}
                  <span
                    className={`absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-accent-light transition-all duration-200 ${
                      isCalendarActive ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0"
                    }`}
                  />
                </span>
              </a>

              <a
                href="/#about"
                onClick={(e) => {
                  setMobileOpen(false)
                  handleSectionClick(e, "about", "about")
                }}
                className="flex items-center gap-3 py-2.5 px-1 text-sm font-semibold transition-colors"
              >
                <Info size={16} className={isAboutActive ? "text-accent-light" : "text-slate-400"} />
                <span className={`relative pb-1 ${isAboutActive ? "text-white font-bold" : "text-slate-200 hover:text-white"}`}>
                  {aboutLabel}
                  <span
                    className={`absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-accent-light transition-all duration-200 ${
                      isAboutActive ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0"
                    }`}
                  />
                </span>
              </a>

              <a
                href="/#contact"
                onClick={(e) => {
                  setMobileOpen(false)
                  handleSectionClick(e, "contact", "contact")
                }}
                className="flex items-center gap-3 py-2.5 px-1 text-sm font-semibold transition-colors"
              >
                <Headphones size={16} className={isContactActive ? "text-accent-light" : "text-slate-400"} />
                <span className={`relative pb-1 ${isContactActive ? "text-white font-bold" : "text-slate-200 hover:text-white"}`}>
                  {contactLabel}
                  <span
                    className={`absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-accent-light transition-all duration-200 ${
                      isContactActive ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0"
                    }`}
                  />
                </span>
              </a>
            </div>
          </div>

          {/* Mobile Footer & Auth Button */}
          <div className="space-y-4 pt-4 border-t border-[#223049]">
            {showAuthButton && (
              <div>
                {user ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between rounded-xl border border-[#223049] bg-[#030612] p-3 text-xs">
                      <div className="truncate pr-2">
                        <div className="font-bold text-white truncate">{user.name}</div>
                        <div className="num text-[10px] text-slate-400 font-mono truncate">{user.email}</div>
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
                      className="w-full justify-center gap-2 border-[#223049] text-slate-200 hover:border-critical/60 hover:text-critical cursor-pointer"
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
                      className="w-full justify-center gap-2 border-[#223049] hover:border-accent/60 cursor-pointer text-slate-200"
                    >
                      <UserPlus size={16} className="text-accent-light" />
                      <span>Request Operational Access</span>
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Status pill in mobile drawer */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
              <span className="flex items-center gap-1.5 text-nominal font-medium">
                <Radio size={12} className="animate-pulse" /> 24/7 Ops Active
              </span>
              <span className="font-mono text-slate-400">MOX Bengaluru · ISRO</span>
            </div>
          </div>
        </div>
      )}

      {/* Global Search Modal */}
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Operational Broadcasts & Mission Notices Modal */}
      <NotificationsModal
        isOpen={notifsModalOpen}
        onClose={() => setNotifsModalOpen(false)}
        notifications={notificationsList}
      />
    </>
  )
}
