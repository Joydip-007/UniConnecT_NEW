import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { Bell } from 'lucide-react'
import { api } from '@/lib/axios'
import { GhostBtn, PrimaryBtn } from '@/components/Button'
import type { Notification } from '@/features/notifications/hooks/useNotificationsSocket'

interface NotificationsData {
  items: Notification[]
  unreadCount: number
}

export default function NotificationsPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'page'],
    queryFn: () => api.get<{ data: NotificationsData }>('/notifications', { params: { limit: 50 } }).then((r) => r.data.data),
  })

  const markAll = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const notifications = data?.items ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 500, color: 'var(--text-primary)' }}>
          Notifications
        </h1>
        <PrimaryBtn disabled={!data?.unreadCount || markAll.isPending} onClick={() => markAll.mutate()}>
          Mark all read
        </PrimaryBtn>
      </div>

      <div style={{ background: 'var(--surface-card)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
        {isLoading ? (
          <p style={emptyStyle}>Loading notifications…</p>
        ) : notifications.length === 0 ? (
          <p style={emptyStyle}>No notifications yet.</p>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: 14,
                borderBottom: '0.5px solid var(--border-default)',
                background: notification.isRead ? 'transparent' : 'var(--uc-indigo-bg)',
              }}
            >
              <Bell size={16} strokeWidth={1.5} color="var(--uc-indigo-l)" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: notification.isRead ? 400 : 500, color: 'var(--text-primary)' }}>
                  {notification.content}
                </p>
                <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {formatDistanceToNow(parseISO(notification.createdAt), { addSuffix: true })}
                </p>
              </div>
              {!notification.isRead && (
                <GhostBtn onClick={() => markRead.mutate(notification.id)} disabled={markRead.isPending}>
                  Mark read
                </GhostBtn>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

const emptyStyle: React.CSSProperties = {
  margin: 0,
  padding: 24,
  fontSize: 13,
  color: 'var(--text-secondary)',
}
