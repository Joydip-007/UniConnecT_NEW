import { Link } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { avatarColor, getInitials } from '@/utils/avatar'
import { useDiscoveryJoinGroup } from '../hooks/useDiscoveryActions'
import { discoveryGroupNotice, groupKindLabel, knownLabel } from '../cardHelpers'
import type { GroupSummary } from '../types'
import { useExploreLinkState } from '../hooks/useExploreLinkState'
import { useLockedLinkGuard } from '../hooks/useLockedLinkGuard'

interface Props {
  groups: GroupSummary[]
}

/** Join / Request / Joined / Requested — shared by the carousel card and the See-all grid. */
export function GroupJoinButton({ group, size = 28 }: { group: GroupSummary; size?: 28 | 32 }) {
  const { mutate, isPending } = useDiscoveryJoinGroup(group)

  const state = group.joined ? 'joined' : group.requestPending ? 'requested' : group.isPrivate ? 'request' : 'join'
  const label = { joined: 'Joined', requested: 'Requested', request: 'Request', join: 'Join' }[state]
  const look: React.CSSProperties =
    state === 'join'
      ? { background: 'var(--uc-indigo)', color: 'var(--on-accent)', border: '0.5px solid transparent' }
      : state === 'joined'
        ? { background: 'transparent', color: 'var(--uc-mint)', border: '0.5px solid var(--uc-mint-bdr)' }
        : state === 'request'
          ? { background: 'transparent', color: 'var(--uc-indigo-xl)', border: '0.5px solid var(--uc-indigo-bdr)' }
          : { background: 'transparent', color: 'var(--text-secondary)', border: '0.5px solid var(--border-default)' }

  const aria = {
    joined: `Leave ${group.name}`,
    requested: `Cancel request to join ${group.name}`,
    request: `Request to join ${group.name}`,
    join: `Join ${group.name}`,
  }[state]

  return (
    <button
      type="button"
      onClick={() => mutate()}
      disabled={isPending}
      aria-label={aria}
      style={{
        flexShrink: 0,
        minHeight: size,
        padding: '0 14px',
        borderRadius: 'var(--r-pill)',
        fontSize: 12,
        fontWeight: 500,
        cursor: isPending ? 'default' : 'pointer',
        opacity: isPending ? 0.6 : 1,
        whiteSpace: 'nowrap',
        ...look,
      }}
    >
      {label}
    </button>
  )
}

export function KnownFaces({ group }: { group: GroupSummary }) {
  if (group.knownFaces.length === 0) return null
  return (
    <span style={{ display: 'flex', flexShrink: 0 }} aria-hidden="true">
      {group.knownFaces.map((f, i) => (
        <span
          key={f.id}
          style={{
            marginLeft: i === 0 ? 0 : -8,
            borderRadius: '50%',
            border: '1.5px solid var(--surface-card)',
            lineHeight: 0,
          }}
        >
          <Avatar src={f.avatarUrl ?? undefined} initials={getInitials(f.fullName)} color={avatarColor(f.id)} size={20} />
        </span>
      ))}
    </span>
  )
}

function GroupCard({ group }: { group: GroupSummary }) {
  const linkState = useExploreLinkState()
  const guard = useLockedLinkGuard()
  return (
    <div
      className="explore-rail-card"
      style={{
        flexShrink: 0,
        width: 220,
        height: 132,
        boxSizing: 'border-box',
        scrollSnapAlign: 'start',
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <Link
        state={linkState}
        to={`/groups/${group.id}`}
        onClick={guard(discoveryGroupNotice(group))}
        style={{ display: 'flex', gap: 10, flex: 1, minHeight: 0, textDecoration: 'none' }}
      >
        <Avatar src={group.avatarUrl ?? undefined} initials={getInitials(group.name)} color={avatarColor(group.id)} size={40} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--text-primary)',
              lineHeight: 1.35,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {group.name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden' }}>
            <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.04em', color: 'var(--text-label)', flexShrink: 0 }}>
              {groupKindLabel(group.type)}
            </span>
            {group.isPrivate && (
              <Lock size={11} aria-label="Private group" style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
            )}
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {group.memberCount.toLocaleString()}
            </span>
          </div>
        </div>
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <KnownFaces group={group} />
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {knownLabel(group.knownCount)}
          </span>
        </div>
        <GroupJoinButton group={group} />
      </div>
    </div>
  )
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
        <GroupCard key={group.id} group={group} />
      ))}
    </>
  )
}
