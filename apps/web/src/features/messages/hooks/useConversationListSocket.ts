import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { MESSAGE_EVENTS } from '@uniconnect/shared'
import { socket } from '@/lib/socket'

interface ListTypingPayload {
  conversationId: string
  userId: string
  isTyping: boolean
}

/**
 * Conversation-list liveness: re-sorts on new activity in any thread and tracks
 * which threads someone is typing in (the API mirrors typing to `user:{id}` rooms).
 * Returns the set of conversation ids with a typist.
 */
export function useConversationListSocket(): ReadonlySet<string> {
  const qc = useQueryClient()
  const [typing, setTyping] = useState<ReadonlySet<string>>(() => new Set())

  useEffect(() => {
    const timers = new Map<string, ReturnType<typeof setTimeout>>()

    const stop = (conversationId: string) => {
      timers.delete(conversationId)
      setTyping((prev) => {
        if (!prev.has(conversationId)) return prev
        const next = new Set(prev)
        next.delete(conversationId)
        return next
      })
    }

    function onTyping({ conversationId, isTyping }: ListTypingPayload) {
      const existing = timers.get(conversationId)
      if (existing) clearTimeout(existing)
      if (!isTyping) {
        stop(conversationId)
        return
      }
      timers.set(conversationId, setTimeout(() => stop(conversationId), 3000))
      setTyping((prev) => (prev.has(conversationId) ? prev : new Set(prev).add(conversationId)))
    }

    function onActivity() {
      void qc.invalidateQueries({ queryKey: ['conversations'], exact: true })
    }

    socket.on(MESSAGE_EVENTS.LIST_TYPING, onTyping)
    socket.on(MESSAGE_EVENTS.ACTIVITY, onActivity)
    return () => {
      socket.off(MESSAGE_EVENTS.LIST_TYPING, onTyping)
      socket.off(MESSAGE_EVENTS.ACTIVITY, onActivity)
      timers.forEach((t) => clearTimeout(t))
    }
  }, [qc])

  return typing
}
