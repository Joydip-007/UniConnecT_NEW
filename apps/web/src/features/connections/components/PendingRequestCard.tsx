import { Link } from 'react-router-dom'
import { Avatar } from '@/components/Avatar'
import { avatarColor, getInitials } from '@/utils/avatar'
import { PATHS } from '@/router/paths'
import type { ConnectionRequest } from '@uniconnect/shared'
import { useConnectionAction } from '../hooks/useConnectionAction'

interface Props {
  request: ConnectionRequest
}

export function PendingRequestCard({ request }: Props) {
  const requesterId = request.requesterId
  const { accept, decline } = useConnectionAction(requesterId)

  const requester = request.requester
  const fullName = requester?.fullName ?? 'Unknown'
  const initials = getInitials(fullName)
  const color = avatarColor(requesterId)

  const pillBase: React.CSSProperties = {
    borderRadius: 'var(--r-pill)',
    cursor: 'pointer',
    fontWeight: 500,
    fontSize: 12,
    padding: '4px 12px',
    lineHeight: 1,
    transition: 'opacity 150ms',
  }

  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <Link to={PATHS.PROFILE.replace(':id', requesterId)} style={{ flexShrink: 0 }}>
        <Avatar
          initials={initials}
          color={color}
          size={44}
          src={requester?.avatarUrl}
        />
      </Link>

      <div style={{ flex: 1, minWidth: 0 }}>
        <Link
          to={PATHS.PROFILE.replace(':id', requesterId)}
          style={{ textDecoration: 'none' }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--text-primary)',
              lineHeight: 1.3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {fullName}
          </div>
        </Link>
        {(requester?.headline || requester?.department) && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            {requester.headline ?? requester.department}
          </div>
        )}
        {requester?.mutualConnections != null && requester.mutualConnections > 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>
            {requester.mutualConnections} mutual connection{requester.mutualConnections !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button
          onClick={() => accept.mutate(request.id)}
          disabled={accept.isPending || decline.isPending}
          style={{
            ...pillBase,
            background: 'var(--uc-indigo)',
            color: 'var(--uc-indigo-xl)',
            border: 'none',
            opacity: accept.isPending ? 0.6 : 1,
          }}
        >
          Accept
        </button>
        <button
          onClick={() => decline.mutate(request.id)}
          disabled={accept.isPending || decline.isPending}
          style={{
            ...pillBase,
            background: 'transparent',
            border: '0.5px solid var(--border-hover)',
            color: 'var(--text-secondary)',
            opacity: decline.isPending ? 0.6 : 1,
          }}
        >
          Decline
        </button>
      </div>
    </div>
  )
}
