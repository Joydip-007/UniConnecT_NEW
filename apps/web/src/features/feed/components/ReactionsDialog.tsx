import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { avatarColor, getInitials } from '@/utils/avatar'
import { TwemojiIcon } from '@/components/emoji/TwemojiIcon'
import { REACTIONS, totalReactions } from '@/components/emoji/reactionConfig'
import type { ReactionKey } from '@/components/emoji/reactionConfig'
import { usePostReactions } from '@/features/feed/hooks/usePostReactions'
import { useAuthStore } from '@/stores/authStore'
import { useConnectionAction } from '@/features/connections/hooks/useConnectionAction'

type TabKey = 'all' | ReactionKey

interface Props {
  postId: string
  counts: Record<string, number>
  onClose: () => void
}

function UserRow({ userId, fullName, avatarUrl }: { userId: string; fullName: string; avatarUrl: string | null }) {
  const me = useAuthStore((s) => s.user)
  const { send } = useConnectionAction(userId)
  const isMe = me?.id === userId

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 16px',
      }}
    >
      <Avatar
        src={avatarUrl}
        initials={getInitials(fullName)}
        color={avatarColor(userId)}
        size={36}
      />
      <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {fullName}
      </span>
      {!isMe && (
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
        <UserRow key={item.userId} userId={item.userId} fullName={item.fullName} avatarUrl={item.avatarUrl} />
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
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 1099, background: 'var(--overlay-bg-soft)' }}
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ type: 'tween', duration: 0.18, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1100,
          width: 420,
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: '80vh',
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-hover)',
          borderRadius: 'var(--r-lg)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
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
    </AnimatePresence>,
    document.body,
  )
}
