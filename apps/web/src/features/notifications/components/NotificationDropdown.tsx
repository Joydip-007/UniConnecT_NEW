import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Bell } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '@/lib/axios'
import { useNotificationsStore } from '@/stores/notificationsStore'
import { Avatar } from '@/components/Avatar'
import { GhostBtn, PrimaryBtn } from '@/components/Button'
import { popoverIn, listStagger, listItem } from '@/lib/motion'
import {
  NOTIF_QUERY_KEY,
  type Notification,
} from '@/features/notifications/hooks/useNotificationsSocket'

interface ApiError {
  response?: { data?: { error?: string } }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const AVATAR_PALETTE = ['var(--uc-indigo)', 'var(--uc-orange)', 'var(--uc-cyan)', 'var(--uc-mint)']

function seedColor(id: string) {
  const sum = [...id].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_PALETTE[sum % AVATAR_PALETTE.length]
}

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
}

// ── NotificationRow ────────────────────────────────────────────────────────────

function NotificationRow({
  notif,
  onNavigate,
  onAccept,
  onDecline,
  actionPending,
  reduced,
}: {
  notif: Notification
  onNavigate: () => void
  onAccept: () => void
  onDecline: () => void
  actionPending: boolean
  reduced: boolean
}) {
  const actor = notif.actor ?? { id: notif.id, fullName: 'UniConnecT', avatarUrl: null }
  const color = seedColor(actor.id)
  const initials = getInitials(actor.fullName)
  // Unread group invites are actionable inline — accepting joins the group and opens
  // its feed, so the user never has to visit the full notifications page.
  const isActionableInvite = notif.type === 'group_invite' && !notif.isRead

  return (
    <motion.div
      onClick={onNavigate}
      role={notif.refUrl ? 'button' : undefined}
      tabIndex={notif.refUrl ? 0 : undefined}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && notif.refUrl) {
          e.preventDefault()
          onNavigate()
        }
      }}
      className={notif.refUrl ? 'row-hover-bg' : undefined}
      layout
      variants={reduced ? undefined : listItem}
      initial={reduced ? false : undefined}
      exit={reduced ? undefined : { opacity: 0, x: -8 }}
      transition={popoverIn.exitTransition}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        width: '100%',
        padding: '10px 16px',
        background: notif.isRead ? 'transparent' : 'var(--uc-indigo-bg)',
        border: 'none',
        borderBottom: '0.5px solid var(--border-default)',
        cursor: notif.refUrl ? 'pointer' : 'default',
        textAlign: 'left',
        transition: 'background 150ms ease',
      }}
    >
      <div style={{ flexShrink: 0, marginTop: 1 }}>
        <Avatar src={actor.avatarUrl} initials={initials} color={color} size={36} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: notif.isRead ? 400 : 500,
            color: 'var(--text-primary)',
            lineHeight: 1.45,
          }}
        >
          {notif.content}
        </p>
        <p
          style={{
            margin: '3px 0 0',
            fontSize: 12,
            fontWeight: 400,
            color: 'var(--text-tertiary)',
          }}
        >
          {formatDistanceToNow(parseISO(notif.createdAt), { addSuffix: true })}
        </p>

        {isActionableInvite && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <PrimaryBtn
              onClick={(e) => {
                e.stopPropagation()
                onAccept()
              }}
              disabled={actionPending}
              style={{ padding: '4px 12px', fontSize: 12 }}
            >
              Join
            </PrimaryBtn>
            <GhostBtn
              onClick={(e) => {
                e.stopPropagation()
                onDecline()
              }}
              disabled={actionPending}
              style={{ padding: '4px 12px', fontSize: 12 }}
            >
              Decline
            </GhostBtn>
          </div>
        )}
      </div>

      {!notif.isRead && (
        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'var(--uc-indigo)',
            flexShrink: 0,
            marginTop: 5,
          }}
        />
      )}
    </motion.div>
  )
}

// ── NotificationDropdown ───────────────────────────────────────────────────────

interface Props {
  onClose: () => void
}

export function NotificationDropdown({ onClose }: Props) {
  const reduced = useReducedMotion()
  const queryClient = useQueryClient()
  const clearNotificationCount = useNotificationsStore((s) => s.clearNotificationCount)
  const navigate = useNavigate()

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: NOTIF_QUERY_KEY,
    queryFn: () =>
      api
        .get<{ data: { items: Notification[] } }>('/notifications', { params: { limit: 10, isRead: false } })
        .then((r) => r.data.data.items),
  })

  const markAllMutation = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => {
      queryClient.setQueryData<Notification[]>(NOTIF_QUERY_KEY, (prev) =>
        prev?.map((n) => ({ ...n, isRead: true })) ?? [],
      )
      clearNotificationCount()
    },
  })

  const acceptInvite = useMutation({
    mutationFn: (id: string) =>
      api
        .post<{ data: { group: { id: string } } }>(`/notifications/${id}/accept`)
        .then((r) => r.data.data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      clearNotificationCount()
      toast.success('Joined group')
      onClose()
      navigate(`/groups/${result.group.id}`)
    },
    onError: (error: ApiError) => {
      toast.error(error.response?.data?.error ?? 'Failed to accept invitation')
    },
  })

  // Declining deletes the invite notification, which also clears it from the
  // group admin's pending-invites list.
  const declineInvite = useMutation({
    mutationFn: (id: string) => api.delete(`/notifications/${id}`),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<Notification[]>(NOTIF_QUERY_KEY, (prev) =>
        prev?.filter((n) => n.id !== id) ?? [],
      )
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['groups'] })
    },
    onError: (error: ApiError) => {
      toast.error(error.response?.data?.error ?? 'Failed to decline invitation')
    },
  })

  const actionPending = acceptInvite.isPending || declineInvite.isPending
  const unreadCount = notifications.filter((n) => !n.isRead).length

  function handleItemClick(notif: Notification) {
    if (!notif.refUrl) return
    onClose()
    navigate(notif.refUrl)
  }

  return (
    <motion.div
      initial={reduced ? false : popoverIn.initial}
      animate={popoverIn.animate}
      exit={reduced ? undefined : popoverIn.exit}
      transition={popoverIn.transition}
      style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        right: 0,
        width: 340,
        background: 'var(--surface-raised)',
        border: '0.5px solid var(--border-hover)',
        borderRadius: 'var(--r-lg)',
        zIndex: 100,
        overflow: 'hidden',
        boxSizing: 'border-box',
        transformOrigin: 'top right',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px 10px',
          borderBottom: '0.5px solid var(--border-default)',
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
          Notifications
          {unreadCount > 0 && (
            <span
              style={{
                marginLeft: 6,
                fontSize: 12,
                fontWeight: 500,
                padding: '1px 6px',
                borderRadius: 'var(--r-pill)',
                background: 'var(--uc-indigo-bg)',
                color: 'var(--uc-indigo-l)',
              }}
            >
              {unreadCount}
            </span>
          )}
        </span>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 400,
              color: 'var(--uc-indigo-l)',
              padding: 0,
            }}
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Body */}
      <div style={{ maxHeight: 380, overflowY: 'auto' }}>
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '10px 16px',
                borderBottom: '0.5px solid var(--border-default)',
              }}
            >
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--surface-card)', flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 2 }}>
                <div style={{ height: 12, width: '80%', background: 'var(--surface-card)', borderRadius: 'var(--r-sm)' }} />
                <div style={{ height: 10, width: '40%', background: 'var(--surface-card)', borderRadius: 'var(--r-sm)' }} />
              </div>
            </div>
          ))
        ) : notifications.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '32px 16px',
              gap: 8,
            }}
          >
            <Bell size={28} strokeWidth={1} color="var(--text-tertiary)" />
            <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-tertiary)' }}>
              No new notifications
            </p>
          </div>
        ) : (
          <motion.div
            variants={reduced ? undefined : listStagger(20)}
            initial={reduced ? false : 'initial'}
            animate="animate"
          >
            <AnimatePresence initial={false}>
              {notifications.map((n) => (
                <NotificationRow
                  key={n.id}
                  notif={n}
                  onNavigate={() => handleItemClick(n)}
                  onAccept={() => acceptInvite.mutate(n.id)}
                  onDecline={() => declineInvite.mutate(n.id)}
                  actionPending={actionPending}
                  reduced={!!reduced}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
