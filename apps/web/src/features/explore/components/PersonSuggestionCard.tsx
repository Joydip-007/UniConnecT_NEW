import { Link } from 'react-router-dom'
import { Users } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { avatarColor, getInitials } from '@/utils/avatar'
import { useAuthStore } from '@/stores/authStore'
import { suggestionReason } from '../suggestionReason'
import { DiscoveryConnectButton } from './DiscoveryConnectButton'
import type { UserSuggestion } from '../types'
import { useExploreLinkState } from '../hooks/useExploreLinkState'
import { RoleBadge } from '@/components/RoleBadge'

interface Props {
  person: UserSuggestion
  isLast?: boolean
}

const ellipsis: React.CSSProperties = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }

export function PersonSuggestionCard({ person, isLast = false }: Props) {
  const linkState = useExploreLinkState()
  const viewer = useAuthStore((s) => s.user?.profile)
  const subtitle = person.headline ?? ([person.department, person.batchYear].filter(Boolean).join(' · ') || null)
  const reason = suggestionReason(person, viewer)

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
      <Link state={linkState} to={`/profile/${person.id}`} style={{ flexShrink: 0, lineHeight: 0 }} aria-label={`View ${person.fullName}'s profile`}>
        <Avatar src={person.avatarUrl ?? undefined} initials={getInitials(person.fullName)} color={avatarColor(person.id)} size={36} />
      </Link>
      <Link
        state={linkState}
        to={`/profile/${person.id}`}
        style={{ flex: 1, minWidth: 0, textDecoration: 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <RoleBadge role={person.role} size={14} tipPlacement="below" />
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', minWidth: 0, ...ellipsis }}>
            {person.fullName}
          </span>
        </div>
        {subtitle && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1, ...ellipsis }}>
            {subtitle}
          </div>
        )}
        {reason && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 12,
              color: 'var(--uc-indigo-l)',
              marginTop: 3,
              ...ellipsis,
            }}
          >
            <Users size={12} aria-hidden="true" style={{ flexShrink: 0 }} />
            {reason}
          </div>
        )}
      </Link>
      <DiscoveryConnectButton person={person} />
    </div>
  )
}
