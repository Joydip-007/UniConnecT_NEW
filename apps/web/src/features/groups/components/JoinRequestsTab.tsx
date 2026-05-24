import { useJoinRequests, useReviewJoinRequest, type JoinRequest } from '@/features/groups'
import { Avatar } from '@/components/Avatar'
import { avatarColor as seedColor, getInitials } from '@/utils/avatar'

interface Props {
  groupId: string
}

export function JoinRequestsTab({ groupId }: Props) {
  const { data, isLoading } = useJoinRequests(groupId)
  const reviewMutation = useReviewJoinRequest(groupId)

  if (isLoading) return <RequestsSkeleton />

  const requests = data?.items ?? []

  if (!requests.length) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center', background: 'var(--surface-card)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-lg)' }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>No pending join requests.</p>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--surface-card)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
      {requests.map((req, idx) => (
        <RequestRow
          key={req.id}
          request={req}
          isLast={idx === requests.length - 1}
          onApprove={() => reviewMutation.mutate({ requestId: req.id, action: 'approve' })}
          onDecline={() => reviewMutation.mutate({ requestId: req.id, action: 'decline' })}
          isPending={reviewMutation.isPending}
        />
      ))}
    </div>
  )
}

function RequestRow({ request, isLast, onApprove, onDecline, isPending }: {
  request: JoinRequest
  isLast: boolean
  onApprove: () => void
  onDecline: () => void
  isPending: boolean
}) {
  const age = getRelativeAge(request.createdAt)

  return (
    <div style={{ padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'flex-start', borderBottom: isLast ? 'none' : '0.5px solid var(--border-default)' }}>
      {/* Avatar */}
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
        <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)' }}>
          {request.requester.department ?? ''} · {age}
        </p>
        {request.message && (
          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
            "{request.message}"
          </p>
        )}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            disabled={isPending}
            onClick={onApprove}
            style={{ padding: '4px 12px', fontSize: 12, fontWeight: 400, borderRadius: 'var(--r-pill)', border: 'none', background: 'var(--uc-indigo)', color: 'var(--uc-indigo-xl)', cursor: isPending ? 'not-allowed' : 'pointer', opacity: isPending ? 0.7 : 1 }}
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
      </div>
    </div>
  )
}

function getRelativeAge(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
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
