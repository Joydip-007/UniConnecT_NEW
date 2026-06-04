import { create } from 'zustand'
import type { PresenceStatus } from '@uniconnect/shared'

export interface PresenceState {
  status: PresenceStatus
  lastSeenAt: string | null
}

interface PresenceStore {
  byUser: Record<string, PresenceState>
  set: (userId: string, state: PresenceState) => void
  setMany: (entries: { userId: string; status: PresenceStatus; lastSeenAt: string | null }[]) => void
}

export const usePresenceStore = create<PresenceStore>((set) => ({
  byUser: {},
  set: (userId, state) => set((s) => ({ byUser: { ...s.byUser, [userId]: state } })),
  setMany: (entries) =>
    set((s) => {
      const next = { ...s.byUser }
      for (const e of entries) next[e.userId] = { status: e.status, lastSeenAt: e.lastSeenAt }
      return { byUser: next }
    }),
}))
