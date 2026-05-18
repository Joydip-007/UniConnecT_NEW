import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { Badge } from '@/components/Badge'
import { GhostBtn, MintBtn } from '@/components/Button'
import { api } from '@/lib/axios'
import { avatarColor, getInitials } from '@/utils/avatar'
import { formatDate } from '../constants'
import type { AddToast, IncomingRequest, RequestStatus } from '../types'
import { StatusBadge } from './StatusBadge'

interface IncomingRequestCardProps {
  request: IncomingRequest
  onStatusChange: (status: RequestStatus) => void
  isUpdating: boolean
  addToast: AddToast
}

export function IncomingRequestCard({
  request,
  onStatusChange,
  isUpdating,
  addToast,
}: IncomingRequestCardProps) {
  const queryClient = useQueryClient()
  const [notes, setNotes] = useState(request.sessionNotes ?? '')
  const [isSavingNotes, setIsSavingNotes] = useState(false)

  useEffect(() => {
    setNotes(request.sessionNotes ?? '')
  }, [request.sessionNotes])

  async function saveNotes() {
    if (notes === (request.sessionNotes ?? '')) return
    setIsSavingNotes(true)
    try {
      await api.patch(`/mentorship/requests/${request.id}`, { sessionNotes: notes })
      void queryClient.invalidateQueries({ queryKey: ['mentorship', 'requests', 'incoming'] })
    } catch {
      addToast('Failed to save notes. Please try again.', 'error')
    } finally {
      setIsSavingNotes(false)
    }
  }

  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <Avatar
          initials={getInitials(request.student.fullName)}
          color={avatarColor(request.student.id)}
          size={40}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
              {request.student.fullName}
            </p>
            <StatusBadge status={request.status} />
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
            {request.student.department && (
              <Badge variant="dept">{request.student.department}</Badge>
            )}
            {request.student.batchYear && (
              <Badge variant="neutral">Batch {request.student.batchYear}</Badge>
            )}
          </div>
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

      <p
        style={{
          margin: 0,
          fontSize: 13,
          fontWeight: 400,
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          padding: '10px 12px',
          background: 'var(--surface-raised)',
          borderRadius: 'var(--r-sm)',
          border: '0.5px solid var(--border-default)',
        }}
      >
        {request.message}
      </p>

      {request.status === 'accepted' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>
            Session notes{' '}
            {isSavingNotes && (
              <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>— saving…</span>
            )}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => void saveNotes()}
            placeholder="Add notes about your session with this student…"
            rows={3}
            style={{
              width: '100%',
              background: 'var(--surface-raised)',
              border: '0.5px solid var(--border-default)',
              borderRadius: 'var(--r-md)',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontWeight: 400,
              padding: '10px 12px',
              resize: 'vertical',
              outline: 'none',
              fontFamily: 'inherit',
              lineHeight: 1.6,
              boxSizing: 'border-box',
              transition: 'border-color 150ms',
            }}
          />
        </div>
      )}

      {request.status === 'pending' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <MintBtn onClick={() => onStatusChange('accepted')} disabled={isUpdating}>
            <CheckCircle size={14} strokeWidth={2} />
            Accept
          </MintBtn>
          <GhostBtn onClick={() => onStatusChange('declined')} disabled={isUpdating}>
            <XCircle size={14} strokeWidth={2} />
            Decline
          </GhostBtn>
        </div>
      )}

      {request.status === 'accepted' && (
        <div>
          <GhostBtn onClick={() => onStatusChange('completed')} disabled={isUpdating}>
            <CheckCircle size={14} strokeWidth={2} />
            Mark complete (+10 pts)
          </GhostBtn>
        </div>
      )}
    </div>
  )
}
