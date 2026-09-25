import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Clock } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { useToastStore } from '@/stores/toastStore'
import {
  useCreateSessionRequest,
  useEndMentorship,
  useLogSession,
  useReopenMentorship,
  useRequestSessions,
} from '../../hooks/useMentorship'
import { POINTS_PER_SESSION, deptBatch, firstName, plural, shortDate, todayIso } from '../../format'
import type { IncomingRequest, MentorSettings } from '../../types'
import { Btn, Eyebrow, FieldLabel, PersonAvatar, Popover, TextBtn } from '../ui'
import { apiErrorMessage, btnStyle, cardStyle, choiceStyle, fieldStyle, hairline, textareaStyle, useIsMobile } from '../styles'

const DURATIONS = [30, 45, 60, 90]
const END_REASONS = ['Goals met', "Schedule doesn't work", 'Not the right fit', 'At capacity', 'Other']

type ModalState = null | { kind: 'log' | 'schedule' | 'end'; mentee: IncomingRequest }

interface MenteesTabProps {
  mentees: IncomingRequest[]
  settings: MentorSettings | undefined
  isLoading: boolean
  onOpenAvailability: () => void
}

export function MenteesTab({ mentees, settings, isLoading, onOpenAvailability }: MenteesTabProps) {
  const isMobile = useIsMobile()
  const [modal, setModal] = useState<ModalState>(null)
  // Ended rows stay visible (with Undo) after the refetch drops them from the accepted list.
  const [ended, setEnded] = useState<Record<string, IncomingRequest>>({})
  const rows = [...mentees.filter((m) => !ended[m.id]), ...Object.values(ended)]

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: isMobile ? 14 : 15, fontWeight: 500, color: 'var(--text-primary)' }}>Your mentees</h2>
        {settings && (
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            {mentees.length} active · {settings.currentMentees} of {settings.maxMentees} places filled
          </span>
        )}
      </div>

      {isLoading && <div style={{ ...cardStyle, padding: 24, fontSize: 13, color: 'var(--text-secondary)' }}>Loading mentees…</div>}
      {!isLoading && rows.length === 0 && (
        <div style={{ ...cardStyle, padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
          No active mentees yet. Accepted requests show up here.
        </div>
      )}

      {rows.map((m) => (
        <MenteeRow
          key={m.id}
          mentee={m}
          ended={!!ended[m.id]}
          onOpen={(kind) => setModal({ kind, mentee: m })}
          onReopened={() =>
            setEnded((s) => {
              const next = { ...s }
              delete next[m.id]
              return next
            })
          }
        />
      ))}

      {modal?.kind === 'log' && <SessionLogModal mentee={modal.mentee} onClose={() => setModal(null)} />}
      {modal?.kind === 'schedule' && (
        <ScheduleModal
          mentee={modal.mentee}
          slots={settings?.availability ?? []}
          onClose={() => setModal(null)}
          onOpenAvailability={() => {
            setModal(null)
            onOpenAvailability()
          }}
        />
      )}
      {modal?.kind === 'end' && (
        <EndModal
          mentee={modal.mentee}
          onClose={() => setModal(null)}
          onEnded={() => {
            setEnded((s) => ({ ...s, [modal.mentee.id]: modal.mentee }))
            setModal(null)
          }}
        />
      )}
    </>
  )
}

function nextSessionText(m: IncomingRequest) {
  const open = m.openSessionRequest
  if (!open) return 'no session scheduled'
  if (open.status === 'scheduled') return `Next session ${open.slotLabel}`
  return open.slotLabel ? `Session requested: ${open.slotLabel}` : 'Session requested, no time set'
}

function MenteeRow({
  mentee,
  ended,
  onOpen,
  onReopened,
}: {
  mentee: IncomingRequest
  ended: boolean
  onOpen: (kind: 'log' | 'schedule' | 'end') => void
  onReopened: () => void
}) {
  const isMobile = useIsMobile()
  const show = useToastStore((s) => s.show)
  const reopen = useReopenMentorship()
  const [menuOpen, setMenuOpen] = useState(false)
  const s = mentee.student
  const open = mentee.openSessionRequest
  const scheduled = open?.status === 'scheduled'
  // A student's request is waiting on this alumnus, so the schedule control leads.
  const needsAction = open?.status === 'requested'
  const scheduleLabel = scheduled ? 'Reschedule' : 'Schedule session'
  const btnH = isMobile ? 44 : 36

  const sub = [
    deptBatch(s.department, s.batchYear),
    `${plural(mentee.sessionCount, 'session')} completed`,
    ended ? null : nextSessionText(mentee),
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div
      style={{
        ...cardStyle,
        padding: '14px 16px',
        display: 'flex',
        flexWrap: isMobile ? 'wrap' : 'nowrap',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <PersonAvatar id={s.id} name={s.fullName} src={s.avatarUrl} size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <Link to={`/profile/${s.id}`} style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', textDecoration: 'none' }}>
          {s.fullName}
        </Link>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{sub}</div>
      </div>
      {ended ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Mentorship ended</span>
          <TextBtn
            disabled={reopen.isPending}
            onClick={() =>
              reopen.mutate(mentee.id, {
                onSuccess: onReopened,
                onError: (e) => show({ message: apiErrorMessage(e, 'Could not undo'), type: 'error' }),
              })
            }
          >
            Undo
          </TextBtn>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: isMobile ? '100%' : undefined }}>
          <Btn height={btnH} style={{ padding: '0 14px', fontWeight: 500, color: 'var(--text-primary)', ...(isMobile ? { flex: 1 } : null) }} onClick={() => onOpen('log')}>
            Log session
          </Btn>
          <div style={{ position: 'relative', ...(isMobile ? { flex: 1 } : null) }}>
            <Btn
              variant={needsAction ? 'primary' : 'ghost'}
              height={btnH}
              aria-expanded={menuOpen}
              style={{ padding: '0 12px 0 14px', width: isMobile ? '100%' : undefined }}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {scheduleLabel}
              <ChevronDown size={13} />
            </Btn>
            <Popover open={menuOpen} onClose={() => setMenuOpen(false)} top={btnH + 6} width={180}>
              <MenuButton
                onClick={() => {
                  setMenuOpen(false)
                  onOpen('schedule')
                }}
              >
                {scheduleLabel} time
              </MenuButton>
              <MenuButton
                danger
                onClick={() => {
                  setMenuOpen(false)
                  onOpen('end')
                }}
              >
                End mentorship
              </MenuButton>
            </Popover>
          </div>
          {mentee.conversationId && (
            <Link to={`/messages/${mentee.conversationId}`} style={{ ...btnStyle('ghost', btnH), padding: '0 14px' }}>
              Message
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

function MenuButton({ danger, onClick, children }: { danger?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="mentorship-menu-item"
      style={{
        textAlign: 'left',
        minHeight: 36,
        padding: '8px 10px',
        fontSize: 12,
        border: 'none',
        borderRadius: 'var(--r-sm)',
        background: 'transparent',
        color: danger ? 'var(--uc-red)' : 'var(--text-primary)',
        fontFamily: 'inherit',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

const optionRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  width: '100%',
  boxSizing: 'border-box',
  minHeight: 40,
  padding: '8px 12px',
  borderRadius: 'var(--r-sm)',
  border: hairline,
  background: 'transparent',
  color: 'var(--text-primary)',
  fontSize: 13,
  fontFamily: 'inherit',
  cursor: 'pointer',
  textAlign: 'left',
}

function ScheduleModal({
  mentee,
  slots,
  onClose,
  onOpenAvailability,
}: {
  mentee: IncomingRequest
  slots: string[]
  onClose: () => void
  onOpenAvailability: () => void
}) {
  const show = useToastStore((s) => s.show)
  const create = useCreateSessionRequest()
  const requested = mentee.openSessionRequest?.status === 'requested' ? mentee.openSessionRequest : null
  const options = [...new Set([...(requested?.slotLabel ? [requested.slotLabel] : []), ...slots])]

  return (
    <Modal isOpen onClose={onClose} title="Pick a time" maxWidth={420} sheet>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {requested && (
          <span style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            {firstName(mentee.student.fullName)} asked for {requested.slotLabel ?? 'a session with no set time'}
            {requested.topic ? ` · ${requested.topic}` : ''}.
          </span>
        )}
        {options.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Add your weekly availability first. Students pick from the same times.
            </span>
            <Btn variant="primary" height={40} onClick={onOpenAvailability}>
              Set weekly availability
            </Btn>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {options.map((slot) => (
              <button
                key={slot}
                type="button"
                className="mentorship-menu-item"
                disabled={create.isPending}
                style={optionRow}
                onClick={() =>
                  create.mutate(
                    { requestId: mentee.id, slotLabel: slot, topic: requested?.topic ?? undefined },
                    {
                      onSuccess: onClose,
                      onError: (e) => show({ message: apiErrorMessage(e, 'Could not schedule'), type: 'error' }),
                    },
                  )
                }
              >
                <Clock size={14} />
                {slot}
                {slot === requested?.slotLabel && (
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--uc-indigo-xl)' }}>Requested</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}

function SessionLogModal({ mentee, onClose }: { mentee: IncomingRequest; onClose: () => void }) {
  const show = useToastStore((s) => s.show)
  const { data, isLoading } = useRequestSessions(mentee.id)
  const log = useLogSession()
  const [composing, setComposing] = useState(false)
  const [topic, setTopic] = useState(mentee.openSessionRequest?.topic ?? '')
  const [date, setDate] = useState(todayIso())
  const [duration, setDuration] = useState(45)
  const [notes, setNotes] = useState('')
  const sessions = data ?? []
  const ok = !!topic.trim() && !!date

  return (
    <Modal isOpen onClose={onClose} title={`Session logs · ${mentee.student.fullName}`} maxWidth={420} sheet>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {isLoading && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Loading sessions…</span>}
        {!isLoading && sessions.length === 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No sessions logged yet.</span>
        )}
        <div className="rail-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: 260, overflowY: 'auto' }}>
          {sessions.map((s, i) => (
            <div key={s.id} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {i > 0 && <div style={{ borderTop: hairline }} />}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{s.topic}</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {shortDate(s.sessionDate)} · {s.durationMinutes} min{s.pointsAwarded > 0 ? ` · +${s.pointsAwarded} pts` : ''}
                </span>
              </div>
            </div>
          ))}
        </div>

        {composing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 12, borderTop: hairline }}>
            <FieldLabel label="Topic">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                maxLength={255}
                placeholder="e.g. Mock backend interview"
                style={{ ...fieldStyle, height: 40, padding: '0 12px' }}
              />
            </FieldLabel>
            <FieldLabel label="Date">
              <input
                type="date"
                value={date}
                max={todayIso()}
                onChange={(e) => setDate(e.target.value)}
                style={{ ...fieldStyle, height: 40, padding: '0 12px', colorScheme: 'dark light' }}
              />
            </FieldLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Duration</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {DURATIONS.map((n) => (
                  <button key={n} type="button" aria-pressed={duration === n} onClick={() => setDuration(n)} style={choiceStyle(duration === n)}>
                    {n} min
                  </button>
                ))}
              </div>
            </div>
            <FieldLabel label="Session notes (optional)">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={5000} placeholder="What did you cover, and what's next?" style={textareaStyle} />
            </FieldLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: 1, fontSize: 12, color: 'var(--uc-orange-l)' }}>+{POINTS_PER_SESSION} pts</span>
              <Btn onClick={() => setComposing(false)}>Cancel</Btn>
              <Btn
                variant="primary"
                disabled={!ok || log.isPending}
                onClick={() =>
                  log.mutate(
                    { requestId: mentee.id, topic: topic.trim(), sessionDate: date, durationMinutes: duration, notes: notes.trim() || null },
                    {
                      onSuccess: () => {
                        setComposing(false)
                        setTopic('')
                        setNotes('')
                        show({ message: `Session logged · +${POINTS_PER_SESSION} points` })
                      },
                      onError: (e) => show({ message: apiErrorMessage(e, 'Could not log the session'), type: 'error' }),
                    },
                  )
                }
              >
                Save session
              </Btn>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setComposing(true)}
            style={{ ...btnStyle('primary', 40), marginTop: 4, fontSize: 13 }}
          >
            Log new session
          </button>
        )}
      </div>
    </Modal>
  )
}

function EndModal({ mentee, onClose, onEnded }: { mentee: IncomingRequest; onClose: () => void; onEnded: () => void }) {
  const show = useToastStore((s) => s.show)
  const end = useEndMentorship()
  const name = firstName(mentee.student.fullName)
  const [reason, setReason] = useState<string | null>(null)
  const [note, setNote] = useState('')

  return (
    <Modal isOpen onClose={onClose} title={`End mentorship with ${name}?`} maxWidth={420} sheet>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <span style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
          Logged sessions and their points stay. {name} sees the reason you pick.
          {mentee.sessionCount === 0 && ' With no session logged, no points are awarded.'}
        </span>
        <Eyebrow>Reason</Eyebrow>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {END_REASONS.map((r) => (
            <button key={r} type="button" aria-pressed={reason === r} onClick={() => setReason(r)} style={choiceStyle(reason === r)}>
              {r}
            </button>
          ))}
        </div>
        <FieldLabel label={`Add a note for ${name} (optional)`}>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} style={textareaStyle} />
        </FieldLabel>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Btn onClick={onClose}>Keep mentorship</Btn>
          <Btn
            variant="danger"
            disabled={!reason || end.isPending}
            onClick={() =>
              reason &&
              end.mutate(
                { requestId: mentee.id, reason, note: note.trim() || undefined },
                { onSuccess: onEnded, onError: (e) => show({ message: apiErrorMessage(e, 'Could not end the mentorship'), type: 'error' }) },
              )
            }
          >
            End mentorship
          </Btn>
        </div>
      </div>
    </Modal>
  )
}
