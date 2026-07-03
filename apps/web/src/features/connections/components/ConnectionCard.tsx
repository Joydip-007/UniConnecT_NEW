import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '@/components/Avatar'
import { RoleBadge } from '@/components/RoleBadge'
import { avatarColor, getInitials } from '@/utils/avatar'
import { PATHS } from '@/router/paths'
import { api } from '@/lib/axios'
import { useNavigate } from 'react-router-dom'
import type { Connection } from '@uniconnect/shared'
import type { UserRole } from '@uniconnect/shared'
import { useConnectionAction } from '../hooks/useConnectionAction'

interface Props {
  connection: Connection
}

export function ConnectionCard({ connection }: Props) {
  const navigate = useNavigate()
  const userId = connection.user?.id ?? ''
  const { remove } = useConnectionAction(userId)
  const [confirming, setConfirming] = useState(false)

  const user = connection.user
  const fullName = user?.fullName ?? 'Unknown'
  const initials = getInitials(fullName)
  const color = avatarColor(userId)

  const handleMessage = async () => {
    try {
      const res = await api.post<{ data: { id: string } }>('/conversations', {
        participantId: userId,
      })
      navigate(PATHS.CONVERSATION.replace(':id', res.data.data.id))
    } catch {
      navigate(PATHS.MESSAGES)
    }
  }

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
      <Link to={PATHS.PROFILE.replace(':id', userId)} style={{ flexShrink: 0 }}>
        <Avatar
          initials={initials}
          color={color}
          size={44}
          src={user?.avatarUrl}
        />
      </Link>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Link
            to={PATHS.PROFILE.replace(':id', userId)}
            style={{ textDecoration: 'none' }}
          >
            <span
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--text-primary)',
                lineHeight: 1.3,
              }}
            >
              {fullName}
            </span>
          </Link>
          {user?.role && <RoleBadge role={user.role as UserRole} size={14} />}
        </div>
        {(user?.headline || user?.department) && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            {user.headline ?? user.department}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
        {confirming ? (
          // Inline confirmation — replaces both action buttons
          <>
            <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              Remove?
            </span>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              style={{
                ...pillBase,
                background: 'transparent',
                border: '0.5px solid var(--border-hover)',
                color: 'var(--text-secondary)',
                fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false)
                remove.mutate()
              }}
              disabled={remove.isPending}
              style={{
                ...pillBase,
                background: 'transparent',
                border: '0.5px solid var(--uc-red)',
                color: 'var(--uc-red)',
                opacity: remove.isPending ? 0.6 : 1,
                fontFamily: 'inherit',
              }}
            >
              Confirm
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={handleMessage}
              style={{
                ...pillBase,
                background: 'var(--uc-indigo)',
                color: 'var(--uc-indigo-xl)',
                border: 'none',
                fontFamily: 'inherit',
              }}
            >
              Message
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={remove.isPending}
              style={{
                ...pillBase,
                background: 'transparent',
                border: '0.5px solid var(--border-hover)',
                color: 'var(--text-secondary)',
                opacity: remove.isPending ? 0.6 : 1,
                fontFamily: 'inherit',
              }}
            >
              Remove
            </button>
          </>
        )}
      </div>
    </div>
  )
}
