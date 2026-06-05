import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { Bell, CheckCircle2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/axios'
import { GhostBtn, PrimaryBtn } from '@/components/Button'
import type { Notification } from '@/features/notifications/hooks/useNotificationsSocket'

interface NotificationsData {
  items: Notification[]
  unreadCount: number
}

interface ApiError {
  response?: { data?: { error?: string } }
}

export default function NotificationsPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'page'],
    queryFn: () =>
      api.get<{ data: NotificationsData }>('/notifications', { params: { limit: 50 } }).then((r) => r.data.data),
  })

  const markAll = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const acceptInvite = useMutation({
    mutationFn: (id: string) =>
      api
        .post<{ data: { group: { id: string }; notificationId: string } }>(`/notifications/${id}/accept`)
        .then((r) => r.data.data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['groups', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['groups', 'detail', result.group.id] })
      toast.success('Joined group')
      navigate(`/groups/${result.group.id}`)
    },
    onError: (error: ApiError) => {
      toast.error(error.response?.data?.error ?? 'Failed to accept invitation')
    },
  })

  const dismiss = useMutation({
    mutationFn: (id: string) => api.delete(`/notifications/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const notifications = data?.items ?? []

  // Clicking a row opens its deep link (single post, group, connections, …) and
  // marks it read. Action buttons inside the row stopPropagation so they don't navigate.
  function handleRowClick(notification: Notification) {
    if (!notification.refUrl) return
    if (!notification.isRead) markRead.mutate(notification.id)
    navigate(notification.refUrl)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 500, color: 'var(--text-primary)' }}>Notifications</h1>
        <PrimaryBtn disabled={!data?.unreadCount || markAll.isPending} onClick={() => markAll.mutate()}>
          Mark all read
        </PrimaryBtn>
      </div>

      <div
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          overflow: 'hidden',
        }}
      >
        {isLoading ? (
          <p style={emptyStyle}>Loading notifications…</p>
        ) : notifications.length === 0 ? (
          <p style={emptyStyle}>No notifications yet.</p>
        ) : (
          notifications.map((notification) => {
            const isGroupInvite = notification.type === 'group_invite'
            const Icon = isGroupInvite ? UserPlus : Bell
            return (
              <div
                key={notification.id}
                onClick={() => handleRowClick(notification)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 14,
                  borderBottom: '0.5px solid var(--border-default)',
                  background: notification.isRead ? 'transparent' : 'var(--uc-indigo-bg)',
                  cursor: notification.refUrl ? 'pointer' : 'default',
                }}
              >
                <Icon size={16} strokeWidth={1.5} color="var(--uc-indigo-l)" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      fontWeight: notification.isRead ? 400 : 500,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {notification.content}
                  </p>
                  <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {formatDistanceToNow(parseISO(notification.createdAt), { addSuffix: true })}
                  </p>
                </div>

                {isGroupInvite && !notification.isRead ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <GhostBtn
                      onClick={(e) => {
                        e.stopPropagation()
                        dismiss.mutate(notification.id)
                      }}
                      disabled={dismiss.isPending || acceptInvite.isPending}
                      style={{ padding: '5px 12px', fontSize: 12 }}
                    >
                      Decline
                    </GhostBtn>
                    <PrimaryBtn
                      onClick={(e) => {
                        e.stopPropagation()
                        acceptInvite.mutate(notification.id)
                      }}
                      disabled={acceptInvite.isPending}
                      style={{ padding: '5px 14px', fontSize: 12 }}
                    >
                      Join
                    </PrimaryBtn>
                  </div>
                ) : isGroupInvite && notification.isRead ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 12,
                      color: 'var(--text-tertiary)',
                    }}
                  >
                    <CheckCircle2 size={12} strokeWidth={2} /> Handled
                  </span>
                ) : !notification.isRead ? (
                  <GhostBtn
                    onClick={(e) => {
                      e.stopPropagation()
                      markRead.mutate(notification.id)
                    }}
                    disabled={markRead.isPending}
                    style={{ padding: '5px 12px', fontSize: 12 }}
                  >
                    Mark read
                  </GhostBtn>
                ) : null}
              </div>
            )
          })
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
