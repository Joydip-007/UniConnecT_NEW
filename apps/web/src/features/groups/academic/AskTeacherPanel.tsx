import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { Lock, Plus } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { RoleBadge } from '@/components/RoleBadge'
import { ChatView, MessageInput, useConversationSocket } from '@/features/messages'
import { avatarColor, getInitials } from '@/utils/avatar'
import { useAskTeacher, useAskTeacherQueue, useConsultationSlots, useCreateSlot } from '../hooks/useGroupExtended'
import type { AskTeacherQueueItem, ConsultationSlot, CreateSlotInput } from '../types'
import { BookSlotModal } from './BookSlotModal'
import { WEEKDAYS, slotWhen, slotWhere } from './consultationSlot'

interface Props {
  groupId: string
  isAdmin: boolean
}

const card = {
  background: 'var(--surface-card)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-lg)',
} as const

const pill = { padding: '6px 14px', fontSize: 13, borderRadius: 'var(--r-pill)', cursor: 'pointer', fontFamily: 'inherit' } as const
const ghost = { ...pill, border: '0.5px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)' } as const
const indigo = { ...pill, border: 'none', background: 'var(--uc-indigo)', color: 'var(--on-accent)' } as const
const indigoBg = { ...pill, border: '0.5px solid var(--uc-indigo-bdr)', background: 'var(--uc-indigo-bg)', color: 'var(--uc-indigo-l)' } as const
const mint = { ...pill, border: '0.5px solid var(--uc-mint-bdr)', background: 'var(--uc-mint-bg)', color: 'var(--uc-mint)' } as const

function isHappeningNow(slot: ConsultationSlot, now = new Date()) {
  if (slot.weekday !== now.getDay()) return false
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  return hhmm >= slot.startTime && hhmm < slot.endTime
}

export function AskTeacherPanel({ groupId, isAdmin }: Props) {
  return isAdmin ? <AdminView groupId={groupId} /> : <StudentView groupId={groupId} />
}

// ── Student ──────────────────────────────────────────────────────────────────

function StudentView({ groupId }: { groupId: string }) {
  const { data, isLoading } = useAskTeacher(groupId)
  const composerRef = useRef<HTMLDivElement>(null)
  const [booking, setBooking] = useState<ConsultationSlot | null>(null)

  const focusComposer = () => {
    composerRef.current?.querySelector<HTMLTextAreaElement | HTMLInputElement>('textarea, input')?.focus()
  }

  const teacher = data?.teacher
  const teacherName = teacher?.fullName ?? 'Course teacher'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ ...card, padding: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {teacher ? (
          <Avatar initials={getInitials(teacherName)} color={avatarColor(teacher.id)} size={44} src={teacher.avatarUrl} />
        ) : (
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--surface-raised)' }} />
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {teacher?.role && <RoleBadge role={teacher.role} size={15} tipPlacement="below" />}
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{isLoading ? 'Loading…' : teacherName}</span>
            <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 'var(--r-pill)', background: 'var(--uc-indigo-bg)', border: '0.5px solid var(--uc-indigo-bdr)', color: 'var(--uc-indigo-l)' }}>
              Course teacher
            </span>
          </div>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--uc-indigo)' }} />
            usually replies within a day
          </p>
          {teacher?.department && (
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>{teacher.department}</p>
          )}
        </div>
        <button type="button" style={indigo} onClick={focusComposer} disabled={!data}>
          Message the teacher
        </button>
      </div>

      <div style={{ ...card, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderBottom: '0.5px solid var(--border-subtle)', fontSize: 12, color: 'var(--text-tertiary)' }}>
          <Lock size={12} strokeWidth={1.5} />
          Direct chat, only you and the teacher
        </div>
        {data ? (
          <TeacherChat convId={data.conversationId} composerRef={composerRef} />
        ) : (
          <p style={{ margin: 0, padding: 16, fontSize: 13, color: 'var(--text-tertiary)' }}>{isLoading ? 'Opening chat…' : 'Chat unavailable.'}</p>
        )}
      </div>

      <ConsultationHours
        groupId={groupId}
        renderCta={(slot) =>
          isHappeningNow(slot) ? (
            <span style={{ ...mint, cursor: 'default' }}>Open now</span>
          ) : slot.myBooking ? (
            <span style={{ ...ghost, cursor: 'default' }}>{slot.myBooking.status === 'confirmed' ? 'Confirmed' : slot.myBooking.status === 'declined' ? 'Declined' : 'Requested'}</span>
          ) : (
            <button type="button" style={indigoBg} onClick={() => setBooking(slot)}>
              Book a slot
            </button>
          )
        }
      />

      <BookSlotModal groupId={groupId} slot={booking} mode="book" teacherName={teacher?.fullName} onClose={() => setBooking(null)} />
    </div>
  )
}

function TeacherChat({ convId, composerRef }: { convId: string; composerRef: React.RefObject<HTMLDivElement> }) {
  useConversationSocket(convId)
  return (
    <>
      <div style={{ height: 320, display: 'flex', flexDirection: 'column' }}>
        <ChatView convId={convId} />
      </div>
      <div ref={composerRef} style={{ borderTop: '0.5px solid var(--border-subtle)' }}>
        <MessageInput convId={convId} />
      </div>
    </>
  )
}

// ── Admin ────────────────────────────────────────────────────────────────────

function AdminView({ groupId }: { groupId: string }) {
  const navigate = useNavigate()
  const { data: queue = [], isLoading } = useAskTeacherQueue(groupId)
  const [viewing, setViewing] = useState<ConsultationSlot | null>(null)
  const waiting = queue.filter((q) => q.unread > 0).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Student questions</span>
            {waiting > 0 && (
              <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 'var(--r-pill)', background: 'var(--uc-orange-bg)', border: '0.5px solid var(--uc-orange-bdr)', color: 'var(--uc-orange-l)' }}>
                {waiting} waiting
              </span>
            )}
          </div>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>You usually reply within a day</p>
        </div>
        {isLoading ? (
          <p style={{ margin: 0, padding: 16, fontSize: 13, color: 'var(--text-tertiary)' }}>Loading…</p>
        ) : queue.length === 0 ? (
          <p style={{ margin: 0, padding: 16, fontSize: 13, color: 'var(--text-tertiary)' }}>No questions yet.</p>
        ) : (
          queue.map((q, i) => <QueueRow key={q.conversationId} item={q} last={i === queue.length - 1} onOpen={() => navigate(`/messages/${q.conversationId}`)} />)
        )}
      </div>

      <ConsultationHours
        groupId={groupId}
        adminFooter
        renderCta={(slot) => (
          <button type="button" style={indigoBg} onClick={() => setViewing(slot)}>
            View bookings
          </button>
        )}
      />

      <BookSlotModal groupId={groupId} slot={viewing} mode="bookings" onClose={() => setViewing(null)} />
    </div>
  )
}

function QueueRow({ item, last, onOpen }: { item: AskTeacherQueueItem; last: boolean; onOpen: () => void }) {
  const name = item.student.fullName ?? 'A student'
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '10px 16px',
        background: 'none',
        border: 'none',
        borderBottom: last ? 'none' : '0.5px solid var(--border-subtle)',
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      <Avatar initials={getInitials(name)} color={avatarColor(item.student.id)} size={32} src={item.student.avatarUrl} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{name}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.lastMessage || '—'}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        {item.lastAt && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{formatDistanceToNow(parseISO(item.lastAt), { addSuffix: true })}</span>}
        {item.unread > 0 && (
          <span style={{ fontSize: 11, minWidth: 18, textAlign: 'center', padding: '1px 6px', borderRadius: 'var(--r-pill)', background: 'var(--uc-indigo)', color: 'var(--on-accent)' }}>{item.unread}</span>
        )}
      </div>
    </button>
  )
}

// ── Consultation hours card (shared) ─────────────────────────────────────────

function ConsultationHours({ groupId, renderCta, adminFooter }: { groupId: string; renderCta: (slot: ConsultationSlot) => React.ReactNode; adminFooter?: boolean }) {
  const { data: slots = [], isLoading } = useConsultationSlots(groupId)
  const [adding, setAdding] = useState(false)

  return (
    <div style={{ ...card, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border-subtle)', fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Consultation hours</div>
      {isLoading ? (
        <p style={{ margin: 0, padding: 16, fontSize: 13, color: 'var(--text-tertiary)' }}>Loading…</p>
      ) : slots.length === 0 ? (
        <p style={{ margin: 0, padding: 16, fontSize: 13, color: 'var(--text-tertiary)' }}>No consultation hours yet.</p>
      ) : (
        slots.map((slot, i) => (
          <div key={slot.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: i === slots.length - 1 && !adminFooter ? 'none' : '0.5px solid var(--border-subtle)' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{slotWhen(slot)}</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{slotWhere(slot)}</div>
            </div>
            {renderCta(slot)}
          </div>
        ))
      )}
      {adminFooter && (
        <div style={{ padding: '10px 16px' }}>
          {adding ? (
            <AddSlotForm groupId={groupId} onDone={() => setAdding(false)} />
          ) : (
            <button type="button" style={{ ...ghost, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => setAdding(true)}>
              <Plus size={13} strokeWidth={1.5} />
              Add slot
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function AddSlotForm({ groupId, onDone }: { groupId: string; onDone: () => void }) {
  const create = useCreateSlot(groupId)
  const [form, setForm] = useState<CreateSlotInput>({ weekday: 1, start_time: '14:00', end_time: '15:00', location: '', walk_in: false })
  const canSave = form.location.trim().length > 0 && form.start_time < form.end_time && !create.isPending

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <select className="fld" aria-label="Weekday" value={form.weekday} onChange={(e) => setForm({ ...form, weekday: Number(e.target.value) })}>
          {WEEKDAYS.map((d, i) => (
            <option key={d} value={i}>
              {d}
            </option>
          ))}
        </select>
        <input className="fld" type="time" aria-label="Start" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
        <input className="fld" type="time" aria-label="End" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
      </div>
      <input className="fld" placeholder="Location, e.g. Room 402" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
        <input type="checkbox" checked={form.walk_in} onChange={(e) => setForm({ ...form, walk_in: e.target.checked })} />
        Walk in, no booking needed
      </label>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" style={ghost} onClick={onDone}>
          Cancel
        </button>
        <button type="button" style={{ ...indigo, opacity: canSave ? 1 : 0.6 }} disabled={!canSave} onClick={() => create.mutate({ ...form, location: form.location.trim() }, { onSuccess: onDone })}>
          Save slot
        </button>
      </div>
    </div>
  )
}
