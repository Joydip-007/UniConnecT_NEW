import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MessageCircle, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/Avatar'
import { api } from '@/lib/axios'
import { SkeletonConvRow } from '@/components/skeletons/SkeletonConvRow'
import { EmptyState } from '@/components/EmptyState'
import { NewConversationModal } from './NewConversationModal'
import type { Conversation } from '../types'
import { seedColor, initials, relativeTime } from '../utils'

// ── SidebarRow ────────────────────────────────────────────────────────────────

function SidebarRow({
  conversation,
  isActive,
  onClick,
}: {
  conversation: Conversation
  isActive: boolean
  onClick: () => void
}) {
  const isMentorship = conversation.type === 'mentorship'
  const displayName =
    conversation.type === 'direct' || isMentorship
      ? (conversation.otherParticipant?.fullName ?? 'Unknown')
      : (conversation.name ?? 'Group')

  const avatarInitials = initials(displayName)
  const avatarColor = seedColor(conversation.id)
  const preview = conversation.lastMessage?.body ?? ''
  const time = conversation.lastMessage?.sentAt
    ? relativeTime(conversation.lastMessage.sentAt)
    : null
  const hasUnread = conversation.unreadCount > 0

  const buttonLabel = hasUnread
    ? `${displayName}, ${conversation.unreadCount} unread message${conversation.unreadCount === 1 ? '' : 's'}${isActive ? ', currently open' : ''}`
    : `${displayName}${isActive ? ', currently open' : ''}`

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={buttonLabel}
      aria-current={isActive ? 'true' : undefined}
      className={isActive ? undefined : 'row-hover-bg'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '9px 10px',
        background: isActive ? 'var(--uc-indigo-bg)' : 'transparent',
        border: 'none',
        borderRadius: 'var(--r-md)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 150ms',
      }}
    >
      <div style={{ flexShrink: 0 }}><Avatar initials={avatarInitials} color={avatarColor} size={38} /></div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: 13,
              fontWeight: hasUnread ? 500 : 400,
              color: isActive ? 'var(--uc-indigo-xl)' : 'var(--text-primary)',
            }}
          >
            {displayName}
          </span>
          {isMentorship && (
            <span
              style={{
                flexShrink: 0,
                padding: '1px 5px',
                borderRadius: 'var(--r-pill)',
                fontSize: 11,
                fontWeight: 500,
                background: 'var(--uc-orange-bg)',
                border: '0.5px solid var(--uc-orange-bdr)',
                color: 'var(--uc-orange-l)',
                lineHeight: 1.6,
              }}
            >
              mentorship
            </span>
          )}
          {time && (
            <span
              style={{
                flexShrink: 0,
                fontSize: 11,
                fontWeight: 400,
                color: isActive ? 'var(--uc-indigo-l)' : 'var(--text-tertiary)',
              }}
            >
              {time}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: 12,
              fontWeight: 400,
              color: hasUnread ? 'var(--text-secondary)' : 'var(--text-tertiary)',
            }}
          >
            {preview || ' '}
          </span>
          {hasUnread && !isActive && (
            <span
              aria-hidden="true"
              style={{
                flexShrink: 0,
                minWidth: 18,
                height: 18,
                borderRadius: 'var(--r-pill)',
                background: 'var(--uc-indigo)',
                color: 'var(--text-primary)',
                fontSize: 11,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 5px',
              }}
            >
              {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

// ── ConversationsSidebar ──────────────────────────────────────────────────────

interface ConversationsSidebarProps {
  activeConvId?: string
  /** When provided, the Plus button calls this instead of opening an internal modal. */
  onNewClick?: () => void
}

export function ConversationsSidebar({ activeConvId, onNewClick }: ConversationsSidebarProps) {
  const navigate = useNavigate()
  const [internalNewOpen, setInternalNewOpen] = useState(false)

  const handleNew = onNewClick ?? (() => setInternalNewOpen(true))

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['conversations'],
    queryFn: () =>
      api.get<{ data: Conversation[] }>('/conversations').then((r) => r.data.data),
  })

  // Sort newest-last-message first — memoized so socket-driven re-renders skip the sort
  const sorted = useMemo(
    () =>
      data
        ? [...data].sort((a, b) => {
            const at = a.lastMessage?.sentAt ? new Date(a.lastMessage.sentAt).getTime() : 0
            const bt = b.lastMessage?.sentAt ? new Date(b.lastMessage.sentAt).getTime() : 0
            return bt - at
          })
        : [],
    [data],
  )

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 14px 10px',
            flexShrink: 0,
            borderBottom: '0.5px solid var(--border-default)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <MessageCircle size={15} strokeWidth={1.5} style={{ color: 'var(--uc-indigo-l)', flexShrink: 0 }} />
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Messages</span>
          </div>

          <button
            type="button"
            onClick={handleNew}
            aria-label="New conversation"
            className="row-hover-bg"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 34,
              height: 34,
              borderRadius: 'var(--r-pill)',
              background: 'var(--uc-orange-bg)',
              border: '0.5px solid var(--uc-orange-bdr)',
              color: 'var(--uc-orange-l)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <Plus size={13} strokeWidth={2} />
          </button>
        </div>

        {/* Scrollable conversation list */}
        <div
          className="rail-scroll"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '6px 6px',
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          {isLoading && (
            <>
              <SkeletonConvRow />
              <SkeletonConvRow />
              <SkeletonConvRow />
              <SkeletonConvRow />
            </>
          )}

          {!isLoading && isError && (
            <div
              role="alert"
              style={{
                padding: '24px 12px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-tertiary)' }}>
                Couldn't load conversations.
              </p>
              <button
                type="button"
                onClick={() => void refetch()}
                style={{
                  padding: '5px 14px',
                  borderRadius: 'var(--r-pill)',
                  background: 'var(--surface-raised)',
                  border: '0.5px solid var(--border-default)',
                  color: 'var(--text-secondary)',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Try again
              </button>
            </div>
          )}

          {!isLoading && !isError && sorted.length === 0 && (
            <EmptyState
              icon={MessageCircle}
              title="No conversations yet"
              description="Start a conversation with a classmate, alumni, or faculty member."
            />
          )}

          {!isLoading && !isError &&
            sorted.map((conv) => (
              <SidebarRow
                key={conv.id}
                conversation={conv}
                isActive={conv.id === activeConvId}
                onClick={() => navigate(`/messages/${conv.id}`)}
              />
            ))}
        </div>
      </div>

      {!onNewClick && internalNewOpen && (
        <NewConversationModal onClose={() => setInternalNewOpen(false)} />
      )}
    </>
  )
}
