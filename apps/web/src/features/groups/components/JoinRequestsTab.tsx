import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { CheckCircle2, X } from 'lucide-react'
import {
  useApproveAllJoinRequests,
  useJoinRequests,
  useReviewJoinRequest,
  type JoinRequest,
  type JoinRequestStatus,
} from '@/features/groups'
import { Avatar } from '@/components/Avatar'
import { avatarColor as seedColor, getInitials } from '@/utils/avatar'

interface Props {
  groupId: string
}

const STATUSES: JoinRequestStatus[] = ['pending', 'approved', 'declined']
const STATUS_LABEL: Record<JoinRequestStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  declined: 'Declined',
}

export function JoinRequestsTab({ groupId }: Props) {
  const [status, setStatus] = useState<JoinRequestStatus>('pending')

  const pendingCount = useJoinRequests(groupId, { status: 'pending', limit: 1 })
  const approvedCount = useJoinRequests(groupId, { status: 'approved', limit: 1 })
  const declinedCount = useJoinRequests(groupId, { status: 'declined', limit: 1 })
  const counts: Record<JoinRequestStatus, number> = {
    pending: pendingCount.data?.total ?? 0,
    approved: approvedCount.data?.total ?? 0,
    declined: declinedCount.data?.total ?? 0,
  }

  const { data, isLoading } = useJoinRequests(groupId, { status })
  const reviewMutation = useReviewJoinRequest(groupId)
  const approveAllMutation = useApproveAllJoinRequests(groupId)

  const requests = data?.items ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              style={{
                padding: '4px 12px',
                fontSize: 12,
                fontWeight: 400,
                borderRadius: 'var(--r-pill)',
                border: s === status ? 'none' : '0.5px solid var(--border-default)',
                background: s === status ? 'var(--uc-indigo)' : 'none',
                color: s === status ? 'var(--on-accent)' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              {STATUS_LABEL[s]} {counts[s]}
            </button>
          ))}
        </div>

        {status === 'pending' && counts.pending > 1 && (
          <button
            type="button"
            disabled={approveAllMutation.isPending}
            onClick={() => approveAllMutation.mutate(requests.map((r) => r.id))}
            style={{
              padding: '4px 12px',
              fontSize: 12,
              fontWeight: 400,
              borderRadius: 'var(--r-pill)',
              border: '0.5px solid var(--border-default)',
              background: 'none',
              color: 'var(--text-secondary)',
              cursor: approveAllMutation.isPending ? 'not-allowed' : 'pointer',
              opacity: approveAllMutation.isPending ? 0.7 : 1,
            }}
          >
            Approve all {counts.pending}
          </button>
        )}
      </div>

      {isLoading ? (
        <RequestsSkeleton />
      ) : requests.length === 0 ? (
        <EmptyState status={status} />
      ) : (
        <div style={{ background: 'var(--surface-card)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
          {requests.map((req, idx) => (
            <RequestRow
              key={req.id}
              request={req}
              isLast={idx === requests.length - 1}
              onApprove={() => reviewMutation.mutate({ requestId: req.id, action: 'approve' })}
              onDecline={() => reviewMutation.mutate({ requestId: req.id, action: 'decline' })}
              onUndo={() => reviewMutation.mutate({ requestId: req.id, action: 'undo' })}
              isPending={reviewMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyState({ status }: { status: JoinRequestStatus }) {
  const message =
    status === 'pending'
      ? 'No requests waiting. Approved and declined requests stay listed for 30 days.'
      : `Nothing ${status} yet.`

  return (
    <div style={{ padding: '32px 16px', textAlign: 'center', background: 'var(--surface-card)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-lg)' }}>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>{message}</p>
    </div>
  )
}

function RequestRow({ request, isLast, onApprove, onDecline, onUndo, isPending }: {
  request: JoinRequest
  isLast: boolean
  onApprove: () => void
  onDecline: () => void
  onUndo: () => void
  isPending: boolean
}) {
  const age = getRelativeAge(request.createdAt)
  const meta = [request.requester.department, `requested ${age}`].filter(Boolean).join(' · ')

  return (
    <div style={{ padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'flex-start', borderBottom: isLast ? 'none' : '0.5px solid var(--border-default)' }}>
      <Avatar
        src={request.requester.avatarUrl}
        initials={getInitials(request.requester.fullName ?? '?')}
        color={seedColor(request.userId)}
        size={36}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: '0 0 1px', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
          {request.requester.fullName ?? 'Unknown'}
        </p>
        <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)' }}>{meta}</p>
        {request.message && (
          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
            "{request.message}"
          </p>
        )}

        {request.status === 'pending' ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              disabled={isPending}
              onClick={onApprove}
              style={{ padding: '4px 12px', fontSize: 12, fontWeight: 400, borderRadius: 'var(--r-pill)', border: 'none', background: 'var(--uc-indigo)', color: 'var(--on-accent)', cursor: isPending ? 'not-allowed' : 'pointer', opacity: isPending ? 0.7 : 1 }}
            >
              Approve
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={onDecline}
              style={{ padding: '4px 12px', fontSize: 12, fontWeight: 400, borderRadius: 'var(--r-pill)', border: '0.5px solid var(--border-default)', background: 'none', color: 'var(--text-secondary)', cursor: isPending ? 'not-allowed' : 'pointer', opacity: isPending ? 0.7 : 1 }}
            >
              Decline
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {request.status === 'approved' ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 400, color: 'var(--uc-mint)' }}>
                <CheckCircle2 size={14} strokeWidth={1.5} />
                Approved, now a member
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>
                <X size={14} strokeWidth={1.5} />
                Declined
              </span>
            )}
            <button
              type="button"
              disabled={isPending}
              onClick={onUndo}
              style={{ padding: '4px 12px', fontSize: 12, fontWeight: 400, borderRadius: 'var(--r-pill)', border: '0.5px solid var(--border-default)', background: 'none', color: 'var(--text-secondary)', cursor: isPending ? 'not-allowed' : 'pointer', opacity: isPending ? 0.7 : 1 }}
            >
              Undo
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function getRelativeAge(iso: string) {
  return formatDistanceToNow(new Date(iso), { addSuffix: true })
}

function RequestsSkeleton() {
  return (
    <div style={{ background: 'var(--surface-card)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
      {[0, 1].map((i) => (
        <div key={i} style={{ padding: '12px 16px', display: 'flex', gap: 12, borderBottom: i < 1 ? '0.5px solid var(--border-default)' : 'none' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--surface-raised)' }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ height: 13, width: '40%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
            <div style={{ height: 11, width: '25%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
          </div>
        </div>
      ))}
    </div>
  )
}
