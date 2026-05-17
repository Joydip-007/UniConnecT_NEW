import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, MessageCircle, Plus } from 'lucide-react'
import { TopNav } from '@/components/TopNav'
import { ConversationList } from '@/features/messages/components/ConversationList'
import { NewConversationModal } from '@/features/messages/components/NewConversationModal'
import { OrangeBtn } from '@/components/Button'
import { PATHS } from '@/router/paths'

export default function MessagesPage() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--surface-page)', display: 'flex', flexDirection: 'column' }}>
      <TopNav />

      <div style={{ flex: 1, padding: 16 }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Page header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                onClick={() => navigate(PATHS.FEED)}
                aria-label="Back to feed"
                className="row-hover-bg card-hover-border"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 44,
                  height: 44,
                  borderRadius: 'var(--r-pill)',
                  background: 'var(--surface-raised)',
                  border: '0.5px solid var(--border-default)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'border-color 150ms, background 150ms',
                }}
              >
                <ArrowLeft size={16} strokeWidth={1.5} />
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageCircle size={18} strokeWidth={1.5} color="var(--uc-indigo-l)" />
                <h1 style={{ margin: 0, fontSize: 17, fontWeight: 500, color: 'var(--text-primary)' }}>
                  Messages
                </h1>
              </div>
            </div>

            <OrangeBtn onClick={() => setOpen(true)}>
              <Plus size={15} strokeWidth={2} />
              New
            </OrangeBtn>
          </div>

          {/* Conversation list */}
          <div
            style={{
              background: 'var(--surface-card)',
              border: '0.5px solid var(--border-default)',
              borderRadius: 'var(--r-lg)',
              minHeight: 420,
            }}
          >
            <ConversationList />
          </div>
        </div>
      </div>

      {open && <NewConversationModal onClose={() => setOpen(false)} />}
    </div>
  )
}
