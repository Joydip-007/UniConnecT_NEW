import { Badge } from '@/components/Badge'
import type { RequestStatus } from '../types'

export function StatusBadge({ status }: { status: RequestStatus }) {
  if (status === 'pending') return <Badge variant="pinned">Pending</Badge>
  if (status === 'accepted') return <Badge variant="alumni">Accepted</Badge>
  if (status === 'completed') return <Badge variant="neutral">Completed</Badge>
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: 11,
        fontWeight: 500,
        lineHeight: 1,
        padding: '2px 9px',
        borderRadius: 'var(--r-pill)',
        background: 'rgba(225, 29, 72, 0.12)',
        color: 'var(--uc-red)',
      }}
    >
      Declined
    </span>
  )
}
