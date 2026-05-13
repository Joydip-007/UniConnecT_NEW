import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { socket } from '@/lib/socket'
import { useNotificationsStore } from '@/stores/notificationsStore'

export interface Notification {
  id: string
  type: string
  isRead: boolean
  actor: {
    id: string
    fullName: string
    avatarUrl: string | null
  }
  content: string
  refUrl: string | null
  createdAt: string
}

export const NOTIF_QUERY_KEY = ['notifications', 'unread'] as const

export function useNotificationsSocket(userId: string | undefined) {
  const queryClient = useQueryClient()
  const increment = useNotificationsStore((s) => s.incrementNotification)

  useEffect(() => {
    if (!userId) return

    function onNew(notif: Notification) {
      queryClient.setQueryData<Notification[]>(NOTIF_QUERY_KEY, (prev) =>
        prev ? [notif, ...prev] : [notif],
      )
      increment()
    }

    socket.on('notification:new', onNew)
    return () => {
      socket.off('notification:new', onNew)
    }
  }, [userId, queryClient, increment])
}
