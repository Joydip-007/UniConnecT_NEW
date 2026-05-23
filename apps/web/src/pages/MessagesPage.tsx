import { useState } from 'react'
import { MessageCircle, Plus } from 'lucide-react'
import { TopNav } from '@/components/TopNav'
import { ConversationsSidebar } from '@/features/messages/components/ConversationsSidebar'
import { NewConversationModal } from '@/features/messages/components/NewConversationModal'

export default function MessagesPage() {
  const [newOpen, setNewOpen] = useState(false)

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
          <ConversationsSidebar onNewClick={() => setNewOpen(true)} />
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
            gap: 16,
            background: 'var(--surface-page)',
          }}
        >
          <MessageCircle
            size={36}
            strokeWidth={1}
            style={{ color: 'var(--text-tertiary)' }}
          />
          <div style={{ textAlign: 'center' }}>
            <p
              style={{
                margin: '0 0 6px',
                fontSize: 15,
                fontWeight: 500,
                color: 'var(--text-secondary)',
              }}
            >
              No conversation selected
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 400,
                color: 'var(--text-tertiary)',
                maxWidth: 240,
                lineHeight: 1.6,
              }}
            >
              Pick one from the sidebar or start a new one.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setNewOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '9px 20px',
              borderRadius: 'var(--r-pill)',
              background: 'var(--uc-orange)',
              border: 'none',
              color: 'var(--uc-orange-l)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'opacity 150ms',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.88')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            <Plus size={14} strokeWidth={2} />
            Start a conversation
          </button>
        </div>
      </div>

      {newOpen && <NewConversationModal onClose={() => setNewOpen(false)} />}
    </div>
  )
}
