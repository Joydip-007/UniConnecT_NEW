import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { ROLE_SHELL } from '@/config/roleShell'

export default function GuestRoute() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const user = useAuthStore((s) => s.user)
  if (accessToken) return <Navigate to={ROLE_SHELL[user?.role ?? 'student'].home} replace />
  return <Outlet />
}
