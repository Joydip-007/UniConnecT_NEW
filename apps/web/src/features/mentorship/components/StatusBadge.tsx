import { Badge } from '@/components/Badge'
import type { RequestStatus } from '../types'

export function StatusBadge({ status }: { status: RequestStatus }) {
  if (status === 'pending') return <Badge variant="pinned">Pending</Badge>
  if (status === 'accepted') return <Badge variant="alumni">Accepted</Badge>
  if (status === 'completed') return <Badge variant="neutral">Completed</Badge>
  if (status === 'expired') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          fontSize: 12,
          fontWeight: 500,
          lineHeight: 1,
          padding: '2px 9px',
          borderRadius: 'var(--r-pill)',
          background: 'var(--surface-raised)',
          color: 'var(--text-tertiary)',
        }}
      >
        Expired
      </span>
    )
  }
  // declined
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: 12,
        fontWeight: 500,
        lineHeight: 1,
        padding: '2px 9px',
        borderRadius: 'var(--r-pill)',
        background: 'var(--uc-red-bg)',
        color: 'var(--uc-red)',
      }}
    >
      Declined
    </span>
  )
}
