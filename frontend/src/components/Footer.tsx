import { ArrowUp, Radio, ShieldCheck } from "lucide-react"
import { Link } from "react-router-dom"
import { useCms } from "../context/cmsContext"

interface FooterBlockContent {
  brandTitle?: string
  brandHighlight?: string
  brandDescription?: string
  groundStations?: string
  copyrightText?: string
  quickLinks?: string
  statusText?: string
  portalBadge?: string
}

export function Footer() {
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
    "© 2026 ISTRAC · Indian Space Research Organisation (ISRO)."
  const statusText = footerData?.statusText || "24/7 Operations Live"
  const portalBadge = footerData?.portalBadge || "Official Intranet Portal"

  const rawLinks = footerData?.quickLinks || "Home, Reports, Calendar, Departments, About, Support"
  const linksList = rawLinks.split(",").map((s) => s.trim()).filter(Boolean)

  const linkHrefMap: Record<string, string> = {
    Home: "#hero",
    Reports: "#featured-files",
    Calendar: "#calendar",
    Departments: "/departments",
    About: "#about",
    Support: "#contact",
  }

  return (
    <footer id="footer" className="border-t border-border-subtle bg-[#050811]">
      <div className="shell py-10 sm:py-12">
        <div className="flex flex-col justify-between gap-8 pb-8 border-b border-border-subtle sm:flex-row sm:items-center">
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
                className="h-9 sm:h-10 w-auto object-contain shrink-0"
              />

              <span className="text-xs font-bold tracking-wider uppercase">
                {brandTitle} <span className="text-accent-light">{brandHighlight}</span>
              </span>
            </Link>

            <p className="mt-2 text-xs text-text-muted max-w-md">
              {brandDescription}
            </p>

            <div className="mt-3 flex items-center gap-4 text-[11px] text-text-dim">
              <span className="flex items-center gap-1.5 text-nominal">
                <Radio size={12} /> {statusText}
              </span>
              <span className="flex items-center gap-1.5 text-accent-light">
                <ShieldCheck size={12} /> {portalBadge}
              </span>
            </div>
          </div>

          {/* Clean Functional Links */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-text-muted">
            {linksList.map((label) => {
              const href = linkHrefMap[label] || `/#${label.toLowerCase()}`
              const isInternalRoute = href.startsWith("/")
              if (isInternalRoute) {
                return (
                  <Link key={label} to={href} className="hover:text-text-primary transition-colors">
                    {label}
                  </Link>
                )
              }
              return (
                <a key={label} href={href} className="hover:text-text-primary transition-colors">
                  {label}
                </a>
              )
            })}
            <span className="text-border-default">|</span>
            <Link to="/login" className="font-semibold text-accent-light hover:text-white transition-colors">
              Log In →
            </Link>
          </div>
        </div>

        {/* Bottom Colophon & Station Network */}
        <div className="flex flex-col justify-between gap-4 pt-6 sm:flex-row sm:items-center text-[11px] text-text-dim">
          <p>{copyrightText}</p>

          <div className="flex items-center gap-4">
            <span className="num text-[10px]">
              {groundStations}
            </span>

            <a
              href="#hero"
              aria-label="Back to top"
              className="group inline-flex items-center gap-1 rounded-md border border-border-subtle bg-surface px-2.5 py-1 text-[11px] text-text-secondary hover:text-text-primary hover:border-border-default transition-colors"
            >
              <span>Top</span>
              <ArrowUp size={11} className="transition-transform group-hover:-translate-y-0.5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
