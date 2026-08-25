import { ArrowUp, Radio, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

export function Footer() {
  return (
    <footer className="border-t border-border-subtle bg-[#050811]">
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
                ISRO · <span className="text-accent-light">ISTRAC</span>
              </span>
            </Link>

            <p className="mt-2 text-xs text-text-muted max-w-md">
              ISRO Telemetry, Tracking and Command Network · Department of Space, Government of India.
            </p>

            <div className="mt-3 flex items-center gap-4 text-[11px] text-text-dim">
              <span className="flex items-center gap-1.5 text-nominal">
                <Radio size={12} /> 24/7 Operations Live
              </span>
              <span className="flex items-center gap-1.5 text-accent-light">
                <ShieldCheck size={12} /> Official Intranet Portal
              </span>
            </div>
          </div>

          {/* Clean Functional Links */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-text-muted">
            <a href="#hero" className="hover:text-text-primary transition-colors">
              Home
            </a>
            <a href="#featured-files" className="hover:text-text-primary transition-colors">
              Reports
            </a>
            <a href="#calendar" className="hover:text-text-primary transition-colors">
              Calendar
            </a>
            <Link to="/departments" className="hover:text-text-primary transition-colors">
              Departments
            </Link>
            <a href="#about" className="hover:text-text-primary transition-colors">
              About
            </a>
            <a href="#contact" className="hover:text-text-primary transition-colors">
              Support
            </a>
            <span className="text-border-default">|</span>
            <Link to="/login" className="font-semibold text-accent-light hover:text-white transition-colors">
              Log In →
            </Link>
          </div>
        </div>

        {/* Bottom Colophon & Station Network */}
        <div className="flex flex-col justify-between gap-4 pt-6 sm:flex-row sm:items-center text-[11px] text-text-dim">
          <p>
            © 2026 ISTRAC · Indian Space Research Organisation (ISRO).
          </p>

          <div className="flex items-center gap-4">
            <span className="num text-[10px]">
              BLR · SHAR · PBL · MAU · BIK · BYALALU
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
