import { Avatar } from '@/components/Avatar'
import { avatarColor, getInitials } from '@/utils/avatar'
import { formatDate } from '../constants'
import type { MyRequest } from '../types'
import { StatusBadge } from './StatusBadge'

interface MyRequestRowProps {
  request: MyRequest
}

export function MyRequestRow({ request }: MyRequestRowProps) {
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: 16,
        display: 'flex',
        gap: 14,
        alignItems: 'flex-start',
      }}
    >
      <Avatar
        initials={getInitials(request.alumni.fullName)}
        color={avatarColor(request.alumni.id)}
        size={40}
      />

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
            {request.alumni.fullName}
          </p>
          <StatusBadge status={request.status} />
        </div>
        {request.alumni.headline && (
          <p style={{ margin: 0, fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>
            {request.alumni.headline}
          </p>
        )}
        <p
          style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 400,
            color: 'var(--text-tertiary)',
            lineHeight: 1.5,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {request.message}
        </p>
        {request.status === 'accepted' && request.sessionNotes && (
          <div
            style={{
              marginTop: 6,
              padding: '10px 12px',
              background: 'var(--uc-mint-bg)',
              borderRadius: 'var(--r-sm)',
              border: '0.5px solid var(--border-default)',
            }}
          >
            <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 500, color: 'var(--uc-mint)' }}>
              Session notes
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                fontWeight: 400,
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
              }}
            >
              {request.sessionNotes}
            </p>
          </div>
        )}
      </div>

      <span
        style={{
          fontSize: 11,
          fontWeight: 400,
          color: 'var(--text-tertiary)',
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}
      >
        {formatDate(request.createdAt)}
      </span>
    </div>
  )
}
