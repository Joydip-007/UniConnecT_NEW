import { useMemo } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { ConversationPreferencesInput, MessageAttachment } from '@uniconnect/shared'
import type { MessageReactionKey } from '@/components/emoji/reactionConfig'
import { api } from '@/lib/axios'
import { useAuthStore } from '@/stores/authStore'
import { usePendingMsgsStore } from '@/stores/pendingMsgsStore'
import { bumpLastMessage, dropMessage, patchConversation, patchMessage, upsertMessage } from '../messageCache'
import type { CommonGroup, Conversation, Message, MessageReactions, SharedFile } from '../types'

const PAGE_SIZE = 20

export function useConversations() {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.get<{ data: Conversation[] }>('/conversations').then((r) => r.data.data),
  })
}

export function useThreadMessages(convId: string) {
  const query = useInfiniteQuery({
    queryKey: ['messages', convId],
    queryFn: ({ pageParam }) =>
      api
        .get<{ data: { items: Message[] } }>(`/conversations/${convId}/messages`, {
          params: pageParam ? { before: pageParam, limit: PAGE_SIZE } : { limit: PAGE_SIZE },
        })
        .then((r) => ({
          items: r.data.data.items,
          nextCursor: r.data.data.items.length === PAGE_SIZE ? (r.data.data.items[0]?.id ?? null) : null,
        })),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!convId,
  })

  // Pages arrive newest-first; each page is ascending. Flatten oldest → newest.
  const messages = useMemo(
    () => (query.data ? [...query.data.pages].reverse().flatMap((p) => p.items) : []),
    [query.data],
  )
  return { ...query, messages }
}

export function useCommonGroups(convId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['messages', 'common-groups', { convId }],
    queryFn: () => api.get<{ data: CommonGroup[] }>(`/conversations/${convId}/common-groups`).then((r) => r.data.data),
    enabled: enabled && !!convId,
    staleTime: 60_000,
  })
}

export function useSharedFiles(convId: string, limit: number) {
  return useQuery({
    queryKey: ['messages', 'files', { convId, limit }],
    queryFn: () =>
      api
        .get<{ data: SharedFile[] }>(`/conversations/${convId}/files`, { params: { limit } })
        .then((r) => r.data.data),
    enabled: !!convId,
    staleTime: 30_000,
  })
}

export function useUpdatePreferences(convId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ConversationPreferencesInput) =>
      api.patch<{ data: Conversation }>(`/conversations/${convId}/preferences`, input).then((r) => r.data.data),
    onMutate: (input) => {
      const previous = qc.getQueryData<Conversation[]>(['conversations'])
      patchConversation(qc, convId, (c) => ({ ...c, ...input }))
      return { previous }
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous) qc.setQueryData(['conversations'], ctx.previous)
      toast.error('Could not save that setting')
    },
    onSuccess: (conv) => {
      patchConversation(qc, convId, (c) => ({ ...c, ...conv }))
    },
  })
}

export interface OutgoingMessage {
  body?: string
  attachments?: MessageAttachment[]
  viewOnce?: boolean
  stickerUrl?: string
}

function toPayload(m: OutgoingMessage) {
  return m.stickerUrl
    ? { type: 'sticker', sticker_url: m.stickerUrl }
    : {
        ...(m.body ? { body: m.body } : {}),
        ...(m.attachments?.length ? { attachments: m.attachments } : {}),
        ...(m.viewOnce ? { viewOnce: true } : {}),
      }
}

/** Every write a thread makes. Each success lands in the cache directly, so the UI
 *  never waits on the socket echo (which `upsertMessage` then de-duplicates). */
export function useMessageActions(convId: string, notify?: (text: string) => void) {
  const qc = useQueryClient()
  // Success notices go to the thread's inline toast when there is one; errors stay global.
  const say = notify ?? ((text: string) => toast.success(text))
  const user = useAuthStore((s) => s.user)
  const pendingSend = usePendingMsgsStore((s) => s.send)

  const land = (targetConvId: string, message: Message) => {
    upsertMessage(qc, targetConvId, message)
    bumpLastMessage(qc, targetConvId, message)
  }

  /** Plain text goes through the optimistic pending store (sending → sent / retry). */
  function sendText(body: string) {
    if (!user) return
    pendingSend(
      convId,
      body,
      { id: user.id, fullName: user.profile.fullName, profile: { avatarUrl: user.profile.avatarUrl } },
      (message) => land(convId, message as Message),
    )
  }

  const send = useMutation({
    mutationFn: (m: OutgoingMessage) =>
      api.post<{ data: Message }>(`/conversations/${convId}/messages`, toPayload(m)).then((r) => r.data.data),
    onSuccess: (message) => land(convId, message),
    onError: () => toast.error('Message not sent. Try again.'),
  })

  const forward = useMutation({
    mutationFn: ({ targetConvId, message }: { targetConvId: string; message: Message }) =>
      api
        .post<{ data: Message }>(
          `/conversations/${targetConvId}/messages`,
          toPayload({
            body: message.body || undefined,
            attachments: message.viewOnce ? undefined : message.attachments,
            stickerUrl: message.contentType === 'sticker' ? (message.stickerUrl ?? undefined) : undefined,
          }),
        )
        .then((r) => ({ targetConvId, message: r.data.data })),
    onSuccess: ({ targetConvId, message }) => {
      land(targetConvId, message)
      say('Forwarded')
    },
    onError: () => toast.error('Could not forward that message'),
  })

  const edit = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      api.patch<{ data: Message }>(`/conversations/${convId}/messages/${id}`, { body }).then((r) => r.data.data),
    onMutate: ({ id, body }) => patchMessage(qc, convId, id, (m) => ({ ...m, body, editedAt: new Date().toISOString() })),
    onSuccess: (message) => upsertMessage(qc, convId, message),
    onError: () => {
      toast.error('Could not edit that message')
      void qc.invalidateQueries({ queryKey: ['messages', convId] })
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) =>
      api.delete<{ data: Message }>(`/conversations/${convId}/messages/${id}`).then((r) => r.data.data),
    onSuccess: (message) => {
      upsertMessage(qc, convId, message)
      say('Message removed')
    },
    onError: () => toast.error('Could not remove that message'),
  })

  const hide = useMutation({
    mutationFn: (id: string) => api.post(`/conversations/${convId}/messages/${id}/hide`).then(() => id),
    onSuccess: (id) => {
      dropMessage(qc, convId, id)
      void qc.invalidateQueries({ queryKey: ['messages', 'files', { convId }] })
      say('Removed for you')
    },
    onError: () => toast.error('Could not remove that message'),
  })

  const react = useMutation({
    mutationFn: ({ id, key }: { id: string; key: MessageReactionKey | null }) =>
      (key
        ? api.post<{ data: MessageReactions }>(`/conversations/${convId}/messages/${id}/reactions`, {
            reaction_type: key,
          })
        : api.delete<{ data: MessageReactions }>(`/conversations/${convId}/messages/${id}/reactions`)
      ).then((r) => ({ id, reactions: r.data.data })),
    onSuccess: ({ id, reactions }) => patchMessage(qc, convId, id, (m) => ({ ...m, reactions })),
    onError: () => toast.error('Could not save that reaction'),
  })

  const openOnce = useMutation({
    mutationFn: (id: string) =>
      api
        .post<{ data: MessageAttachment }>(`/conversations/${convId}/messages/${id}/open-once`)
        .then((r) => ({ id, attachment: r.data.data })),
    onSuccess: ({ id }) => patchMessage(qc, convId, id, (m) => ({ ...m, viewOnce: { opened: true } })),
    onError: (_err, id) => {
      patchMessage(qc, convId, id, (m) => ({ ...m, viewOnce: { opened: true } }))
      toast.error('This photo has already been opened')
    },
  })

  return { sendText, send, forward, edit, remove, hide, react, openOnce }
}

/** Leave an ad-hoc group chat (group-linked chats follow group membership instead). */
export function useLeaveConversation(convId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.delete(`/conversations/${convId}/leave`),
    onSuccess: () => {
      qc.setQueryData<Conversation[]>(['conversations'], (old) => old?.filter((c) => c.id !== convId))
      void qc.invalidateQueries({ queryKey: ['conversations'] })
      toast.success('You left the chat')
    },
    onError: () => toast.error('Could not leave the chat'),
  })
}
