import { Link } from 'react-router-dom'
import { Avatar } from '@/components/Avatar'
import { avatarColor, getInitials } from '@/utils/avatar'
import { ConnectButton } from '@/features/connections'
import type { UserSuggestion } from '../types'

interface Props {
  person: UserSuggestion
  isLast?: boolean
}

export function PersonSuggestionCard({ person, isLast = false }: Props) {
  const subtitle = person.headline ?? person.department

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 0',
        borderBottom: isLast ? 'none' : '0.5px solid var(--border-default)',
      }}
    >
      <Link to={`/profile/${person.id}`} style={{ flexShrink: 0, lineHeight: 0 }} aria-label={`View ${person.fullName}'s profile`}>
        <Avatar src={person.avatarUrl ?? undefined} initials={getInitials(person.fullName)} color={avatarColor(person.id)} size={36} />
      </Link>
      <Link
        to={`/profile/${person.id}`}
        style={{ flex: 1, minWidth: 0, textDecoration: 'none' }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--text-primary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {person.fullName}
        </div>
        {subtitle && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              marginTop: 1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {subtitle}
          </div>
        )}
      </Link>
      <div style={{ flexShrink: 0 }}>
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
