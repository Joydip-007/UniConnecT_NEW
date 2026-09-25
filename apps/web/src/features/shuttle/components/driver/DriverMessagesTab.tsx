import { Link } from 'react-router-dom'
import { Avatar } from '@/components/Avatar'
import { useConversations } from '@/features/messages/hooks/useMessagesData'
import { initials, relativeTime, seedColor } from '@/features/messages/utils'
import { PATHS } from '@/router/paths'

/** How many recent threads the driver's inbox shows before "Open all messages". */
const THREADS_SHOWN = 8

/** The driver's recent conversations. Each opens the full thread in Messages. */
export function DriverMessagesTab() {
  const { data, isLoading } = useConversations()
  const threads = (data ?? []).slice(0, THREADS_SHOWN)

  return (
    <>
      <h1 className="driver-h1">Messages</h1>
      <section className="driver-card driver-rows-card" style={{ padding: '4px 8px' }}>
        {isLoading && <p style={{ margin: 12, fontSize: 13, color: 'var(--text-tertiary)' }}>Loading…</p>}
        {!isLoading && threads.length === 0 && (
          <p style={{ margin: 12, fontSize: 13, color: 'var(--text-tertiary)' }}>No conversations yet.</p>
        )}
        {threads.map((c, i) => {
          const person = c.type === 'direct' || c.type === 'mentorship'
          const name = person ? (c.otherParticipant?.fullName ?? 'Unknown') : (c.name ?? 'Group')
          const unread = c.unreadCount > 0
          return (
            <Link
              key={c.id}
              to={PATHS.CONVERSATION.replace(':id', c.id)}
              className="driver-thread-row"
              style={{ borderBottom: i < threads.length - 1 ? '0.5px solid var(--border-default)' : 'none' }}
            >
              <Avatar
                src={person ? c.otherParticipant?.profile.avatarUrl : c.avatarUrl}
                initials={initials(name)}
                color={seedColor(c.id)}
                size={40}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{name}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                    {c.lastMessage?.sentAt ? relativeTime(c.lastMessage.sentAt) : ''}
                  </span>
                </span>
                <span
                  style={{
                    display: 'block',
                    fontSize: 13,
                    color: unread ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    marginTop: 2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {c.lastMessage?.body || 'No messages yet'}
                </span>
              </span>
            </Link>
          )
        })}
      </section>
      <Link to={PATHS.MESSAGES} className="driver-btn driver-btn--ghost driver-btn--fit" style={{ textDecoration: 'none' }}>
        Open all messages
      </Link>
    </>
  )
}
