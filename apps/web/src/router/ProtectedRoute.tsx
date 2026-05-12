import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { PATHS } from './paths'

export default function ProtectedRoute() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const isLoading = useAuthStore((s) => s.isLoading)

  if (isLoading) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ background: 'var(--surface-page)' }}
      >
        <div
          className="h-10 w-10 animate-spin rounded-full border-2"
          style={{ borderColor: 'var(--border-subtle)', borderTopColor: 'var(--uc-orange)' }}
        />
      </div>
    )
  }

  if (!accessToken) return <Navigate to={PATHS.LOGIN} replace />

  return <Outlet />
}
