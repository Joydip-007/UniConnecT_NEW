import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { PATHS } from './paths'

// Guards the driver broadcast shell. Only the least-privilege `driver` role
// (and `admin`, for testing) may reach it; everyone else is sent to the feed.
export default function DriverRoute() {
  const user = useAuthStore((s) => s.user)
  const accessToken = useAuthStore((s) => s.accessToken)

  if (!accessToken || !user) return <Navigate to={PATHS.LOGIN} replace />
  if (user.role !== 'driver' && user.role !== 'admin') return <Navigate to={PATHS.FEED} replace />

  return <Outlet />
}
