import { Outlet } from 'react-router-dom'
import { useIdleTimeout } from '../hooks/userIdleTimeout'
export function PublicLayout() {
  useIdleTimeout()
  return (
    <div className="min-h-screen bg-page text-text-primary antialiased">
      <Outlet />
    </div>
  )
}
