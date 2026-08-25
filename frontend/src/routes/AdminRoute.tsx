import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export function AdminRoute() {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN' && user.role !== 'DEPT_ADMIN') {
    return <Navigate to="/dashboard" replace />
  }
  return <Outlet />
}