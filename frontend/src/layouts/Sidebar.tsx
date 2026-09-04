import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
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
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
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
    <aside
      className={`flex shrink-0 flex-col border-r border-border-subtle bg-surface transition-[width] duration-200 ${
        sidebarCollapsed ? 'w-14' : 'w-60'
      }`}
    >
      {/* Identity */}
      <div
        className={`flex h-14 shrink-0 items-center border-b border-border-subtle ${
          sidebarCollapsed ? 'justify-center px-2' : 'justify-between pr-2 pl-3'
        }`}
      >
        {sidebarCollapsed ? (
          <Link
            to="/"
            title={`Return to ${brandTitle}${brandHighlight} Public Portal`}
            className="flex items-center justify-center"
          >
            <StationMark className="h-7" />
          </Link>
        ) : (
          <Link
            to="/"
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
                <span className="truncate text-[8.5px] text-text-dim uppercase tracking-wider font-mono">
                  {brandSubtitle}
                </span>
              )}
            </div>
          </Link>
        )}

        <button
          type="button"
          onClick={toggleSidebar}
          className="shrink-0 rounded-md p-1.5 text-text-dim transition-colors duration-150 hover:bg-card-hover hover:text-text-primary"
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
        />

        {isAdmin && adminItems.length > 0 && (
          <RailGroup
            label="Administration"
            items={adminItems}
            collapsed={sidebarCollapsed}
            className="mt-4 border-t border-border-subtle/80 pt-3"
          />
        )}
      </nav>

      {/* Station footer */}
      {!sidebarCollapsed && (
        <div className="shrink-0 border-t border-border-subtle px-3 py-2.5">
          <p className="eyebrow text-text-dim text-[9px]">Station / Facility</p>
          <p className="num mt-0.5 text-[10px] text-text-dim font-medium truncate" title={brandSubtitle || "BLR · MOX Complex"}>
            {brandSubtitle || "BLR · MOX Complex"}
          </p>
        </div>
      )}
    </aside>
  )
}

interface RailGroupProps {
  label: string
  items: NavItem[]
  collapsed: boolean
  className?: string
}

function RailGroup({ label, items, collapsed, className = '' }: RailGroupProps) {
  return (
    <div className={className}>
      {!collapsed && (
        <p className="eyebrow px-3 pb-1.5 text-[10px] font-bold tracking-wider text-text-dim uppercase">
          {label}
        </p>
      )}

      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.path}>
            <NavLink
              to={item.path}
              end={item.path === '/dashboard' || item.path === '/admin'}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `relative flex items-center gap-2.5 border-l-2 py-2 text-[13px] font-medium transition-colors duration-150 ${
                  collapsed ? 'justify-center px-0' : 'px-3'
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

                  {!collapsed && <span className="truncate">{item.label}</span>}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  )
}
