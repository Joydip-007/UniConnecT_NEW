import { useEffect, useRef, useState } from 'react'

interface Props {
  isOpen: boolean
  onClose: () => void
  targetName: string
  onSend: (note?: string) => void
  isPending: boolean
}

export function ConnectionRequestModal({ isOpen, onClose, targetName, onSend, isPending }: Props) {
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

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleSend = () => {
    onSend(note.trim() || undefined)
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        background: 'var(--overlay-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface-raised)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: 24,
          width: '100%',
          maxWidth: 420,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          position: 'relative',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            fontSize: 18,
            lineHeight: 1,
            padding: 4,
            borderRadius: 'var(--r-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)' }}
        >
          ×
        </button>

        {/* Title */}
        <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', paddingRight: 24 }}>
          Want to add a note?
        </div>

        {/* Body */}
        <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Personalise your invitation to <strong style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{targetName}</strong> — people are more likely to connect when you share why you want to connect.
        </p>

        {/* Textarea */}
        {showNote && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
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
    </div>
  )
}
