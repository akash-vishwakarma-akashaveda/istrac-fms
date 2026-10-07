import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export function AdminRoute() {
  const user = useAuthStore((s) => s.user)
  const signedOutByUser = useAuthStore((s) => s.signedOutByUser)
  if (!user) return <Navigate to={signedOutByUser ? '/' : '/login'} replace />
  if (user.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />
  }
  return <Outlet />
}