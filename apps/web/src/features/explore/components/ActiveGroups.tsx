import { Link } from 'react-router-dom'
import { Avatar } from '@/components/Avatar'
import { avatarColor, getInitials } from '@/utils/avatar'
import type { GroupSummary } from '../types'

interface Props {
  groups: GroupSummary[]
}

export function ActiveGroups({ groups }: Props) {
  if (groups.length === 0) {
    return (
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>No active groups to join.</p>
    )
  }

  return (
    <>
      {groups.map((group) => (
        <Link
          key={group.id}
          to={`/groups/${group.id}`}
          style={{
            flexShrink: 0,
            width: 148,
            scrollSnapAlign: 'start',
            background: 'var(--surface-card)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-lg)',
            padding: '14px 12px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            textDecoration: 'none',
          }}
        >
          <Avatar initials={getInitials(group.name)} color={avatarColor(group.id)} size={44} />
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--text-primary)',
                lineHeight: 1.3,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {group.name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              {group.memberCount} members
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>
              {group.recentPostCount} posts this week
            </div>
          </div>
        </Link>
      ))}
    </>
  )
}
