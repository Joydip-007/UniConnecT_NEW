import { useEffect, useState } from 'react'
import type { InfiniteData } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { socket } from '@/lib/socket'
import { useAuthStore } from '@/stores/authStore'
import type { Message, MessagesPage } from '../components/ChatView'
import type { Conversation } from '../components/ConversationList'

// ── Payload shapes (docs/socket-events.md#messaging-events) ──────────────────

interface ConvMessageNewPayload {
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
    // Mark messages as read on open
    socket.emit('conv:read', { conversationId: convId })

    // ── conv:message:new ──────────────────────────────────────────────────────
    function onMessageNew({ conversationId, message }: ConvMessageNewPayload) {
      if (conversationId !== convId) return

      // Append to the most-recent page (pages[0], ascending items)
      queryClient.setQueryData<InfiniteData<MessagesPage>>(
        ['messages', convId],
        (old) => {
          if (!old || old.pages.length === 0) return old
          const [first, ...rest] = old.pages as [MessagesPage, ...MessagesPage[]]
          return {
            ...old,
            pages: [{ ...first, items: [...first.items, message] }, ...rest],
          }
        },
      )

      // Refresh last-message preview in the conversation list
      queryClient.setQueryData<Conversation[]>(['conversations'], (old) => {
        if (!old) return old
        return old.map((conv) =>
          conv.id === conversationId
            ? {
                ...conv,
                lastMessage: {
                  body: message.body,
                  sentAt: message.sentAt,
                  senderId: message.senderId,
                },
              }
            : conv,
        )
      })
    }

    // ── conv:message:deleted ──────────────────────────────────────────────────
    function onMessageDeleted({ conversationId, messageId }: ConvMessageDeletedPayload) {
      if (conversationId !== convId) return

      queryClient.setQueryData<InfiniteData<MessagesPage>>(
        ['messages', convId],
        (old) => {
          if (!old) return old
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((msg) =>
                msg.id === messageId ? { ...msg, isDeleted: true } : msg,
              ),
            })),
          }
        },
      )
    }

    // ── conv:typing ───────────────────────────────────────────────────────────
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

    // ── conv:read:ack ─────────────────────────────────────────────────────────
    function onReadAck({ conversationId, userId }: ConvReadAckPayload) {
      // Only reset our own unread count
      if (userId !== myUserId) return
      queryClient.setQueryData<Conversation[]>(['conversations'], (old) => {
        if (!old) return old
        return old.map((conv) =>
          conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv,
        )
      })
    }

    socket.on('conv:message:new', onMessageNew)
    socket.on('conv:message:deleted', onMessageDeleted)
    socket.on('conv:typing', onTyping)
    socket.on('conv:read:ack', onReadAck)

    return () => {
      socket.emit('conv:leave', { conversationId: convId })
      socket.off('conv:message:new', onMessageNew)
      socket.off('conv:message:deleted', onMessageDeleted)
      socket.off('conv:typing', onTyping)
      socket.off('conv:read:ack', onReadAck)
      timers.forEach((t) => clearTimeout(t))
      timers.clear()
      setTypingUserIds([])
    }
  }, [convId, myUserId, queryClient])

  return { typingUserIds }
}
