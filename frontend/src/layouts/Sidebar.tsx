import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { NavLink, Link } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { navItems, type NavItem } from '../config/navigation'
import { useCms } from '../context/cmsContext'

/** The official ISRO logo brand mark */
function StationMark({ className = '' }: { className?: string }) {
  return (
    <img
      src="/logo/isro_logo.svg"
      alt="ISRO Logo"
      className={`h-8 w-auto object-contain shrink-0 ${className}`}
    />
  )
}

export function Sidebar() {
  const user = useAuthStore((state) => state.user)
  const { sidebarCollapsed, toggleSidebar, mobileSidebarOpen, setMobileSidebarOpen } = useUIStore()
  const { cmsBlocks } = useCms()

  const navData =
    (cmsBlocks['nav_header'] as any) ||
    (cmsBlocks['nav_footer'] as any)

  const brandTitle = navData?.brandTitle || 'ISTRAC'
  const brandHighlight = navData?.brandHighlight !== undefined ? navData.brandHighlight : '-SIMS'
  const brandSubtitle = navData?.brandSubtitle || 'ISRO Ground Network'

  const isAdmin = user?.role === 'ADMIN'

  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin)

  /* Group navigation by privilege boundaries */
  const workspaceItems = visibleItems.filter((item) => !item.adminOnly)
  const adminItems = visibleItems.filter((item) => item.adminOnly)

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden animate-fadeIn"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border-subtle bg-surface shadow-2xl transition-transform duration-300 md:static md:shadow-none md:z-auto md:transition-[width] md:duration-200 ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } ${sidebarCollapsed ? 'md:w-14' : 'md:w-60'} w-64 max-w-[85vw]`}
      >
        {/* Identity Header */}
        <div
          className={`flex h-14 shrink-0 items-center border-b border-border-subtle ${
            sidebarCollapsed ? 'md:justify-center md:px-2 justify-between pr-2 pl-3' : 'justify-between pr-2 pl-3'
          }`}
        >
          {/* Collapsed desktop station mark */}
          <div className={sidebarCollapsed ? 'hidden md:flex' : 'hidden'}>
            <Link
              to="/"
              title={`Return to ${brandTitle}${brandHighlight} Public Portal`}
              className="flex items-center justify-center"
            >
              <StationMark className="h-7" />
            </Link>
          </div>

          {/* Expanded / Mobile station mark & title */}
          <div className={sidebarCollapsed ? 'flex md:hidden min-w-0' : 'flex min-w-0'}>
            <Link
              to="/"
              onClick={() => setMobileSidebarOpen(false)}
              title={`Return to ${brandTitle}${brandHighlight} Public Portal`}
              className="flex min-w-0 items-center gap-2.5 hover:opacity-90 transition-opacity"
            >
              <StationMark className="h-8" />

              <div className="flex flex-col min-w-0">
                <span className="truncate text-[13px] font-extrabold tracking-[0.06em] text-white leading-tight">
                  {brandTitle}
                  <span className="text-accent-light font-black">{brandHighlight}</span>
                </span>
                {brandSubtitle && (
                  <span className="truncate text-[10px] text-text-dim uppercase tracking-wider font-mono">
                    {brandSubtitle}
                  </span>
                )}
              </div>
            </Link>
          </div>

          {/* Mobile Close Button */}
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(false)}
            className="md:hidden shrink-0 rounded-lg p-1.5 text-text-dim hover:text-white hover:bg-card-hover"
            aria-label="Close navigation drawer"
          >
            <X size={18} />
          </button>

          {/* Desktop Collapse / Expand Toggle Button */}
          <button
            type="button"
            onClick={toggleSidebar}
            className="hidden md:flex shrink-0 rounded-md p-1.5 text-text-dim transition-colors duration-150 hover:bg-card-hover hover:text-text-primary"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen size={16} strokeWidth={1.8} />
            ) : (
              <PanelLeftClose size={16} strokeWidth={1.8} />
            )}
          </button>
        </div>

        {/* Destinations */}
        <nav className="flex-1 overflow-y-auto py-3">
          <RailGroup
            label="Workspace"
            items={workspaceItems}
            collapsed={sidebarCollapsed}
            onItemClick={() => setMobileSidebarOpen(false)}
          />

          {isAdmin && adminItems.length > 0 && (
            <RailGroup
              label="Administration"
              items={adminItems}
              collapsed={sidebarCollapsed}
              onItemClick={() => setMobileSidebarOpen(false)}
              className="mt-4 border-t border-border-subtle/80 pt-3"
            />
          )}
        </nav>

        {/* Station footer */}
        <div className={`shrink-0 border-t border-border-subtle px-3 py-2.5 ${sidebarCollapsed ? 'block md:hidden' : 'block'}`}>
          <p className="eyebrow text-text-dim text-[10px]">Station / Facility</p>
          <p className="num mt-0.5 text-[10px] text-text-dim font-medium truncate" title={brandSubtitle || "BLR · MOX Complex"}>
            {brandSubtitle || "BLR · MOX Complex"}
          </p>
        </div>
      </aside>
    </>
  )
}

interface RailGroupProps {
  label: string
  items: NavItem[]
  collapsed: boolean
  onItemClick?: () => void
  className?: string
}

function RailGroup({ label, items, collapsed, onItemClick, className = '' }: RailGroupProps) {
  return (
    <div className={className}>
      <p className={`eyebrow px-3 pb-1.5 text-[10px] font-bold tracking-wider text-text-dim uppercase ${collapsed ? 'block md:hidden' : 'block'}`}>
        {label}
      </p>

      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.path}>
            <NavLink
              to={item.path}
              end={item.path === '/dashboard' || item.path === '/admin'}
              onClick={onItemClick}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `relative flex items-center gap-2.5 border-l-2 py-2 text-[13px] font-medium transition-colors duration-150 ${
                  collapsed ? 'justify-start px-3 md:justify-center md:px-0' : 'px-3'
                } ${
                  isActive
                    ? 'border-l-accent bg-accent/10 text-white font-semibold'
                    : 'border-l-transparent text-text-muted hover:bg-card-hover hover:text-text-primary'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    size={16}
                    strokeWidth={isActive ? 2.2 : 1.8}
                    className={`shrink-0 ${isActive ? 'text-accent-light' : 'text-text-muted'}`}
                  />

                  <span className={`truncate ${collapsed ? 'inline md:hidden' : 'inline'}`}>
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  )
}
