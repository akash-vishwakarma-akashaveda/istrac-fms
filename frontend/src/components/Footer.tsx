import { useState, useEffect } from "react"
import { ArrowUp, Radio, ShieldCheck, ExternalLink } from "lucide-react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { useCms } from "../context/cmsContext"

export interface FooterBlockContent {
  brandTitle?: string
  brandHighlight?: string
  brandDescription?: string
  groundStations?: string
  copyrightText?: string
  quickLinks?: string
  footerCopyright?: string
  footerQuickLinks?: string
  statusText?: string
  portalBadge?: string
}

export interface ParsedFooterLink {
  label: string
  href: string
  isExternal: boolean
  isAnchor: boolean
}

export function resolveFooterLink(item: string): ParsedFooterLink {
  const trimmed = item.trim()
  if (!trimmed) {
    return { label: "", href: "#", isExternal: false, isAnchor: false }
  }

  // 1. Check if formatted as "Label|URL" or "Label: URL" (with URL starting with http, /, or #)
  let label = trimmed
  let targetUrl = ""

  if (trimmed.includes("|")) {
    const parts = trimmed.split("|")
    label = parts[0].trim()
    targetUrl = parts.slice(1).join("|").trim()
  } else if (/:\s*(https?:\/\/|\/|#)/i.test(trimmed)) {
    const match = trimmed.match(/^(.*?):\s*(https?:\/\/|\/|#.*)$/i)
    if (match) {
      label = match[1].trim()
      targetUrl = match[2].trim()
    }
  }

  if (targetUrl) {
    const isExternal = /^https?:\/\//i.test(targetUrl)
    const isAnchor = targetUrl.startsWith("#") || targetUrl.startsWith("/#")
    return { label, href: targetUrl, isExternal, isAnchor }
  }

  // 2. Normalize label for dictionary matching
  const norm = label.toLowerCase().trim()

  const standardMap: Record<string, string> = {
    // Home / Overview
    home: "/#hero",
    overview: "/#hero",
    "mission overview": "/#hero",
    hero: "/#hero",

    // Reports / Files
    reports: "/#featured-files",
    "featured reports": "/#featured-files",
    "featured files": "/#featured-files",
    files: "/#featured-files",
    "file repositories": "/#featured-files",
    documents: "/#featured-files",
    telemetry: "/#featured-files",
    "telemetry archive": "/#featured-files",
    archive: "/#featured-files",

    // Calendar & Passes
    calendar: "/#calendar",
    "mission calendar": "/#calendar",
    passes: "/#calendar",
    "passes & events": "/#calendar",
    "passes and events": "/#calendar",
    events: "/#calendar",
    schedule: "/#calendar",

    // Departments / Divisions
    departments: "/departments",
    divisions: "/departments",
    units: "/departments",
    facilities: "/departments",
    stations: "/departments",
    "ground stations": "/departments",

    // About
    about: "/#about",
    "about us": "/#about",
    organization: "/#about",
    mandate: "/#about",
    "about istrac": "/#about",

    // Support / Contact
    support: "/#contact",
    contact: "/#contact",
    "contact us": "/#contact",
    help: "/#contact",
    helpdesk: "/#contact",
    feedback: "/#contact",

    // Auth / App
    login: "/login",
    signin: "/login",
    "sign in": "/login",
    register: "/login",
    signup: "/login",
    console: "/app",
    "mission console": "/app",
  }

  if (standardMap[norm]) {
    const href = standardMap[norm]
    const isExternal = false
    const isAnchor = href.startsWith("/#") || href.startsWith("#")
    return { label, href, isExternal, isAnchor }
  }

  // If label itself is a URL or path
  if (/^https?:\/\//i.test(label)) {
    return { label, href: label, isExternal: true, isAnchor: false }
  }
  if (label.startsWith("/")) {
    return { label, href: label, isExternal: false, isAnchor: false }
  }
  if (label.startsWith("#")) {
    return { label, href: `/${label}`, isExternal: false, isAnchor: true }
  }

  // Fallback: clean slug as an anchor on landing page
  const slug = norm.replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
  return {
    label,
    href: `/#${slug}`,
    isExternal: false,
    isAnchor: true,
  }
}

export function Footer() {
  const navigate = useNavigate()
  const location = useLocation()
  const { cmsBlocks } = useCms()
  const footerData = (cmsBlocks["footer_custom"] as FooterBlockContent | undefined) ||
    (cmsBlocks["nav_footer"] as FooterBlockContent | undefined)

  const brandTitle = footerData?.brandTitle || "ISRO ·"
  const brandHighlight = footerData?.brandHighlight || "ISTRAC"
  const brandDescription =
    footerData?.brandDescription ||
    "ISRO Telemetry, Tracking and Command Network · Department of Space, Government of India."
  const groundStations =
    footerData?.groundStations ||
    "BLR · SHAR · PBL · MAU · BIK · BYALALU"
  const copyrightText =
    footerData?.copyrightText ||
    footerData?.footerCopyright ||
    "© 2026 ISTRAC · Indian Space Research Organisation (ISRO)."
  const statusText = footerData?.statusText || "24/7 Operations Live"
  const portalBadge = footerData?.portalBadge || "Official Intranet Portal"

  const rawLinks =
    footerData?.quickLinks ||
    footerData?.footerQuickLinks ||
    "Home, Reports, Calendar, Departments, About, Support"
  const linksList = rawLinks.split(",").map((s) => s.trim()).filter(Boolean)
  const parsedLinks = linksList.map(resolveFooterLink).filter((l) => Boolean(l.label))

  const [showFloatingTop, setShowFloatingTop] = useState(false)

  useEffect(() => {
    function handleScroll() {
      setShowFloatingTop(window.scrollY > 280)
    }
    handleScroll()
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  function scrollToTop() {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    })
  }

  function handleAnchorClick(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
    const hash = href.includes("#") ? href.split("#")[1] : ""
    if (location.pathname === "/") {
      e.preventDefault()
      if (hash === "hero" || !hash) {
        window.scrollTo({ top: 0, behavior: "smooth" })
        window.history.pushState(null, "", "/#hero")
      } else {
        const target =
          document.getElementById(hash) ||
          document.getElementById(`cms-section-${hash}`)
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" })
          window.history.pushState(null, "", `/#${hash}`)
        } else {
          window.scrollTo({ top: 0, behavior: "smooth" })
        }
      }
    } else {
      e.preventDefault()
      navigate(`/#${hash}`)
    }
  }

  return (
    <footer id="footer" className="border-t-[3px] border-isro-saffron bg-brand-ink-deep">
      <div data-theme="dark" className="shell py-14 sm:py-16">
        <div className="flex flex-col justify-between gap-8 border-b border-white/15 pb-8 sm:flex-row sm:items-center">
          {/* Brand & Mandate */}
          <div>
            <Link
              to="/"
              className="inline-flex items-center gap-3 text-text-primary"
              aria-label="ISTRAC home"
            >
              <img
                src="/logo/isro_logo.svg"
                alt="ISRO Logo"
                className="h-10 w-auto shrink-0 rounded-md bg-white object-contain p-1.5"
              />

              <span className="text-sm font-bold tracking-wider uppercase text-white">
                {brandTitle} <span className="text-isro-saffron">{brandHighlight}</span>
              </span>
            </Link>

            <p className="mt-3 max-w-md text-sm text-text-secondary">
              {brandDescription}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-text-secondary">
              <span className="flex items-center gap-1.5 text-nominal">
                <Radio size={12} /> {statusText}
              </span>
              <span className="flex items-center gap-1.5 text-accent-light">
                <ShieldCheck size={12} /> {portalBadge}
              </span>
            </div>
          </div>

          {/* Clean Functional Links */}
          <nav aria-label="Footer quick links" className="flex flex-wrap items-center gap-x-6 gap-y-2.5 text-sm text-text-secondary">
            {parsedLinks.map((item, idx) => {
              if (item.isExternal) {
                return (
                  <a
                    key={`${item.label}-${idx}`}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-text-primary transition-colors flex items-center gap-1"
                  >
                    <span>{item.label}</span>
                    <ExternalLink size={11} className="text-text-dim" />
                  </a>
                )
              }
              if (item.isAnchor) {
                return (
                  <a
                    key={`${item.label}-${idx}`}
                    href={item.href}
                    onClick={(e) => handleAnchorClick(e, item.href)}
                    className="hover:text-text-primary transition-colors cursor-pointer"
                  >
                    {item.label}
                  </a>
                )
              }
              return (
                <Link
                  key={`${item.label}-${idx}`}
                  to={item.href}
                  className="hover:text-text-primary transition-colors"
                >
                  {item.label}
                </Link>
              )
            })}
            <span className="select-none text-white/30">|</span>
            <Link to="/login" className="font-semibold text-white hover:text-isro-saffron transition-colors">
              Log In →
            </Link>
          </nav>
        </div>

        {/* Bottom Colophon & Station Network */}
        <div className="flex flex-col justify-between gap-4 pt-6 text-xs text-text-muted sm:flex-row sm:items-center">
          <p>{copyrightText}</p>

          <div className="flex items-center gap-4">
            <span className="num text-xs">
              {groundStations}
            </span>

            <button
              type="button"
              onClick={scrollToTop}
              aria-label="Back to top"
              className="group inline-flex items-center gap-1 rounded-md border border-white/20 px-2.5 py-1 text-xs text-text-secondary hover:border-white/40 hover:text-white transition-colors cursor-pointer"
            >
              <span>Top</span>
              <ArrowUp size={11} className="transition-transform group-hover:-translate-y-0.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Floating Back to Top Button */}
      <button
        type="button"
        onClick={scrollToTop}
        aria-label="Scroll back to top"
        title="Back to Top"
        className={`group fixed bottom-6 right-6 z-[90] flex items-center gap-2 rounded-full border border-border-default bg-surface p-3 sm:px-3.5 sm:py-2.5 text-text-primary shadow-lg hover:border-accent hover:text-accent-light transition-all duration-200 cursor-pointer ${
          showFloatingTop
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        <ArrowUp size={16} className="text-accent-light transition-transform group-hover:-translate-y-0.5" />
        <span className="hidden sm:inline text-xs font-semibold">Top</span>
      </button>
    </footer>
  )
}
