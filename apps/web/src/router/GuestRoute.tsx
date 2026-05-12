import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { PATHS } from './paths'

export default function GuestRoute() {
  const accessToken = useAuthStore((s) => s.accessToken)
  if (accessToken) return <Navigate to={PATHS.FEED} replace />
  return <Outlet />
}
