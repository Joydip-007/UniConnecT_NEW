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

        {/* Right: empty / first-run state — desktop only */}
        <div
          className="msg-right-desktop-only"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 20,
            background: 'var(--surface-page)',
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 'var(--r-pill)',
              background: 'var(--uc-indigo-bg)',
              border: '0.5px solid var(--uc-indigo-bdr)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MessageCircle
              size={22}
              strokeWidth={1.5}
              style={{ color: 'var(--uc-indigo-l)' }}
            />
          </div>

          <div style={{ textAlign: 'center', maxWidth: 280 }}>
            <p
              style={{
                margin: '0 0 8px',
                fontSize: 15,
                fontWeight: 500,
                color: 'var(--text-primary)',
              }}
            >
              Connect with your campus
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 400,
                color: 'var(--text-secondary)',
                lineHeight: 1.65,
              }}
            >
              Message alumni for career advice, find study partners, or follow up with your mentor between sessions.
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
