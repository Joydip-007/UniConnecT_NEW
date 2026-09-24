import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Users } from 'lucide-react'
import { TopNav } from '@/components/TopNav'
import { Avatar } from '@/components/Avatar'
import { RoleBadge } from '@/components/RoleBadge'
import { ChatView } from '@/features/messages/components/ChatView'
import { MessageInput } from '@/features/messages/components/MessageInput'
import { ConversationsSidebar } from '@/features/messages/components/ConversationsSidebar'
import { useConversationSocket } from '@/features/messages/hooks/useConversationSocket'
import { useConversation } from '@/features/messages/hooks/useConversation'
import { seedColor, initials } from '@/features/messages/utils'
import { PATHS } from '@/router/paths'

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const convId = id ?? ''

  const { typingUserIds } = useConversationSocket(convId)
  const { data: conv } = useConversation(convId)

  if (!convId) return null

  const isMentorship = conv?.type === 'mentorship'
  const displayName =
    conv?.type === 'direct' || isMentorship
      ? (conv.otherParticipant?.fullName ?? 'Unknown')
      : (conv?.name ?? 'Group conversation')

  const isGroup = conv?.type === 'group'
  const avatarColor = conv ? seedColor(conv.id) : 'var(--uc-indigo)'

  // Resolve who is typing — use participant name for DM/mentorship, count for groups
  const typingLabel: string | null = (() => {
    if (typingUserIds.length === 0) return null
    if (!isGroup && conv?.otherParticipant) {
      const firstName = (conv.otherParticipant.fullName ?? '').split(' ')[0] || 'Someone'
      return `${firstName} is typing`
    }
    return typingUserIds.length === 1
      ? 'Someone is typing'
      : `${typingUserIds.length} people are typing`
  })()

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

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left sidebar — desktop only */}
        <div className="msg-sidebar-desktop-only">
          <ConversationsSidebar activeConvId={convId} />
        </div>

        {/* Right: conversation header + chat + input */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: 'var(--surface-page)',
          }}
        >
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
            {/* Back button — goes to list on mobile, noop on desktop since sidebar is always visible */}
            <button
              type="button"
              onClick={() => navigate(PATHS.MESSAGES)}
              aria-label="Back to messages"
              className="row-hover-bg msg-back-mobile-only"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 44,
                height: 44,
                borderRadius: 'var(--r-pill)',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'background 150ms',
              }}
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

            {/* Name + mentorship subtitle / typing indicator */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                {(conv?.type === 'direct' || isMentorship) && conv?.otherParticipant?.role && (
                  <RoleBadge role={conv.otherParticipant.role} size={15} tipPlacement="below" />
                )}
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
                {isMentorship && (
                  <span
                    style={{
                      flexShrink: 0,
                      padding: '2px 8px',
                      borderRadius: 'var(--r-pill)',
                      fontSize: 12,
                      fontWeight: 500,
                      background: 'var(--uc-orange-bg)',
                      border: '0.5px solid var(--uc-orange-bdr)',
                      color: 'var(--uc-orange-l)',
                      lineHeight: 1.6,
                    }}
                  >
                    mentorship session
                  </span>
                )}
              </div>
              {typingLabel && (
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    fontWeight: 400,
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span>{typingLabel}</span>
                  <span style={{ display: 'inline-flex', gap: 2, color: 'var(--text-secondary)' }}>
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </span>
                </p>
              )}
            </div>
          </header>

          {/* Chat area */}
          <ChatView convId={convId} />
          <MessageInput convId={convId} />
        </div>
      </div>
    </div>
  )
}
