import { useState } from 'react'
import { MessageCircle, Plus } from 'lucide-react'
import { ConversationList } from '@/features/messages/components/ConversationList'
import { NewConversationModal } from '@/features/messages/components/NewConversationModal'
import { OrangeBtn } from '@/components/Button'

export default function MessagesPage() {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--surface-page)', padding: 16 }}>
      <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <MessageCircle size={20} strokeWidth={1.5} color="var(--uc-indigo-l)" />
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 500, color: 'var(--text-primary)' }}>
              Messages
            </h1>
          </div>
          <OrangeBtn onClick={() => setOpen(true)}>
            <Plus size={15} strokeWidth={2} />
            New
          </OrangeBtn>
        </div>

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

      {open && <NewConversationModal onClose={() => setOpen(false)} />}
    </div>
  )
}
