import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { MessageCircle, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/Avatar'
import { api } from '@/lib/axios'
import { SkeletonConvRow } from '@/components/skeletons/SkeletonConvRow'
import { EmptyState } from '@/components/EmptyState'
import { NewConversationModal } from './NewConversationModal'
import type { Conversation } from './ConversationList'

// ── Helpers ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'var(--uc-indigo)',
  'var(--uc-orange)',
  'var(--uc-cyan)',
  'var(--uc-mint)',
  'var(--uc-navy)',
]

function seedColor(seed: string): string {
  const sum = [...seed].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_COLORS[sum % AVATAR_COLORS.length]
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function relativeTime(iso: string): string {
  return formatDistanceToNow(parseISO(iso), { addSuffix: false })
    .replace('about ', '')
    .replace(' minutes', 'm')
    .replace(' minute', 'm')
    .replace(' hours', 'h')
    .replace(' hour', 'h')
    .replace(' days', 'd')
    .replace(' day', 'd')
}

// ── SidebarRow ────────────────────────────────────────────────────────────────

function SidebarRow({
  conversation,
  isActive,
  onClick,
}: {
  conversation: Conversation
  isActive: boolean
  onClick: () => void
}) {
  const displayName =
    conversation.type === 'dm'
      ? (conversation.otherParticipant?.fullName ?? 'Unknown')
      : (conversation.name ?? 'Group')

  const avatarInitials = initials(displayName)
  const avatarColor = seedColor(conversation.id)
  const preview = conversation.lastMessage?.body ?? ''
  const time = conversation.lastMessage?.sentAt
    ? relativeTime(conversation.lastMessage.sentAt)
    : null
  const hasUnread = conversation.unreadCount > 0

  return (
    <button
      onClick={onClick}
      className={isActive ? undefined : 'row-hover-bg'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '9px 10px',
        background: isActive ? 'var(--uc-indigo-bg)' : 'transparent',
        border: 'none',
        borderRadius: 'var(--r-md)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 150ms',
      }}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <Avatar initials={avatarInitials} color={avatarColor} size={38} />
        {hasUnread && !isActive && (
          <span
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: 9,
              height: 9,
              borderRadius: '50%',
              background: 'var(--uc-indigo)',
              border: '1.5px solid var(--surface-card)',
            }}
          />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: 13,
              fontWeight: hasUnread ? 500 : 400,
              color: isActive ? 'var(--uc-indigo-xl)' : 'var(--text-primary)',
            }}
          >
            {displayName}
          </span>
          {time && (
            <span
              style={{
                flexShrink: 0,
                fontSize: 11,
                fontWeight: 400,
                color: isActive ? 'var(--uc-indigo-l)' : 'var(--text-tertiary)',
              }}
            >
              {time}
            </span>
          )}
        </div>

        <span
          style={{
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 12,
            fontWeight: 400,
            color: hasUnread ? 'var(--text-secondary)' : 'var(--text-tertiary)',
            marginTop: 1,
          }}
        >
          {preview || ' '}
        </span>
      </div>
    </button>
  )
}

// ── ConversationsSidebar ──────────────────────────────────────────────────────

interface ConversationsSidebarProps {
  activeConvId?: string
}

export function ConversationsSidebar({ activeConvId }: ConversationsSidebarProps) {
  const navigate = useNavigate()
  const [newOpen, setNewOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () =>
      api.get<{ data: Conversation[] }>('/conversations').then((r) => r.data.data),
  })

  // Sort newest-last-message first
  const sorted = data
    ? [...data].sort((a, b) => {
        const at = a.lastMessage?.sentAt ? new Date(a.lastMessage.sentAt).getTime() : 0
        const bt = b.lastMessage?.sentAt ? new Date(b.lastMessage.sentAt).getTime() : 0
        return bt - at
      })
    : []

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 14px 10px',
            flexShrink: 0,
            borderBottom: '0.5px solid var(--border-default)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <MessageCircle size={15} strokeWidth={1.5} style={{ color: 'var(--uc-indigo-l)', flexShrink: 0 }} />
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Messages</span>
          </div>

          <button
            type="button"
            onClick={() => setNewOpen(true)}
            aria-label="New conversation"
            className="row-hover-bg"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 'var(--r-pill)',
              background: 'var(--uc-orange-bg)',
              border: '0.5px solid var(--uc-orange-bdr)',
              color: 'var(--uc-orange-l)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <Plus size={13} strokeWidth={2} />
          </button>
        </div>

        {/* Scrollable conversation list */}
        <div
          className="rail-scroll"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '6px 6px',
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          {isLoading && (
            <>
              <SkeletonConvRow />
              <SkeletonConvRow />
              <SkeletonConvRow />
              <SkeletonConvRow />
            </>
          )}

          {!isLoading && sorted.length === 0 && (
            <EmptyState
              icon={MessageCircle}
              title="No conversations yet"
              description="Message a classmate or alumni to get started."
            />
          )}

          {!isLoading &&
            sorted.map((conv) => (
              <SidebarRow
                key={conv.id}
                conversation={conv}
                isActive={conv.id === activeConvId}
                onClick={() => navigate(`/messages/${conv.id}`)}
              />
            ))}
        </div>
      </div>

      {newOpen && <NewConversationModal onClose={() => setNewOpen(false)} />}
    </>
  )
}
