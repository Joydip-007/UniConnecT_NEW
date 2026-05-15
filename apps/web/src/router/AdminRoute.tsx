import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { PATHS } from './paths'

export default function AdminRoute() {
  const user = useAuthStore((s) => s.user)
  const accessToken = useAuthStore((s) => s.accessToken)

  if (!accessToken || !user) return <Navigate to={PATHS.LOGIN} replace />

  if (user.role !== 'admin' && user.role !== 'faculty') return <Navigate to={PATHS.FEED} replace />

  return <Outlet />
}
