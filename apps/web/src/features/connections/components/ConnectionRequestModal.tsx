import { useEffect, useRef, useState } from 'react'
import { Modal } from '@/components/Modal'

interface Props {
  isOpen: boolean
  onClose: () => void
  targetName: string
  onSend: (note?: string) => void
  isPending: boolean
  triggerRef?: React.RefObject<HTMLButtonElement>
}

export function ConnectionRequestModal({ isOpen, onClose, targetName, onSend, isPending, triggerRef }: Props) {
  const [showNote, setShowNote] = useState(false)
  const [note, setNote] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const MAX = 300

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setShowNote(false)
      setNote('')
    }
  }, [isOpen])

  // Focus textarea when it appears
  useEffect(() => {
    if (showNote) {
      textareaRef.current?.focus()
    }
  }, [showNote])

  const handleSend = () => {
    onSend(note.trim() || undefined)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Connect with ${targetName}`} triggerRef={triggerRef}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Body */}
        <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Personalise your invitation to <strong style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{targetName}</strong> — people are more likely to connect when you share why you want to connect.
        </p>

        {/* Textarea */}
        {showNote && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Add a note</span>
              <button
                onClick={() => {
                  setShowNote(false)
                  setNote('')
                }}
                style={{
                  padding: '2px 8px',
                  borderRadius: 'var(--r-sm)',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  fontSize: 12,
                  fontWeight: 400,
                  cursor: 'pointer',
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)' }}
              >
                Remove note
              </button>
            </div>
            <textarea
              ref={textareaRef}
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, MAX))}
              placeholder="Write a short note…"
              rows={4}
              style={{
                width: '100%',
                resize: 'vertical',
                background: 'var(--surface-card)',
                border: '0.5px solid var(--border-hover)',
                borderRadius: 'var(--r-md)',
                padding: '10px 12px',
                fontSize: 13,
                fontWeight: 400,
                color: 'var(--text-primary)',
                lineHeight: 1.6,
                outline: 'none',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => { e.currentTarget.style.border = '0.5px solid var(--uc-indigo)' }}
              onBlur={(e) => { e.currentTarget.style.border = '0.5px solid var(--border-hover)' }}
            />
            <div style={{ textAlign: 'right', fontSize: 11, color: note.length >= MAX ? 'var(--uc-red)' : 'var(--text-tertiary)' }}>
              {note.length}/{MAX}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {!showNote && (
            <button
              onClick={() => setShowNote(true)}
              style={{
                padding: '6px 16px',
                borderRadius: 'var(--r-pill)',
                border: '0.5px solid var(--border-hover)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)' }}
            >
              Add a note
            </button>
          )}

          <button
            onClick={handleSend}
            disabled={isPending}
            style={{
              padding: '6px 16px',
              borderRadius: 'var(--r-pill)',
              border: 'none',
              background: 'var(--uc-indigo)',
              color: 'var(--uc-indigo-xl)',
              fontSize: 13,
              fontWeight: 500,
              cursor: isPending ? 'default' : 'pointer',
              opacity: isPending ? 0.6 : 1,
            }}
          >
            Send invite
          </button>
        </div>
      </div>
    </Modal>
  )
}
