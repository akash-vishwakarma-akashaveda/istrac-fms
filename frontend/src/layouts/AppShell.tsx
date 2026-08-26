import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { DynamicAlertBanner } from '../components/DynamicAlertBanner'
import { useAutoCollapseSidebar } from '../hooks/useAutoCollapseSidebar'

export function AppShell() {
  useAutoCollapseSidebar()

  return (
    /* The rail and the readout strip are fixed furniture — only the work area
       scrolls, so the UTC clock and navigation never leave the screen. */
    <div className="flex h-screen overflow-hidden bg-page">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <DynamicAlertBanner />

        <main className="flex-1 overflow-y-auto">
          <div className="shell-wide py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
