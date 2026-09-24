import type { InfiniteData, QueryClient } from '@tanstack/react-query'
import type { Conversation, ConversationMember, Message, MessagesPage } from './types'

// Writers for the `['messages', convId]` infinite cache and the `['conversations']`
// list. Every path that learns about a message — the REST response, the socket echo,
// an optimistic edit — goes through these, so a message is never listed twice.

type MessagesCache = InfiniteData<MessagesPage>

export function upsertMessage(qc: QueryClient, convId: string, message: Message) {
  qc.setQueryData<MessagesCache>(['messages', convId], (old) => {
    if (!old || old.pages.length === 0) return old
    let found = false
    const pages = old.pages.map((page) => ({
      ...page,
      items: page.items.map((m) => {
        if (m.id !== message.id) return m
        found = true
        return { ...m, ...message }
      }),
    }))
    if (found) return { ...old, pages }
    const [first, ...rest] = pages as [MessagesPage, ...MessagesPage[]]
    return { ...old, pages: [{ ...first, items: [...first.items, message] }, ...rest] }
  })
}

export function patchMessage(qc: QueryClient, convId: string, messageId: string, patch: (m: Message) => Message) {
  qc.setQueryData<MessagesCache>(['messages', convId], (old) =>
    old
      ? {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((m) => (m.id === messageId ? patch(m) : m)),
          })),
        }
      : old,
  )
}

export function dropMessage(qc: QueryClient, convId: string, messageId: string) {
  qc.setQueryData<MessagesCache>(['messages', convId], (old) =>
    old
      ? { ...old, pages: old.pages.map((page) => ({ ...page, items: page.items.filter((m) => m.id !== messageId) })) }
      : old,
  )
}

export function patchConversation(qc: QueryClient, convId: string, patch: (c: Conversation) => Conversation) {
  qc.setQueryData<Conversation[]>(['conversations'], (old) => old?.map((c) => (c.id === convId ? patch(c) : c)))
  qc.setQueryData<Conversation>(['conversation', convId], (old) => (old ? patch(old) : old))
}

export function setMemberReadAt(qc: QueryClient, convId: string, userId: string, readAt: string) {
  patchConversation(qc, convId, (c) => ({
    ...c,
    participants: c.participants?.map(
      (p): ConversationMember => (p.userId === userId ? { ...p, lastReadAt: readAt } : p),
    ),
  }))
}

export function bumpLastMessage(qc: QueryClient, convId: string, message: Message) {
  patchConversation(qc, convId, (c) => ({
    ...c,
    lastMessage: {
      body: message.body,
      sentAt: message.sentAt,
      senderId: message.senderId,
      contentType: message.contentType ?? 'text',
      viewOnce: !!message.viewOnce,
      isDeleted: message.isDeleted,
    },
  }))
}
