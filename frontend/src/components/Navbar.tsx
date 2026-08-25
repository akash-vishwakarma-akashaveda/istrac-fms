import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X, Search, ChevronDown, LogIn, UserCheck, Layers } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { departmentsApi, type Department } from '../api/departments.api'
import { Button } from '.'
import { SearchModal } from './SearchModal'

const NAV_LINKS = [
  { href: '/#hero', label: 'Mission Home' },
  { href: '/#calendar', label: 'Calendar & Passes' },
  { href: '/#about', label: 'About ISTRAC' },
  { href: '/#contact', label: 'Support & Contact' },
]

export function Navbar() {
  const user = useAuthStore((s) => s.user)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [deptOpen, setDeptOpen] = useState(false)
  const [departments, setDepartments] = useState<Department[]>([])

  useEffect(() => {
    departmentsApi
      .getPublicDepartments()
      .then((data) => setDepartments(data || []))
      .catch(() => {})
  }, [])

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border-subtle bg-page/90 backdrop-blur-xl">
        <nav
          className="shell flex h-16 items-center justify-between gap-4"
          aria-label="Main navigation"
        >
          {/* Brand Identity */}
          <Link
            to="/"
            className="group flex shrink-0 items-center gap-3 text-text-primary"
            aria-label="ISTRAC-FMS home"
          >
            <img
              src="/logo/isro_logo.svg"
              alt="ISRO Logo"
              className="h-10 sm:h-11 w-auto object-contain shrink-0 transition-transform duration-200 group-hover:scale-105"
            />

            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-wider uppercase leading-tight">
                ISTRAC<span className="text-accent-light">-FMS</span>
              </span>
              <span className="text-[10px] text-text-dim uppercase tracking-widest">
                ISRO Ground Network
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <div className="hidden h-full items-center gap-1 md:flex">
            <Link
              to="/#hero"
              className="eyebrow flex h-full items-center px-3.5 text-text-muted transition-colors hover:text-text-primary"
            >
              Home
            </Link>

            {/* Departments Dropdown */}
            <div className="relative h-full flex items-center" onMouseLeave={() => setDeptOpen(false)}>
              <button
                type="button"
                onClick={() => setDeptOpen((prev) => !prev)}
                onMouseEnter={() => setDeptOpen(true)}
                className="eyebrow flex h-full items-center gap-1 px-3.5 text-text-muted transition-colors hover:text-text-primary"
              >
                <span>Departments</span>
                <ChevronDown size={12} className={`transition-transform duration-150 ${deptOpen ? 'rotate-180' : ''}`} />
              </button>

              {deptOpen && (
                <div className="absolute top-full left-0 w-64 rounded-xl border border-border-default bg-card shadow-2xl p-2 z-50 animate-rise">
                  <div className="px-3 py-1.5 border-b border-border-subtle text-[10px] uppercase font-bold text-text-dim">
                    ISTRAC Operational Divisions
                  </div>
                  <div className="py-1 max-h-60 overflow-y-auto">
                    {departments.map((dept) => (
                      <Link
                        key={dept.id}
                        to={`/departments/${dept.id}`}
                        onClick={() => setDeptOpen(false)}
                        className="flex items-center justify-between rounded-lg px-3 py-2 text-xs text-text-secondary hover:bg-card-hover hover:text-text-primary transition-colors"
                      >
                        <span className="truncate font-medium">{dept.name}</span>
                        {dept.code && (
                          <span className="num text-[10px] text-accent-light rounded bg-surface px-1.5 py-0.5 border border-border-subtle">
                            {dept.code}
                          </span>
                        )}
                      </Link>
                    ))}
                    {departments.length === 0 && (
                      <div className="px-3 py-2 text-xs text-text-dim">No departments listed.</div>
                    )}
                  </div>
                  <div className="border-t border-border-subtle pt-1.5">
                    <Link
                      to="/departments"
                      onClick={() => setDeptOpen(false)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-accent-light hover:text-text-primary"
                    >
                      <Layers size={13} />
                      <span>View All Departments →</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <a
              href="/#calendar"
              className="eyebrow flex h-full items-center px-3.5 text-text-muted transition-colors hover:text-text-primary"
            >
              Calendar & Passes
            </a>

            <a
              href="/#about"
              className="eyebrow flex h-full items-center px-3.5 text-text-muted transition-colors hover:text-text-primary"
            >
              About
            </a>

            <a
              href="/#contact"
              className="eyebrow flex h-full items-center px-3.5 text-text-muted transition-colors hover:text-text-primary"
            >
              Contact
            </a>
          </div>

          {/* Search Trigger Bar & Auth Actions */}
          <div className="flex items-center gap-3">
            {/* Global Search Button */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search telemetry files"
              className="flex items-center gap-2.5 rounded-lg border border-border-default bg-surface/80 px-3 py-1.5 text-xs text-text-muted hover:border-border-bright hover:text-text-primary transition-colors shadow-sm"
            >
              <Search size={14} className="text-accent-light" />
              <span className="hidden sm:inline">Search files...</span>
              <kbd className="num hidden rounded bg-card px-1.5 py-0.5 text-[10px] text-text-dim border border-border-subtle sm:inline">
                Ctrl K
              </kbd>
            </button>

            {/* Auth Buttons */}
            {user ? (
              <Link to="/dashboard">
                <Button variant="primary" size="sm" className="shadow-md shadow-accent/20">
                  <UserCheck size={14} />
                  <span>Dashboard</span>
                </Button>
              </Link>
            ) : (
              <div className="hidden sm:flex items-center gap-2">
                <Link to="/login">
                  <Button variant="outline" size="sm">
                    <LogIn size={14} />
                    <span>Log In</span>
                  </Button>
                </Link>

                <Link to="/register">
                  <Button variant="primary" size="sm" className="shadow-md shadow-accent/20">
                    Request Access
                  </Button>
                </Link>
              </div>
            )}

            {/* Mobile Hamburger Button */}
            <button
              type="button"
              className="rounded-md border border-border-default p-2 text-text-secondary hover:text-text-primary md:hidden"
              onClick={() => setMobileOpen((prev) => !prev)}
              aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </nav>

        {/* Mobile Dropdown Menu */}
        {mobileOpen && (
          <div className="border-t border-border-subtle bg-page md:hidden">
            <div className="shell flex flex-col py-3 space-y-1">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="px-3 py-2 text-xs font-semibold text-text-secondary hover:bg-card hover:text-text-primary rounded-lg transition-colors"
                >
                  {link.label}
                </a>
              ))}

              <Link
                to="/departments"
                onClick={() => setMobileOpen(false)}
                className="px-3 py-2 text-xs font-semibold text-accent-light hover:bg-card rounded-lg transition-colors flex items-center justify-between"
              >
                <span>Browse All Departments</span>
                <span>→</span>
              </Link>

              <div className="pt-3 border-t border-border-subtle flex flex-col gap-2">
                {user ? (
                  <Link to="/dashboard" onClick={() => setMobileOpen(false)}>
                    <Button variant="primary" className="w-full">
                      Mission Dashboard
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Link to="/login" onClick={() => setMobileOpen(false)}>
                      <Button variant="outline" className="w-full">
                        Log In
                      </Button>
                    </Link>
                    <Link to="/register" onClick={() => setMobileOpen(false)}>
                      <Button variant="primary" className="w-full">
                        Request Access
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Global Search Modal */}
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
