import { Link } from 'react-router-dom'
import { Avatar } from '@/components/Avatar'
import { RoleBadge } from '@/components/RoleBadge'
import { highlightMatch } from '@/utils/highlightMatch'
import { ConnectButton } from '@/features/connections'
import type { UserSearchResult } from '../types'

const AVATAR_PALETTE = ['var(--uc-indigo)', 'var(--uc-orange)', 'var(--uc-cyan)', 'var(--uc-mint)']

function seedColor(id: string): string {
  const sum = [...id].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_PALETTE[sum % AVATAR_PALETTE.length]!
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
}

interface Props {
  person: UserSearchResult
  query: string
}

export function PeopleResultCard({ person, query }: Props) {
  const color = seedColor(person.id)
  const initials = getInitials(person.fullName)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px 12px',
        borderBottom: '0.5px solid var(--border-default)',
      }}
    >
      <Link
        to={`/profile/${person.id}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flex: 1,
          minWidth: 0,
          textDecoration: 'none',
        }}
      >
        <Avatar initials={initials} color={color} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500, fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.3 }}>
            <RoleBadge role={person.role} size={14} tipPlacement="below" />
            <span>{highlightMatch(person.fullName, query)}</span>
          </div>
          {(person.headline || person.department) && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>
              {person.headline ?? person.department}
            </div>
          )}
        </div>
      </Link>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ flexShrink: 0, marginLeft: 10 }}
      >
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
