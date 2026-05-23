import { useQuery } from '@tanstack/react-query'
import { MessageCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/Avatar'
import { api } from '@/lib/axios'
import { SkeletonConvRow } from '@/components/skeletons/SkeletonConvRow'
import { EmptyState } from '@/components/EmptyState'
import { seedColor, initials, relativeTime } from '../utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Participant {
  id: string
  fullName: string
  role: 'student' | 'alumni' | 'faculty' | 'admin'
  profile: {
    avatarUrl: string | null
    headline: string | null
  }
}

interface LastMessage {
  body: string
  sentAt: string
  senderId: string
}

export interface Conversation {
  id: string
  type: 'direct' | 'group' | 'mentorship'
  name: string | null
  otherParticipant: Participant | null
  lastMessage: LastMessage | null
  unreadCount: number
}

// ── ConversationRow ───────────────────────────────────────────────────────────

function ConversationRow({
  conversation,
  onClick,
}: {
  conversation: Conversation
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

  return (
    <button
      onClick={onClick}
      className="row-hover-bg"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '10px 12px',
        background: 'transparent',
        border: 'none',
        borderRadius: 'var(--r-md)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 150ms',
      }}
    >
      <Avatar initials={avatarInitials} color={avatarColor} size={42} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: 14,
              fontWeight: hasUnread ? 500 : 400,
              color: 'var(--text-primary)',
            }}
          >
            {displayName}
          </span>
          {isMentorship && (
            <span
              style={{
                flexShrink: 0,
                padding: '1px 6px',
                borderRadius: 'var(--r-pill)',
                fontSize: 10,
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
                color: 'var(--text-tertiary)',
              }}
            >
              {time}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
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
          {hasUnread && (
            <span
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

// ── ConversationList ──────────────────────────────────────────────────────────

export function ConversationList() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () =>
      api.get<{ data: Conversation[] }>('/conversations').then((r) => r.data.data),
  })

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 4px' }}>
        <SkeletonConvRow />
        <SkeletonConvRow />
        <SkeletonConvRow />
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={MessageCircle}
        title="Start a conversation"
        description="No conversations yet. Start by messaging a classmate or alumni."
      />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '4px' }}>
      {data.map((conv) => (
        <ConversationRow
          key={conv.id}
          conversation={conv}
          onClick={() => navigate(`/messages/${conv.id}`)}
        />
      ))}
    </div>
  )
}
