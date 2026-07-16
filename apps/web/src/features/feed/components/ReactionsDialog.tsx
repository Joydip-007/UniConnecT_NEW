import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, MessageCircle, X } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/Avatar'
import { avatarColor, getInitials } from '@/utils/avatar'
import { TwemojiIcon } from '@/components/emoji/TwemojiIcon'
import { REACTIONS, totalReactions } from '@/components/emoji/reactionConfig'
import type { ReactionKey } from '@/components/emoji/reactionConfig'
import { usePostReactions } from '@/features/feed/hooks/usePostReactions'
import { useAuthStore } from '@/stores/authStore'
import { useConnectionAction } from '@/features/connections/hooks/useConnectionAction'
import { api } from '@/lib/axios'
import { PATHS } from '@/router/paths'

type TabKey = 'all' | ReactionKey

interface Props {
  postId: string
  counts: Record<string, number>
  onClose: () => void
}

function UserRow({
  userId,
  fullName,
  avatarUrl,
  connectionStatus,
  connectionId,
}: {
  userId: string
  fullName: string
  avatarUrl: string | null
  connectionStatus: 'none' | 'pending_sent' | 'pending_received' | 'connected'
  connectionId: string | null
}) {
  const navigate = useNavigate()
  const me = useAuthStore((s) => s.user)
  const { send, accept } = useConnectionAction(userId)
  const isMe = me?.id === userId
  const profileUrl = PATHS.PROFILE.replace(':id', userId)

  async function handleMessage() {
    try {
      const res = await api.post<{ data: { id: string } }>('/conversations', {
        participantId: userId,
      })
      navigate(PATHS.CONVERSATION.replace(':id', res.data.data.id))
    } catch {
      navigate(PATHS.MESSAGES)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 16px',
      }}
    >
      <Link to={profileUrl} style={{ flexShrink: 0, lineHeight: 0 }} aria-label={`View ${fullName}'s profile`}>
        <Avatar
          src={avatarUrl}
          initials={getInitials(fullName)}
          color={avatarColor(userId)}
          size={36}
        />
      </Link>
      <Link
        to={profileUrl}
        style={{
          flex: 1,
          fontSize: 14,
          fontWeight: 500,
          color: 'var(--text-primary)',
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textDecoration: 'none',
        }}
      >
        {fullName}
      </Link>
      {!isMe && connectionStatus === 'connected' && (
        <button
          type="button"
          onClick={handleMessage}
          title={`Message ${fullName}`}
          aria-label={`Message ${fullName}`}
          style={{
            flexShrink: 0,
            width: 34,
            height: 34,
            background: 'var(--surface-raised)',
            border: '0.5px solid var(--border-default)',
            borderRadius: '50%',
            color: 'var(--uc-indigo-xl)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MessageCircle size={16} strokeWidth={1.6} />
        </button>
      )}
      {!isMe && connectionStatus === 'none' && (
        <button
          type="button"
          onClick={() => send.mutate(undefined)}
          disabled={send.isPending}
          style={{
            flexShrink: 0,
            background: 'var(--surface-raised)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-pill)',
            padding: '5px 12px',
            fontSize: 12,
            fontWeight: 400,
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          Connect
        </button>
      )}
      {!isMe && connectionStatus === 'pending_sent' && (
        <span
          style={{
            flexShrink: 0,
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-pill)',
            padding: '5px 12px',
            fontSize: 12,
            color: 'var(--text-tertiary)',
          }}
        >
          Pending
        </span>
      )}
      {!isMe && connectionStatus === 'pending_received' && connectionId && (
        <button
          type="button"
          onClick={() => accept.mutate(connectionId)}
          disabled={accept.isPending}
          title={`Accept ${fullName}'s request`}
          aria-label={`Accept ${fullName}'s request`}
          style={{
            flexShrink: 0,
            width: 34,
            height: 34,
            background: 'var(--uc-indigo)',
            border: 'none',
            borderRadius: '50%',
            color: 'var(--uc-indigo-xl)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: accept.isPending ? 0.6 : 1,
          }}
        >
          <Check size={16} strokeWidth={1.7} />
        </button>
      )}
    </div>
  )
}

function TabPanel({ postId, type }: { postId: string; type: TabKey }) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = usePostReactions(
    postId,
    type,
  )

  const items = data?.pages.flatMap((p) => p.items) ?? []

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage() },
      { threshold: 0.1 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  if (isLoading) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
        Loading…
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
        No reactions yet
      </div>
    )
  }

  return (
    <div>
      {items.map((item) => (
        <UserRow
          key={item.userId}
          userId={item.userId}
          fullName={item.fullName}
          avatarUrl={item.avatarUrl}
          connectionStatus={item.connectionStatus}
          connectionId={item.connectionId}
        />
      ))}
      <div ref={sentinelRef} style={{ height: 1 }} />
      {isFetchingNextPage && (
        <div style={{ padding: '8px 0', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
          Loading more…
        </div>
      )}
    </div>
  )
}

export function ReactionsDialog({ postId, counts, onClose }: Props) {
  const total = totalReactions(counts)
  const [activeTab, setActiveTab] = useState<TabKey>('all')

  const activeTabs: TabKey[] = [
    'all',
    ...REACTIONS.filter((r) => (counts[r.key] ?? 0) > 0).map((r) => r.key as TabKey),
  ]

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return createPortal(
    <AnimatePresence>
      <button
        type="button"
        aria-label="Close reactions dialog"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1099,
          background: 'var(--overlay-bg-soft)',
          border: 'none',
          padding: 0,
          margin: 0,
          cursor: 'default',
        }}
        onClick={onClose}
      />
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          pointerEvents: 'none',
        }}
      >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ type: 'tween', duration: 0.18, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
        style={{
          width: 420,
          maxWidth: '100%',
          maxHeight: '80vh',
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-hover)',
          borderRadius: 'var(--r-lg)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          pointerEvents: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            borderBottom: '0.5px solid var(--border-default)',
            padding: '0 16px',
            gap: 4,
            flexShrink: 0,
          }}
        >
          {activeTabs.map((tab) => {
            const isActive = activeTab === tab
            const reactionCfg = tab !== 'all' ? REACTIONS.find((r) => r.key === tab) : null
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: isActive ? '2px solid var(--uc-indigo)' : '2px solid transparent',
                  cursor: 'pointer',
                  padding: '12px 8px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 14,
                  fontWeight: isActive ? 500 : 400,
                  color: isActive ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
                  transition: 'color 150ms',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab === 'all' ? (
                  <>All {total > 0 && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{total}</span>}</>
                ) : reactionCfg ? (
                  <>
                    <TwemojiIcon codepoint={reactionCfg.codepoint} size={16} label={reactionCfg.label} />
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{counts[tab] ?? 0}</span>
                  </>
                ) : null}
              </button>
            )
          })}

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              color: 'var(--text-tertiary)',
              display: 'flex',
              alignItems: 'center',
              borderBottom: '2px solid transparent',
            }}
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* User list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <TabPanel key={activeTab} postId={postId} type={activeTab} />
        </div>
      </motion.div>
      </div>
    </AnimatePresence>,
    document.body,
  )
}
