import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { ErrorBoundary } from '@/components/ErrorBoundary'

// Keyed on the pathname so a crashed page recovers when the viewer moves to another
// item on the same route (/events/a → /events/b), not only on a route change.
export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>
}
