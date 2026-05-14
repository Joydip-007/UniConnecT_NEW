import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { ChatView } from '@/features/messages/components/ChatView'
import { MessageInput } from '@/features/messages/components/MessageInput'
import { useConversationSocket } from '@/features/messages/hooks/useConversationSocket'

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const convId = id ?? ''
  const { typingUserIds } = useConversationSocket(convId)

  if (!convId) return null

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--surface-page)', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 16px',
          background: 'var(--surface-card)',
          borderBottom: '0.5px solid var(--border-default)',
        }}
      >
        <button
          type="button"
          onClick={() => navigate('/messages')}
          aria-label="Back"
          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}
        >
          <ArrowLeft size={18} strokeWidth={1.5} />
        </button>
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
            Conversation
          </p>
          {typingUserIds.length > 0 && (
            <p style={{ margin: 0, fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>
              Typing…
            </p>
          )}
        </div>
      </header>

      <ChatView convId={convId} />
      <MessageInput convId={convId} />
    </div>
  )
}
