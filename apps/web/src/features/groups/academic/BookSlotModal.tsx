import { useState } from 'react'
import { Calendar, MapPin, User } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { RoleBadge } from '@/components/RoleBadge'
import { useBookSlot, useReviewBooking } from '../hooks/useGroupExtended'
import type { ConsultationSlot } from '../types'
import { slotWhen, slotWhere } from './consultationSlot'

interface Props {
  groupId: string
  slot: ConsultationSlot | null
  /** Admin mode lists the roster and lets the teacher confirm/decline. */
  mode: 'book' | 'bookings'
  teacherName?: string | null
  onClose: () => void
}

const pill = {
  padding: '6px 14px',
  fontSize: 13,
  borderRadius: 'var(--r-pill)',
  cursor: 'pointer',
  fontFamily: 'inherit',
} as const

const ghost = { ...pill, border: '0.5px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)' } as const
const primary = { ...pill, border: 'none', background: 'var(--uc-indigo)', color: 'var(--on-accent)' } as const

export function BookSlotModal({ groupId, slot, mode, teacherName, onClose }: Props) {
  return (
    <Modal isOpen={!!slot} onClose={onClose} title={mode === 'book' ? 'Book a slot' : 'Bookings for this slot'} maxWidth={460}>
      {slot && (mode === 'book' ? <BookBody groupId={groupId} slot={slot} teacherName={teacherName} onClose={onClose} /> : <BookingsBody groupId={groupId} slot={slot} onClose={onClose} />)}
    </Modal>
  )
}

function InfoRow({ Icon, children }: { Icon: typeof Calendar; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
      <Icon size={14} strokeWidth={1.5} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
      {children}
    </div>
  )
}

function BookBody({ groupId, slot, teacherName, onClose }: { groupId: string; slot: ConsultationSlot; teacherName?: string | null; onClose: () => void }) {
  const [topic, setTopic] = useState('')
  const book = useBookSlot(groupId)
  const sent = book.isSuccess
  const canSend = topic.trim().length > 0 && !book.isPending && !sent

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <InfoRow Icon={Calendar}>{slotWhen(slot)}</InfoRow>
      <InfoRow Icon={MapPin}>{slotWhere(slot)}</InfoRow>
      {teacherName && <InfoRow Icon={User}>{teacherName}</InfoRow>}

      {sent ? (
        <p
          style={{
            margin: 0,
            padding: '10px 12px',
            fontSize: 13,
            borderRadius: 'var(--r-md)',
            background: 'var(--uc-mint-bg)',
            border: '0.5px solid var(--uc-mint-bdr)',
            color: 'var(--uc-mint)',
          }}
        >
          Request sent. You will get a confirmation in notifications.
        </p>
      ) : (
        <>
          <span style={{ fontSize: 11, letterSpacing: '0.04em', color: 'var(--text-label)' }}>What do you want to discuss?</span>
          <textarea
            className="fld"
            rows={3}
            placeholder="One or two lines so the teacher can prepare."
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            style={{ resize: 'vertical' }}
          />
        </>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onClose} style={ghost}>
          {sent ? 'Done' : 'Cancel'}
        </button>
        {!sent && (
          <button
            type="button"
            disabled={!canSend}
            onClick={() => book.mutate({ slotId: slot.id, topic: topic.trim() })}
            style={{ ...primary, opacity: canSend ? 1 : 0.6, cursor: canSend ? 'pointer' : 'not-allowed' }}
          >
            Request slot
          </button>
        )}
      </div>
    </div>
  )
}

function BookingsBody({ groupId, slot, onClose }: { groupId: string; slot: ConsultationSlot; onClose: () => void }) {
  const review = useReviewBooking(groupId)
  const bookings = slot.bookings ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <InfoRow Icon={Calendar}>{slotWhen(slot)}</InfoRow>
      <InfoRow Icon={MapPin}>{slotWhere(slot)}</InfoRow>

      {bookings.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>No bookings yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {bookings.map((b, i) => {
            const status = b.status === 'confirmed' ? { label: 'Confirmed', color: 'var(--uc-mint)', bg: 'var(--uc-mint-bg)', bdr: 'var(--uc-mint-bdr)' } : b.status === 'declined' ? { label: 'Declined', color: 'var(--text-tertiary)', bg: 'var(--surface-raised)', bdr: 'var(--border-default)' } : { label: 'Requested', color: 'var(--uc-orange-l)', bg: 'var(--uc-orange-bg)', bdr: 'var(--uc-orange-bdr)' }
            return (
              <div
                key={b.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 0',
                  borderBottom: i === bookings.length - 1 ? 'none' : '0.5px solid var(--border-subtle)',
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {b.student.role && <RoleBadge role={b.student.role} size={14} tipPlacement="below" />}
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{b.student.fullName}</span>
                    <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 'var(--r-pill)', background: status.bg, border: `0.5px solid ${status.bdr}`, color: status.color }}>
                      {status.label}
                    </span>
                  </div>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                    {b.topic} · {b.bookedFor}
                  </p>
                </div>
                {b.status === 'requested' && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" style={{ ...ghost, padding: '4px 10px', fontSize: 12 }} disabled={review.isPending} onClick={() => review.mutate({ slotId: slot.id, bookingId: b.id, status: 'declined' })}>
                      Decline
                    </button>
                    <button type="button" style={{ ...primary, padding: '4px 10px', fontSize: 12 }} disabled={review.isPending} onClick={() => review.mutate({ slotId: slot.id, bookingId: b.id, status: 'confirmed' })}>
                      Confirm
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={onClose} style={ghost}>
          Done
        </button>
      </div>
    </div>
  )
}
