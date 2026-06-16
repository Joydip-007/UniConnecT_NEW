import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Send, Smile, Sticker } from 'lucide-react'
import { socket } from '@/lib/socket'
import { useAuthStore } from '@/stores/authStore'
import { usePendingMsgsStore } from '@/stores/pendingMsgsStore'
import { useEmojiInsert } from '@/hooks/useEmojiInsert'

const EmojiPicker = lazy(() =>
  import('@/components/emoji/EmojiPicker').then((m) => ({ default: m.EmojiPicker })),
)
const StickerDrawer = lazy(() =>
  import('@/components/emoji/StickerDrawer').then((m) => ({ default: m.StickerDrawer })),
)

interface MessageInputProps {
  convId: string
  /** Called when the user selects a sticker — parent sends it as a sticker message */
  onSendSticker?: (lottieUrl: string) => void
}

export function MessageInput({ convId, onSendSticker }: MessageInputProps) {
  const [value, setValue] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const [showStickers, setShowStickers] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lastTypingEmitRef = useRef(0)
  const user = useAuthStore((s) => s.user)
  const pendingSend = usePendingMsgsStore((s) => s.send)
  const insertEmoji = useEmojiInsert(textareaRef, value, setValue)

  useEffect(() => {
    setValue('')
    setShowEmoji(false)
    setShowStickers(false)
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
    if (next === '' && wasNonEmpty) emitTypingStop()
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
    const now = Date.now()
    if (now - lastTypingEmitRef.current >= 2000) {
      socket.emit('conv:typing:start', { conversationId: convId })
      lastTypingEmitRef.current = now
    }
  }

  function handleBlur() {
    emitTypingStop()
    if (textareaRef.current) textareaRef.current.style.borderColor = 'var(--border-default)'
  }

  function handleFocus(e: React.FocusEvent<HTMLTextAreaElement>) {
    e.currentTarget.style.borderColor = 'var(--border-hover)'
  }

  const canSend = value.trim().length > 0

  return (
    <div
      style={{
        borderTop: '0.5px solid var(--border-default)',
        background: 'var(--surface-card)',
        padding: '8px 16px 12px',
        position: 'relative',
      }}
    >
      {/* Emoji picker */}
      {showEmoji && (
        <div style={{ position: 'absolute', bottom: '100%', left: 16, marginBottom: 4, zIndex: 60 }}>
          <Suspense fallback={null}>
            <EmojiPicker
              onSelect={(e) => { insertEmoji(e); setShowEmoji(false) }}
              onClose={() => setShowEmoji(false)}
            />
          </Suspense>
        </div>
      )}

      {/* Sticker drawer */}
      {showStickers && (
        <div style={{ position: 'absolute', bottom: '100%', left: 16, marginBottom: 4, zIndex: 60 }}>
          <Suspense fallback={null}>
            <StickerDrawer
              onSelect={(url) => {
                onSendSticker?.(url)
                setShowStickers(false)
              }}
              onClose={() => setShowStickers(false)}
            />
          </Suspense>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
        {/* Emoji button */}
        <button
          type="button"
          aria-label="Emoji"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => { setShowEmoji((v) => !v); setShowStickers(false) }}
          style={{
            flexShrink: 0,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 6,
            color: showEmoji ? 'var(--uc-indigo)' : 'var(--text-tertiary)',
            display: 'flex',
            alignItems: 'center',
            borderRadius: 'var(--r-pill)',
            transition: 'color 150ms',
          }}
        >
          <Smile size={20} strokeWidth={1.5} />
        </button>

        {/* Sticker button */}
        <button
          type="button"
          aria-label="Stickers"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => { setShowStickers((v) => !v); setShowEmoji(false) }}
          style={{
            flexShrink: 0,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 6,
            color: showStickers ? 'var(--uc-indigo)' : 'var(--text-tertiary)',
            display: 'flex',
            alignItems: 'center',
            borderRadius: 'var(--r-pill)',
            transition: 'color 150ms',
          }}
        >
          <Sticker size={20} strokeWidth={1.5} />
        </button>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholder="Type a message…"
          aria-label="Message. Press Enter to send, Shift+Enter for a new line."
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
            fontFamily: `inherit, var(--font-emoji)`,
            lineHeight: 1.5,
            transition: 'border-color 150ms',
          }}
        />

        {/* Send button */}
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
    </div>
  )
}
