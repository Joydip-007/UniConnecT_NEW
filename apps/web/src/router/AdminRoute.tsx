import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { PATHS } from './paths'
import { RedirectWithNotice } from './RedirectWithNotice'

export default function AdminRoute() {
  const user = useAuthStore((s) => s.user)
  const accessToken = useAuthStore((s) => s.accessToken)

  if (!accessToken || !user) return <Navigate to={PATHS.LOGIN} replace />

  if (user.role !== 'admin' && user.role !== 'faculty') {
    return <RedirectWithNotice to={PATHS.FEED} message="That page is for admins, so we brought you to your feed." />
  }

  return <Outlet />
}
