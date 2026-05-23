import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { socket } from '@/lib/socket'
import { useAuthStore } from '@/stores/authStore'
import { usePendingMsgsStore } from '@/stores/pendingMsgsStore'

// ── MessageInput ──────────────────────────────────────────────────────────────

interface MessageInputProps {
  convId: string
}

export function MessageInput({ convId }: MessageInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lastTypingEmitRef = useRef(0)
  const user = useAuthStore((s) => s.user)
  const pendingSend = usePendingMsgsStore((s) => s.send)

  // Reset state when navigating to a different conversation
  useEffect(() => {
    setValue('')
    lastTypingEmitRef.current = 0
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }, [convId])

  function emitTypingStop() {
    socket.emit('conv:typing:stop', { conversationId: convId })
    lastTypingEmitRef.current = 0
  }

  function handleSend() {
    const trimmed = value.trim()
    if (!trimmed || !user) return

    setValue('')
    emitTypingStop()
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    pendingSend(convId, trimmed, {
      id: user.id,
      fullName: user.profile.fullName,
      profile: { avatarUrl: user.profile.avatarUrl },
    })
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value
    const wasNonEmpty = value !== ''
    setValue(next)

    // Stop typing indicator when input is cleared
    if (next === '' && wasNonEmpty) emitTypingStop()

    // Auto-grow up to 120px
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
      return
    }
    // Throttled typing:start — at most once per 2 s
    const now = Date.now()
    if (now - lastTypingEmitRef.current >= 2000) {
      socket.emit('conv:typing:start', { conversationId: convId })
      lastTypingEmitRef.current = now
    }
  }

  function handleBlur() {
    emitTypingStop()
    if (textareaRef.current) {
      textareaRef.current.style.borderColor = 'var(--border-default)'
    }
  }

  function handleFocus(e: React.FocusEvent<HTMLTextAreaElement>) {
    e.currentTarget.style.borderColor = 'var(--border-hover)'
  }

  const canSend = value.trim().length > 0

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 8,
        padding: '10px 16px 12px',
        borderTop: '0.5px solid var(--border-default)',
        background: 'var(--surface-card)',
      }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onFocus={handleFocus}
        placeholder="Type a message…"
        title="Press Enter to send, Shift+Enter for a new line"
        rows={1}
        style={{
          flex: 1,
          resize: 'none',
          background: 'var(--surface-raised)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: '8px 12px',
          fontSize: 13,
          fontWeight: 400,
          color: 'var(--text-primary)',
          outline: 'none',
          maxHeight: 120,
          overflowY: 'auto',
          fontFamily: 'inherit',
          lineHeight: 1.5,
          transition: 'border-color 150ms',
        }}
      />

      <button
        type="button"
        onClick={handleSend}
        disabled={!canSend}
        aria-label="Send message"
        style={{
          flexShrink: 0,
          width: 44,
          height: 44,
          borderRadius: 'var(--r-pill)',
          background: 'var(--uc-indigo)',
          border: 'none',
          cursor: canSend ? 'pointer' : 'not-allowed',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--uc-indigo-xl)',
          opacity: canSend ? 1 : 0.38,
          transition: 'opacity 150ms',
          padding: 0,
        }}
      >
        <Send size={16} strokeWidth={1.5} />
      </button>
    </div>
  )
}
