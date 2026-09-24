import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle, MessageCircle, XCircle } from 'lucide-react'
import { isAxiosError } from 'axios'
import { Avatar } from '@/components/Avatar'
import { Badge } from '@/components/Badge'
import { GhostBtn, MintBtn } from '@/components/Button'
import { api } from '@/lib/axios'
import { avatarColor, getInitials } from '@/utils/avatar'
import { PATHS } from '@/router/paths'
import { formatDate } from '../constants'
import type { AddToast, IncomingRequest, RequestStatus } from '../types'
import { FeedbackSection } from './FeedbackSection'
import { StatusBadge } from './StatusBadge'
import { RoleBadge } from '@/components/RoleBadge'

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
  const [capacityError, setCapacityError] = useState<string | null>(null)
  const [confirmingDecline, setConfirmingDecline] = useState(false)
  const [confirmingComplete, setConfirmingComplete] = useState(false)

  useEffect(() => {
    setNotes(request.sessionNotes ?? '')
  }, [request.sessionNotes])

  useEffect(() => {
    setConfirmingDecline(false)
    setConfirmingComplete(false)
  }, [request.status])

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

  async function handleAccept() {
    setCapacityError(null)
    try {
      await api.patch(`/mentorship/requests/${request.id}`, { status: 'accepted' })
      void queryClient.invalidateQueries({ queryKey: ['mentorship', 'requests', 'incoming'] })
    } catch (err) {
      if (
        isAxiosError(err) &&
        (err.response?.data as { code?: string })?.code === 'MENTOR_AT_CAPACITY'
      ) {
        setCapacityError(
          "You've reached your mentee limit. Update your capacity in settings to accept more.",
        )
      } else {
        addToast('Failed to accept request. Please try again.', 'error')
      }
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
            {request.student.role && <RoleBadge role={request.student.role} size={15} tipPlacement="below" />}
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
            fontSize: 12,
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

      {/* Capacity error inline banner */}
      {capacityError && (
        <div
          style={{
            padding: '10px 12px',
            background: 'var(--uc-orange-bg)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-sm)',
            fontSize: 12,
            fontWeight: 400,
            color: 'var(--uc-orange-l)',
            lineHeight: 1.5,
          }}
        >
          {capacityError}
        </div>
      )}

      {request.status === 'accepted' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor={`session-notes-${request.id}`} style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>
            Session notes{' '}
            {isSavingNotes && (
              <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>— saving…</span>
            )}
          </label>
          <textarea
            id={`session-notes-${request.id}`}
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
              fontFamily: 'inherit',
              lineHeight: 1.6,
              boxSizing: 'border-box',
              transition: 'border-color 150ms',
            }}
          />
        </div>
      )}

      {/* Open chat link for accepted requests */}
      {request.status === 'accepted' && request.conversationId && (
        <Link
          to={`${PATHS.MESSAGES}/${request.conversationId}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
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

      {request.status === 'pending' && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <MintBtn onClick={handleAccept} disabled={isUpdating}>
            <CheckCircle size={14} strokeWidth={2} />
            Accept
          </MintBtn>
          {!confirmingDecline ? (
            <GhostBtn onClick={() => setConfirmingDecline(true)} disabled={isUpdating}>
              <XCircle size={14} strokeWidth={2} />
              Decline
            </GhostBtn>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>
                Decline this request?
              </p>
              <button
                type="button"
                onClick={() => { onStatusChange('declined'); setConfirmingDecline(false) }}
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  padding: '5px 12px',
                  borderRadius: 'var(--r-pill)',
                  border: 'none',
                  background: 'var(--uc-orange)',
                  color: 'var(--surface-page)',
                  cursor: 'pointer',
                }}
              >
                Yes, decline
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDecline(false)}
                style={{
                  fontSize: 12,
                  fontWeight: 400,
                  padding: '5px 10px',
                  borderRadius: 'var(--r-pill)',
                  border: '0.5px solid var(--border-default)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {request.status === 'accepted' && (
        <div>
          {!confirmingComplete ? (
            <GhostBtn onClick={() => setConfirmingComplete(true)} disabled={isUpdating}>
              <CheckCircle size={14} strokeWidth={2} />
              Mark complete (+10 pts)
            </GhostBtn>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>
                Mark session as complete?
              </p>
              <button
                type="button"
                onClick={() => { onStatusChange('completed'); setConfirmingComplete(false) }}
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  padding: '5px 12px',
                  borderRadius: 'var(--r-pill)',
                  border: 'none',
                  background: 'var(--uc-orange)',
                  color: 'var(--surface-page)',
                  cursor: 'pointer',
                }}
              >
                Yes, complete
              </button>
              <button
                type="button"
                onClick={() => setConfirmingComplete(false)}
                style={{
                  fontSize: 12,
                  fontWeight: 400,
                  padding: '5px 10px',
                  borderRadius: 'var(--r-pill)',
                  border: '0.5px solid var(--border-default)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Feedback — completed requests only */}
      {request.status === 'completed' && (
        <FeedbackSection requestId={request.id} authorRole="alumni" />
      )}
    </div>
  )
}
