import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { MESSAGE_EVENTS } from '@uniconnect/shared'
import { api } from '@/lib/axios'
import { socket } from '@/lib/socket'
import { useAuthStore } from '@/stores/authStore'
import { bumpLastMessage, patchConversation, patchMessage, setMemberReadAt, upsertMessage } from '../messageCache'
import type { Message, MessageReactions } from '../types'

// ── Payload shapes (docs/socket-events.md#messaging-events) ──────────────────

interface ConvMessagePayload {
  conversationId: string
  message: Message
}

interface ConvMessageDeletedPayload {
  conversationId: string
  messageId: string
}

interface ConvTypingPayload {
  conversationId: string
  userId: string
  isTyping: boolean
}

interface ConvReadAckPayload {
  conversationId: string
  userId: string
  readAt: string
}

interface ReactionPayload {
  messageId: string
  reactions: MessageReactions
}

interface OnceOpenedPayload {
  conversationId: string
  messageId: string
  userId: string
}

/** Marks the thread read server-side; the API answers with `conv:read:ack` to the room. */
function markRead(convId: string) {
  void api.post(`/conversations/${convId}/read`).catch(() => {})
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useConversationSocket(convId: string) {
  const queryClient = useQueryClient()
  const myUserId = useAuthStore((s) => s.user?.id)
  const [typingUserIds, setTypingUserIds] = useState<string[]>([])

  useEffect(() => {
    if (!convId) return undefined

    // Timer map is local to this effect instance; cleaned up on convId change
    const timers = new Map<string, ReturnType<typeof setTimeout>>()

    socket.emit('conv:join', { conversationId: convId })
    markRead(convId)

    function onMessageNew({ conversationId, message }: ConvMessagePayload) {
      if (conversationId !== convId) return
      upsertMessage(queryClient, convId, message)
      bumpLastMessage(queryClient, convId, message)
      // The thread is open, so anything that arrives is read the moment it lands.
      if (message.senderId !== myUserId) markRead(convId)
    }

    function onMessageUpdated({ conversationId, message }: ConvMessagePayload) {
      if (conversationId !== convId) return
      upsertMessage(queryClient, convId, message)
    }

    function onMessageDeleted({ conversationId, messageId }: ConvMessageDeletedPayload) {
      if (conversationId !== convId) return
      patchMessage(queryClient, convId, messageId, (m) => ({
        ...m,
        isDeleted: true,
        attachments: [],
        mediaUrls: [],
        stickerUrl: null,
      }))
    }

    function onReaction({ messageId, reactions }: ReactionPayload) {
      patchMessage(queryClient, convId, messageId, (m) => ({ ...m, reactions }))
    }

    function onOnceOpened({ conversationId, messageId, userId }: OnceOpenedPayload) {
      if (conversationId !== convId || userId === myUserId) return
      // Someone else opened my view-once photo — flip the sender's copy to "Opened".
      patchMessage(queryClient, convId, messageId, (m) =>
        m.senderId === myUserId ? { ...m, viewOnce: { opened: true } } : m,
      )
    }

    function onTyping({ conversationId, userId, isTyping }: ConvTypingPayload) {
      if (conversationId !== convId || userId === myUserId) return

      const existing = timers.get(userId)
      if (existing) clearTimeout(existing)

      if (isTyping) {
        // Auto-hide after 3 s in case conv:typing:stop is never received
        const timer = setTimeout(() => {
          setTypingUserIds((prev) => prev.filter((id) => id !== userId))
          timers.delete(userId)
        }, 3000)
        timers.set(userId, timer)
        setTypingUserIds((prev) => (prev.includes(userId) ? prev : [...prev, userId]))
      } else {
        timers.delete(userId)
        setTypingUserIds((prev) => prev.filter((id) => id !== userId))
      }
    }

    function onReadAck({ conversationId, userId, readAt }: ConvReadAckPayload) {
      if (conversationId !== convId) return
      if (userId === myUserId) {
        patchConversation(queryClient, conversationId, (c) => ({ ...c, unreadCount: 0 }))
      } else {
        // Another participant caught up — drives the "Seen" check on my bubbles.
        setMemberReadAt(queryClient, conversationId, userId, readAt)
      }
    }

    socket.on('conv:message:new', onMessageNew)
    socket.on(MESSAGE_EVENTS.UPDATED, onMessageUpdated)
    socket.on('conv:message:deleted', onMessageDeleted)
    socket.on('message:reaction', onReaction)
    socket.on(MESSAGE_EVENTS.ONCE_OPENED, onOnceOpened)
    socket.on('conv:typing', onTyping)
    socket.on('conv:read:ack', onReadAck)

    return () => {
      socket.emit('conv:leave', { conversationId: convId })
      socket.off('conv:message:new', onMessageNew)
      socket.off(MESSAGE_EVENTS.UPDATED, onMessageUpdated)
      socket.off('conv:message:deleted', onMessageDeleted)
      socket.off('message:reaction', onReaction)
      socket.off(MESSAGE_EVENTS.ONCE_OPENED, onOnceOpened)
      socket.off('conv:typing', onTyping)
      socket.off('conv:read:ack', onReadAck)
      timers.forEach((t) => clearTimeout(t))
      timers.clear()
      setTypingUserIds([])
    }
  }, [convId, myUserId, queryClient])

  return { typingUserIds }
}
