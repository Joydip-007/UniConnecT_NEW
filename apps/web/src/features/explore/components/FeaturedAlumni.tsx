import { Link } from 'react-router-dom'
import { Check, Clock, UserPlus } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { avatarColor, getInitials } from '@/utils/avatar'
import { useConnectionAction } from '@/features/connections'
import { alumniMeta } from '../cardHelpers'
import type { UserSuggestion } from '../types'
import { useExploreLinkState } from '../hooks/useExploreLinkState'
import { RoleBadge } from '@/components/RoleBadge'

interface Props {
  alumni: UserSuggestion[]
}

/** Compact 28px connect control: user-plus → clock (pending, click to withdraw) → check. */
function ConnectIconButton({ person }: { person: UserSuggestion }) {
  const { send, withdraw, accept } = useConnectionAction(person.id)
  const status = person.connectionStatus
  const busy = send.isPending || withdraw.isPending || accept.isPending
  const quiet = status !== 'none' && status !== 'pending_received'

  const Icon = status === 'connected' ? Check : status === 'pending_sent' ? Clock : UserPlus
  const label =
    status === 'connected' ? `Connected with ${person.fullName}`
    : status === 'pending_sent' ? `Withdraw request to ${person.fullName}`
    : status === 'pending_received' ? `Accept ${person.fullName}'s request`
    : `Connect with ${person.fullName}`

  function onClick() {
    if (status === 'none') send.mutate(undefined)
    else if (status === 'pending_sent') withdraw.mutate()
    else if (status === 'pending_received' && person.connectionId) accept.mutate(person.connectionId)
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || status === 'connected'}
      aria-label={label}
      title={label}
      style={{
        flexShrink: 0,
        width: 28,
        height: 28,
        padding: 0,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: quiet ? '0.5px solid var(--border-default)' : 'none',
        background: quiet ? 'transparent' : 'var(--uc-indigo)',
        color: quiet ? 'var(--text-tertiary)' : 'var(--on-accent)',
        cursor: busy || status === 'connected' ? 'default' : 'pointer',
        opacity: busy ? 0.6 : 1,
        lineHeight: 0,
      }}
    >
      <Icon size={13} strokeWidth={2} aria-hidden="true" />
    </button>
  )
}

function AlumniCard({ person }: { person: UserSuggestion }) {
  const linkState = useExploreLinkState()
  const meta = alumniMeta(person)

  return (
    <div
      style={{
        flexShrink: 0,
        // The design sizes this card content-box: 220 + 2×14 padding + 2×0.5 border.
        width: 249,
        boxSizing: 'border-box',
        scrollSnapAlign: 'start',
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: '12px 14px',
        display: 'flex',
        gap: 10,
        alignItems: 'center',
      }}
    >
      <Link
        state={linkState}
        to={`/profile/${person.id}`}
        style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0, flex: 1, textDecoration: 'none' }}
      >
        <Avatar
          src={person.avatarUrl ?? undefined}
          initials={getInitials(person.fullName)}
          color={avatarColor(person.id)}
          size={40}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <RoleBadge role={person.role} size={14} tipPlacement="below" />
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.3, minWidth: 0 }}>
              {person.fullName}
            </span>
          </div>
          {person.headline && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {person.headline}
            </div>
          )}
          {meta && (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {meta}
            </div>
          )}
        </div>
      </Link>
      <ConnectIconButton person={person} />
    </div>
  )
}

export function FeaturedAlumni({ alumni }: Props) {
  if (alumni.length === 0) {
    return (
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>No featured alumni yet.</p>
    )
  }
  return (
    <>
      {alumni.map((person) => (
        <AlumniCard key={person.id} person={person} />
      ))}
    </>
  )
}
