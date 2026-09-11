import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { ROLE_SHELL, isRouteAllowedForRole } from '@/config/roleShell'
import { PATHS } from './paths'

export default function ProtectedRoute() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const user = useAuthStore((s) => s.user)
  const location = useLocation()

  if (!accessToken) {
    // Preserve the deep link so login can return the visitor to it (e.g. a shared post).
    const redirect = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to={PATHS.LOGIN} replace state={{ redirect }} />
  }

  if (user && !user.isVerified) {
    return (
      <Navigate
        to={PATHS.VERIFY_OTP}
        replace
        state={{ email: user.email, purpose: 'verify' }}
      />
    )
  }

  // A role that may not render this route goes to its own home: the driver (a service
  // account kept to the handful of routes its rail offers) lands on the duty board, the
  // admin (kept out of the member feed) on the admin dashboard.
  if (user && !isRouteAllowedForRole(user.role, location.pathname)) {
    return <Navigate to={ROLE_SHELL[user.role].home} replace />
  }

  return <Outlet />
}
