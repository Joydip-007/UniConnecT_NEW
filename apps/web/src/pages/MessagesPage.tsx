import { MessageCircle } from 'lucide-react'
import { TopNav } from '@/components/TopNav'
import { ConversationsSidebar } from '@/features/messages/components/ConversationsSidebar'

export default function MessagesPage() {
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
        {/* Left: conversation list — full-width on mobile, 320px on desktop */}
        <div className="msg-sidebar-full-mobile">
          <ConversationsSidebar />
        </div>

        {/* Right: empty state — desktop only */}
        <div
          className="msg-right-desktop-only"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 12,
            background: 'var(--surface-page)',
          }}
        >
          <MessageCircle
            size={40}
            strokeWidth={1}
            style={{ color: 'var(--text-tertiary)' }}
          />
          <p
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 500,
              color: 'var(--text-secondary)',
            }}
          >
            Select a conversation
          </p>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 400,
              color: 'var(--text-tertiary)',
              textAlign: 'center',
              maxWidth: 260,
              lineHeight: 1.6,
            }}
          >
            Choose a conversation from the sidebar or start a new one.
          </p>
        </div>
      </div>
    </div>
  )
}
