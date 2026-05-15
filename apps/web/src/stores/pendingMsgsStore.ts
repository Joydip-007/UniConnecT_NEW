import { create } from 'zustand'
import { api } from '@/lib/axios'

interface MsgSender {
  id: string
  fullName: string
  profile: { avatarUrl: string | null }
}

export interface PendingMsg {
  tempId: string
  convId: string
  senderId: string
  sender: MsgSender
  body: string
  sentAt: string
  status: 'sending' | 'error'
}

interface PendingMsgsState {
  msgs: PendingMsg[]
  send: (convId: string, body: string, sender: MsgSender) => void
  retry: (tempId: string) => void
  clear: () => void
}

export const usePendingMsgsStore = create<PendingMsgsState>((set, get) => ({
  msgs: [],

  send(convId, body, sender) {
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    set((s) => ({
      msgs: [
        ...s.msgs,
        {
          tempId,
          convId,
          senderId: sender.id,
          sender,
          body,
          sentAt: new Date().toISOString(),
          status: 'sending',
        },
      ],
    }))
    api
      .post(`/conversations/${convId}/messages`, { body })
      .then(() => set((s) => ({ msgs: s.msgs.filter((m) => m.tempId !== tempId) })))
      .catch(() =>
        set((s) => ({
          msgs: s.msgs.map((m) =>
            m.tempId === tempId ? { ...m, status: 'error' as const } : m,
          ),
        })),
      )
  },

  retry(tempId) {
    const msg = get().msgs.find((m) => m.tempId === tempId)
    if (!msg || msg.status !== 'error') return
    set((s) => ({
      msgs: s.msgs.map((m) =>
        m.tempId === tempId
          ? { ...m, status: 'sending' as const, sentAt: new Date().toISOString() }
          : m,
      ),
    }))
    api
      .post(`/conversations/${msg.convId}/messages`, { body: msg.body })
      .then(() => set((s) => ({ msgs: s.msgs.filter((m) => m.tempId !== tempId) })))
      .catch(() =>
        set((s) => ({
          msgs: s.msgs.map((m) =>
            m.tempId === tempId ? { ...m, status: 'error' as const } : m,
          ),
        })),
      )
  },

  clear: () => set({ msgs: [] }),
}))
