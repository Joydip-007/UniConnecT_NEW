import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import type { ShareEntityType } from '@uniconnect/shared'
import { PATHS } from '@/router/paths'
import { useShareLink } from './useShareLink'

/**
 * The share destinations behind the "Share this group" modal. Copy + native share come
 * from `useShareLink`; the in-app targets (feed, message, group) have no composer
 * prefill yet, so each copies the link and takes the user to that surface with a
 * toast telling them to paste. Email opens a `mailto:` with the link in the body.
 */
export function useShareActions(entityType: ShareEntityType, entityId: string, title?: string) {
  const navigate = useNavigate()
  const { url, copy, nativeShare, canNativeShare } = useShareLink(entityType, entityId, title)

  const copyThenGo = useCallback(
    async (path: string, hint: string) => {
      try {
        await navigator.clipboard.writeText(url)
        toast.success(hint)
      } catch {
        toast.error('Could not copy the link')
      }
      navigate(path)
    },
    [navigate, url],
  )

  const shareToFeed = useCallback(
    () => copyThenGo(PATHS.FEED, 'Link copied — paste it into your post'),
    [copyThenGo],
  )
  const shareViaMessage = useCallback(
    () => copyThenGo(PATHS.MESSAGES, 'Link copied — paste it into a message'),
    [copyThenGo],
  )
  const shareToGroup = useCallback(
    () => copyThenGo(PATHS.GROUPS, 'Link copied — paste it into a group post'),
    [copyThenGo],
  )
  const shareByEmail = useCallback(() => {
    const subject = encodeURIComponent(title ?? 'Have a look at this')
    const body = encodeURIComponent(url)
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }, [title, url])

  return { url, copy, nativeShare, canNativeShare, shareToFeed, shareViaMessage, shareToGroup, shareByEmail }
}
