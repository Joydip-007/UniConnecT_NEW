import { Link } from 'react-router-dom'
import { Avatar } from '@/components/Avatar'
import { avatarColor, getInitials } from '@/utils/avatar'
import { ConnectButton } from '@/features/connections'
import type { UserSuggestion } from '../types'

interface Props {
  person: UserSuggestion
}

export function PersonSuggestionCard({ person }: Props) {
  return (
    <div
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
      }}
    >
      <Link
        to={`/profile/${person.id}`}
        style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
      >
        <Avatar initials={getInitials(person.fullName)} color={avatarColor(person.id)} size={44} />
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
            {person.fullName}
          </div>
          {(person.headline || person.department) && (
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
              {person.headline ?? person.department}
            </div>
          )}
        </div>
      </Link>
      <div style={{ width: '100%' }}>
        <ConnectButton
          targetUserId={person.id}
          targetName={person.fullName}
          connectionStatus={person.connectionStatus ?? 'none'}
          connectionId={person.connectionId ?? null}
          size="sm"
        />
      </div>
    </div>
  )
}
