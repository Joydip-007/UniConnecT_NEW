import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/axios'
import { useNotificationsStore } from '@/stores/notificationsStore'
import { Avatar } from '@/components/Avatar'
import {
  NOTIF_QUERY_KEY,
  type Notification,
} from '@/features/notifications/hooks/useNotificationsSocket'

const DROPDOWN_SPRING = { type: 'tween' as const, duration: 0.15, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }
const ROW_SPRING = { type: 'tween' as const, duration: 0.18, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }

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

function NotificationRow({ notif, onNavigate }: { notif: Notification; onNavigate: () => void }) {
  const actor = notif.actor ?? { id: notif.id, fullName: 'UniConnecT', avatarUrl: null }
  const color = seedColor(actor.id)
  const initials = getInitials(actor.fullName)

  return (
    <motion.button
      type="button"
      onClick={onNavigate}
      className={notif.refUrl ? 'row-hover-bg' : undefined}
      layout
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={ROW_SPRING}
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
        {actor.avatarUrl ? (
          <img
            src={actor.avatarUrl}
            alt=""
            style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <Avatar initials={initials} color={color} size={36} />
        )}
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
            fontSize: 11,
            fontWeight: 400,
            color: 'var(--text-tertiary)',
          }}
        >
          {formatDistanceToNow(parseISO(notif.createdAt), { addSuffix: true })}
        </p>
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
    </motion.button>
  )
}

// ── NotificationDropdown ───────────────────────────────────────────────────────

interface Props {
  onClose: () => void
}

export function NotificationDropdown({ onClose }: Props) {
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

  const unreadCount = notifications.filter((n) => !n.isRead).length

  function handleItemClick(notif: Notification) {
    if (!notif.refUrl) return
    onClose()
    navigate(notif.refUrl)
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: -4 }}
      transition={DROPDOWN_SPRING}
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
                fontSize: 11,
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
          <AnimatePresence initial={false}>
            {notifications.map((n) => (
              <NotificationRow
                key={n.id}
                notif={n}
                onNavigate={() => handleItemClick(n)}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  )
}
