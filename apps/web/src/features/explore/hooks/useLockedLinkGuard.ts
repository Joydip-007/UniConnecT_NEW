import type { MouseEvent } from 'react'
import { useToastStore } from '@/stores/toastStore'

/**
 * A private group answers "Group not found" to anyone who is not a member, so a link to
 * one would land on a dead end. Explore already knows which groups are locked; this
 * returns an onClick that, when given a notice, cancels the navigation and says why.
 */
export function useLockedLinkGuard() {
  const show = useToastStore((s) => s.show)
  return (notice: string | null | undefined) => (e: MouseEvent) => {
    if (!notice) return
    e.preventDefault()
    show({ message: notice, type: 'info', durationMs: 5000 })
  }
}
