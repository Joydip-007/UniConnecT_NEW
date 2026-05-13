import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { MessageCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/Avatar'
import { api } from '@/lib/axios'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Participant {
  id: string
  fullName: string
  role: 'student' | 'alumni' | 'staff' | 'admin'
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
  type: 'dm' | 'group'
  name: string | null
  otherParticipant: Participant | null
  lastMessage: LastMessage | null
  unreadCount: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'var(--uc-indigo)',
  '#2E7D8C',
  '#6B4E9B',
  '#1A6B4A',
  '#8C4A2E',
]

function seedColor(seed: string): string {
  const sum = [...seed].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_COLORS[sum % AVATAR_COLORS.length]
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function relativeTime(iso: string): string {
  return formatDistanceToNow(parseISO(iso), { addSuffix: false })
    .replace('about ', '')
    .replace(' minutes', 'm')
    .replace(' minute', 'm')
    .replace(' hours', 'h')
    .replace(' hour', 'h')
    .replace(' days', 'd')
    .replace(' day', 'd')
}

// ── ConversationRow ───────────────────────────────────────────────────────────

function ConversationRow({
  conversation,
  onClick,
}: {
  conversation: Conversation
  onClick: () => void
}) {
  const displayName =
    conversation.type === 'dm'
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
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--surface-hover)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      <Avatar initials={avatarInitials} color={avatarColor} size={42} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
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
                color: '#fff',
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
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          padding: '8px 4px',
        }}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 12px',
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                background: 'var(--surface-raised)',
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div
                style={{
                  height: 13,
                  width: `${50 + (i * 13) % 30}%`,
                  borderRadius: 4,
                  background: 'var(--surface-raised)',
                }}
              />
              <div
                style={{
                  height: 11,
                  width: `${40 + (i * 17) % 35}%`,
                  borderRadius: 4,
                  background: 'var(--surface-raised)',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          padding: '48px 24px',
          textAlign: 'center',
        }}
      >
        <MessageCircle
          size={32}
          strokeWidth={1.5}
          style={{ color: 'var(--text-tertiary)' }}
        />
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 400,
            color: 'var(--text-tertiary)',
            lineHeight: 1.5,
          }}
        >
          No conversations yet. Start by messaging a classmate or alumni.
        </p>
      </div>
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
