import { useEffect } from 'react'
import { useUIStore } from '../store/uiStore'

const TABLET_BREAKPOINT = 1024

export function useAutoCollapseSidebar() {
  const setSidebarCollapsed = useUIStore((s) => s.setSidebarCollapsed)
  const sidebarManuallySet = useUIStore((s) => s.sidebarManuallySet)

  useEffect(() => {
    function handleResize() {
      if (sidebarManuallySet) return
      setSidebarCollapsed(window.innerWidth < TABLET_BREAKPOINT)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [setSidebarCollapsed, sidebarManuallySet])
}