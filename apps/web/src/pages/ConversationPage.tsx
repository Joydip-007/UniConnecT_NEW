import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Users } from 'lucide-react'
import { TopNav } from '@/components/TopNav'
import { Avatar } from '@/components/Avatar'
import { ChatView } from '@/features/messages/components/ChatView'
import { MessageInput } from '@/features/messages/components/MessageInput'
import { useConversationSocket } from '@/features/messages/hooks/useConversationSocket'
import { useConversation } from '@/features/messages/hooks/useConversation'
import { PATHS } from '@/router/paths'

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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const convId = id ?? ''

  const { typingUserIds } = useConversationSocket(convId)
  const { data: conv } = useConversation(convId)

  if (!convId) return null

  const displayName =
    conv?.type === 'dm'
      ? (conv.otherParticipant?.fullName ?? 'Unknown')
      : (conv?.name ?? 'Group conversation')

  const isGroup = conv?.type === 'group'
  const avatarColor = conv ? seedColor(conv.id) : 'var(--uc-indigo)'

  return (
    <div
      style={{
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'var(--surface-page)',
      }}
    >
      <TopNav />

      {/* Conversation header */}
      <header
        style={{
          height: 56,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 16px',
          background: 'var(--surface-card)',
          borderBottom: '0.5px solid var(--border-default)',
        }}
      >
        {/* Back button */}
        <button
          type="button"
          onClick={() => navigate(PATHS.MESSAGES)}
          aria-label="Back to messages"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: 'var(--r-pill)',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'background 150ms',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        >
          <ArrowLeft size={18} strokeWidth={1.5} />
        </button>

        {/* Avatar */}
        {isGroup ? (
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--r-pill)',
              background: 'var(--surface-raised)',
              border: '0.5px solid var(--border-default)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: 'var(--text-tertiary)',
            }}
          >
            <Users size={16} strokeWidth={1.5} />
          </div>
        ) : (
          <Avatar
            initials={displayName ? initials(displayName) : '?'}
            color={avatarColor}
            size={36}
          />
        )}

        {/* Name + typing */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {conv ? displayName : '…'}
          </p>
          {typingUserIds.length > 0 && (
            <p style={{ margin: 0, fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)' }}>
              Typing…
            </p>
          )}
        </div>
      </header>

      {/* Chat area fills remaining space */}
      <ChatView convId={convId} />
      <MessageInput convId={convId} />
    </div>
  )
}
