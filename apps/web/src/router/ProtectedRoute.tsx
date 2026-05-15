import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { PATHS } from './paths'

export default function ProtectedRoute() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const user = useAuthStore((s) => s.user)

  if (!accessToken) return <Navigate to={PATHS.LOGIN} replace />

  if (user && !user.isVerified) {
    return (
      <Navigate
        to={PATHS.VERIFY_OTP}
        replace
        state={{ email: user.email, purpose: 'verify' }}
      />
    )
  }

  return <Outlet />
}
