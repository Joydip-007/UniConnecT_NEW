import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useRedirectNoticeStore } from '@/stores/redirectNoticeStore'

/**
 * A guard redirect that says why it happened. Without it a student opening an admin
 * link just lands on the feed with no idea the link was for someone else.
 */
export function RedirectWithNotice({ to, message }: { to: string; message: string }) {
  const show = useRedirectNoticeStore((s) => s.show)
  useEffect(() => {
    show(message)
  }, [show, message])
  return <Navigate to={to} replace />
}
