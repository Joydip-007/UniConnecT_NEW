import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Modal } from '@/components/Modal'
import type { Message } from '../types'
import { conversationAvatar, conversationTitle } from '../threadModel'
import { useConversations, useMessageActions } from '../hooks/useMessagesData'
import { MsgAvatar } from './MsgPrimitives'

interface ForwardModalProps {
  fromConvId: string
  message: Message
  onClose: () => void
}

/** Pick one or more threads to re-send a message into. */
export function ForwardModal({ fromConvId, message, onClose }: ForwardModalProps) {
  const [query, setQuery] = useState('')
  const [sent, setSent] = useState<ReadonlySet<string>>(() => new Set())
  const { data } = useConversations()
  const { forward } = useMessageActions(fromConvId)

  const targets = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (data ?? []).filter(
      (c) => c.id !== fromConvId && !c.isRequest && (!q || conversationTitle(c).toLowerCase().includes(q)),
    )
  }, [data, fromConvId, query])

  return (
    <Modal isOpen onClose={onClose} title="Forward message" maxWidth={420}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', display: 'flex' }}>
            <Search size={14} />
          </span>
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations"
            aria-label="Search conversations"
            className="msgx-search"
            style={{
              width: '100%',
              height: 36,
              boxSizing: 'border-box',
              background: 'var(--surface-raised)',
              border: '0.5px solid var(--border-default)',
              borderRadius: 'var(--r-pill)',
              padding: '0 14px 0 34px',
              fontSize: 13,
              fontFamily: 'inherit',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
        </div>
        <div className="msgx-scroll" style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {targets.map((c) => {
            const avatar = conversationAvatar(c)
            const done = sent.has(c.id)
            return (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px' }}>
                <MsgAvatar size={36} fontSize={12} initials={avatar.initials} color={avatar.color} src={avatar.src} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {conversationTitle(c)}
                </span>
                <button
                  type="button"
                  disabled={done || forward.isPending}
                  onClick={() =>
                    forward.mutate(
                      { targetConvId: c.id, message },
                      { onSuccess: () => setSent((prev) => new Set(prev).add(c.id)) },
                    )
                  }
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--r-pill)',
                    border: done ? '0.5px solid var(--border-default)' : 'none',
                    background: done ? 'transparent' : 'var(--uc-indigo)',
                    color: done ? 'var(--text-tertiary)' : 'var(--on-indigo)',
                    fontSize: 12,
                    fontWeight: 500,
                    fontFamily: 'inherit',
                    cursor: done ? 'default' : 'pointer',
                  }}
                >
                  {done ? 'Sent' : 'Send'}
                </button>
              </div>
            )
          })}
          {targets.length === 0 && (
            <p style={{ margin: 0, padding: '24px 8px', textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>
              No conversations to forward to.
            </p>
          )}
        </div>
      </div>
    </Modal>
  )
}
