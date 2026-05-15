import { create } from 'zustand'

interface SocketState {
  connected: boolean
  hasConnected: boolean
  setConnected: (v: boolean) => void
}

export const useSocketStore = create<SocketState>((set) => ({
  connected: false,
  hasConnected: false,
  setConnected: (v) =>
    set((s) => ({ connected: v, hasConnected: s.hasConnected || v })),
}))
