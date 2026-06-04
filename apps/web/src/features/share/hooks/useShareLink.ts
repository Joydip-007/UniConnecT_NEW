import { useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import type { ShareEntityType } from '@uniconnect/shared'
import { buildShareUrl } from '../sharePaths'

/**
 * Builds an internal deep link for any shareable entity and exposes copy + native
 * share actions. `nativeShare` falls back to copy where the Web Share API is absent
 * (typically desktop), so callers can always offer "Share via…".
 */
export function useShareLink(entityType: ShareEntityType, entityId: string, title?: string) {
  const url = useMemo(() => buildShareUrl(entityType, entityId), [entityType, entityId])

  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied')
    } catch {
      toast.error('Could not copy the link')
    }
  }, [url])

  const nativeShare = useCallback(async () => {
    if (!canNativeShare) return copy()
    try {
      await navigator.share({ title, url })
    } catch (err) {
      // A user-cancelled share rejects with AbortError — that's not an error to surface.
      if (err instanceof DOMException && err.name === 'AbortError') return
      await copy()
    }
  }, [canNativeShare, copy, title, url])

  return { url, copy, nativeShare, canNativeShare }
}
