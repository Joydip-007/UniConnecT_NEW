import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Avatar } from '@/components/Avatar'
import { api } from '@/lib/axios'
import { avatarColor, getInitials } from '@/utils/avatar'
import { PATHS } from '@/router/paths'
import { formatDate } from '../constants'
import type { MyRequest } from '../types'
import { StatusBadge } from './StatusBadge'

interface MyRequestRowProps {
  request: MyRequest
}

export function MyRequestRow({ request }: MyRequestRowProps) {
  const isExpired = request.status === 'expired'
  const [confirmingWithdraw, setConfirmingWithdraw] = useState(false)

  const queryClient = useQueryClient()

  const withdrawMutation = useMutation({
    mutationFn: () =>
      api.delete(`/mentorship/requests/${request.id}`).then(() => undefined),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['mentorship', 'requests', 'mine'] })
      setConfirmingWithdraw(false)
    },
    onError: () => {
      setConfirmingWithdraw(false)
    },
  })

  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: `0.5px solid ${isExpired ? 'var(--border-subtle, var(--border-default))' : 'var(--border-default)'}`,
        borderRadius: 'var(--r-lg)',
        padding: 16,
        display: 'flex',
        gap: 14,
        alignItems: 'flex-start',
        opacity: isExpired ? 0.7 : 1,
        transition: 'opacity 200ms',
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

        {isExpired && (
          <p
            style={{
              margin: 0,
              fontSize: 12,
              fontWeight: 400,
              color: 'var(--text-tertiary)',
              fontStyle: 'italic',
            }}
          >
            Request expired — mentor didn't respond in time
          </p>
        )}

        {!isExpired && (
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
        )}

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

        {/* Open chat link */}
        {request.status === 'accepted' && request.conversationId && (
          <Link
            to={`${PATHS.MESSAGES}/${request.conversationId}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              marginTop: 4,
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--uc-indigo-xl)',
              textDecoration: 'none',
              width: 'fit-content',
              transition: 'opacity 150ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.75' }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
          >
            <MessageCircle size={13} strokeWidth={2} />
            Open chat
          </Link>
        )}

        {/* Withdraw button — pending requests only */}
        {request.status === 'pending' && (
          <div style={{ marginTop: 2 }}>
            {!confirmingWithdraw ? (
              <button
                type="button"
                onClick={() => setConfirmingWithdraw(true)}
                style={{
                  fontSize: 12,
                  fontWeight: 400,
                  color: 'var(--text-tertiary)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 0',
                  borderRadius: 'var(--r-pill)',
                }}
              >
                Withdraw request
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Withdraw this request?
                </span>
                <button
                  type="button"
                  onClick={() => withdrawMutation.mutate()}
                  disabled={withdrawMutation.isPending}
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    padding: '5px 12px',
                    borderRadius: 'var(--r-pill)',
                    border: 'none',
                    background: 'var(--surface-raised)',
                    color: 'var(--text-secondary)',
                    cursor: withdrawMutation.isPending ? 'not-allowed' : 'pointer',
                    opacity: withdrawMutation.isPending ? 0.6 : 1,
                  }}
                >
                  Yes, withdraw
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingWithdraw(false)}
                  style={{
                    fontSize: 12,
                    fontWeight: 400,
                    padding: '5px 10px',
                    borderRadius: 'var(--r-pill)',
                    border: '0.5px solid var(--border-default)',
                    background: 'transparent',
                    color: 'var(--text-tertiary)',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
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
