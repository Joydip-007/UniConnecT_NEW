import { useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import type { FeedPost } from '@uniconnect/shared'
import { Avatar } from '@/components/Avatar'
import { avatarColor, getInitials } from '@/utils/avatar'
import { useAuthStore } from '@/stores/authStore'
import { OriginalPostEmbed } from './OriginalPostEmbed'
import { useSharePost } from '@/features/feed/hooks/useSharePost'

interface Props {
  /** The post being shared (may itself be a share — we always share to the root). */
  post: FeedPost
  onClose: () => void
  /** Called with the new share post ID after a successful share. */
  onShared?: (sharePostId: string) => void
}

export function SharePostModal({ post, onClose, onShared }: Props) {
  const user = useAuthStore((s) => s.user)
  const [caption, setCaption] = useState('')
  const shareMutation = useSharePost(post.id)

  // The embed always shows the root original
  const embedPost = post.originalPost ?? {
    id: post.id,
    content: post.content,
    mediaUrls: post.mediaUrls,
    createdAt: post.createdAt,
    author: post.author,
  }

  function handleShare() {
    shareMutation.mutate(caption.trim() || undefined, {
      onSuccess: (res: unknown) => {
        toast.success('Shared to your profile')
        const shareId = (res as { data?: { id?: string } })?.data?.id
        if (shareId) onShared?.(shareId)
        onClose()
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        toast.error(msg ?? 'Could not share post')
      },
    })
  }

  return createPortal(
    <AnimatePresence>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 1099, background: 'var(--overlay-bg-soft)' }}
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ type: 'tween', duration: 0.18, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1100,
          width: 480,
          maxWidth: 'calc(100vw - 32px)',
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-hover)',
          borderRadius: 'var(--r-lg)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '14px 16px',
            borderBottom: '0.5px solid var(--border-default)',
          }}
        >
          <span style={{ flex: 1, fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>
            Share post
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-tertiary)', display: 'flex' }}
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '14px 16px' }}>
          {/* Sharer identity */}
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <Avatar
                src={user.profile.avatarUrl}
                initials={getInitials(user.profile.fullName)}
                color={avatarColor(user.id)}
                size={36}
              />
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                {user.profile.fullName}
              </span>
            </div>
          )}

          {/* Caption */}
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Say something about this…"
            maxLength={500}
            rows={3}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              color: 'var(--text-primary)',
              fontSize: 14,
              fontWeight: 400,
              lineHeight: 1.6,
              marginBottom: 8,
            }}
          />

          {/* Original post preview */}
          <OriginalPostEmbed post={embedPost as NonNullable<FeedPost['originalPost']>} />
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            padding: '10px 16px 14px',
            borderTop: '0.5px solid var(--border-default)',
          }}
        >
          <button
            type="button"
            onClick={handleShare}
            disabled={shareMutation.isPending}
            style={{
              background: 'var(--uc-indigo)',
              border: 'none',
              borderRadius: 'var(--r-pill)',
              padding: '8px 20px',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--uc-indigo-xl)',
              cursor: shareMutation.isPending ? 'not-allowed' : 'pointer',
              opacity: shareMutation.isPending ? 0.6 : 1,
              transition: 'opacity 150ms',
            }}
          >
            {shareMutation.isPending ? 'Sharing…' : 'Share now'}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}
