import { create } from 'zustand'

interface NotificationsState {
  messageCount: number
  notificationCount: number
  setMessageCount: (n: number) => void
  setNotificationCount: (n: number) => void
  incrementMessage: () => void
  incrementNotification: () => void
  clearMessageCount: () => void
  clearNotificationCount: () => void
}

export const useNotificationsStore = create<NotificationsState>((set) => ({
  messageCount: 0,
  notificationCount: 0,
  setMessageCount: (n) => set({ messageCount: n }),
  setNotificationCount: (n) => set({ notificationCount: n }),
  incrementMessage: () => set((s) => ({ messageCount: s.messageCount + 1 })),
  incrementNotification: () => set((s) => ({ notificationCount: s.notificationCount + 1 })),
  clearMessageCount: () => set({ messageCount: 0 }),
  clearNotificationCount: () => set({ notificationCount: 0 }),
}))
