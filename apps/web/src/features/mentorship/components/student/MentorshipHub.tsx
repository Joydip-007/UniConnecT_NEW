import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  MessageCircle,
  MoreHorizontal,
  Plus,
  RotateCcw,
  XCircle,
} from 'lucide-react'
import { useToastStore } from '@/stores/toastStore'
import {
  useCreateSessionRequest,
  useDeleteLoggedSession,
  useEndMentorship,
  useLogSession,
  useReopenMentorship,
  useRequestSessions,
  useWithdrawSessionRequest,
} from '../../hooks/useMentorship'
import { daysSince, deptBatch, firstName, formatMinutes, shortDate, todayIso } from '../../format'
import type { MentorshipSession, MyRequest } from '../../types'
import { Btn, Eyebrow, FieldLabel, InlinePanel, MenuItem, PersonAvatar, Popover, RolePill, StatusPill, StatusStrip, TextBtn } from '../ui'
import { apiErrorMessage, btnStyle, cardStyle, choiceStyle, fieldStyle, hairline, textareaStyle, useIsMobile } from '../styles'

const DURATIONS = [30, 45, 60, 90]
const END_REASONS = ['Goals met', "Schedule doesn't work", 'Not the right fit', 'Switching focus', 'Other']

type Panel = null | 'request' | 'log' | 'end'

interface HubProps {
  request: MyRequest
  viewerId: string
}

/** "Your mentorship": the active relationship, its next session and the conversation, first. */
export function MentorshipHub({ request, viewerId }: HubProps) {
  const isMobile = useIsMobile()
  const show = useToastStore((s) => s.show)
  const [panel, setPanel] = useState<Panel>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [justLogged, setJustLogged] = useState<MentorshipSession | null>(null)

  const sessionsQuery = useRequestSessions(request.id)
  const reopen = useReopenMentorship()
  const deleteSession = useDeleteLoggedSession()
  const withdraw = useWithdrawSessionRequest()

  const ended = request.status === 'completed'
  const mentor = request.alumni
  const mentorFirst = firstName(mentor.fullName)
  const sessions = sessionsQuery.data ?? []
  const totalMinutes = sessions.reduce((n, s) => n + s.durationMinutes, 0)
  const lastDate = sessions[0]?.sessionDate ?? null
  const shown = expanded ? sessions : sessions.slice(0, 2)
  const open = request.openSessionRequest
  const btnH = isMobile ? 44 : 32

  function close() {
    setPanel(null)
    setMenuOpen(false)
  }

  function onError(err: unknown, fallback: string) {
    show({ message: apiErrorMessage(err, fallback), type: 'error' })
  }

  const subtitle = [mentor.headline, deptBatch(mentor.department, mentor.batchYear)].filter(Boolean).join(' · ')

  const actions = ended ? (
    <Btn
      onClick={() => reopen.mutate(request.id, { onError: (e) => onError(e, 'Could not undo') })}
      disabled={reopen.isPending}
      height={btnH}
    >
      <RotateCcw size={13} />
      Undo
    </Btn>
  ) : (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: isMobile ? '100%' : undefined }}>
      <Btn
        onClick={() => {
          setPanel('request')
          setMenuOpen(false)
        }}
        height={btnH}
        style={isMobile ? { flex: 1 } : undefined}
      >
        <CalendarPlus size={13} />
        Request session
      </Btn>
      {request.conversationId && (
        <Link
          to={`/messages/${request.conversationId}`}
          style={{ ...btnStyle('primary', btnH), ...(isMobile ? { flex: 1 } : null) }}
        >
          <MessageCircle size={13} />
          Open chat
        </Link>
      )}
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="More options"
          aria-expanded={menuOpen}
          style={{
            width: btnH,
            height: btnH,
            flexShrink: 0,
            borderRadius: '50%',
            border: '0.5px solid var(--border-hover)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <MoreHorizontal size={15} />
        </button>
        <Popover open={menuOpen} onClose={() => setMenuOpen(false)} top={btnH + 6} width={isMobile ? 200 : 190}>
          <MenuItem
            icon={<Plus size={14} />}
            onClick={() => {
              setPanel('log')
              setMenuOpen(false)
            }}
          >
            Log session
          </MenuItem>
          <MenuItem
            danger
            icon={<XCircle size={14} />}
            onClick={() => {
              setPanel('end')
              setMenuOpen(false)
            }}
          >
            End mentorship
          </MenuItem>
        </Popover>
      </div>
    </div>
  )

  return (
    <section aria-label="Your mentorship" style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px 0' }}>
        <Eyebrow>Your mentorship</Eyebrow>
        {ended ? <StatusPill tone="neutral">Ended</StatusPill> : <StatusPill tone="mint">Accepted</StatusPill>}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary)' }}>
          Since {shortDate(request.respondedAt ?? request.createdAt)}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: isMobile ? 'wrap' : 'nowrap',
          alignItems: 'center',
          gap: isMobile ? 12 : 14,
          padding: isMobile ? 14 : '14px 16px',
        }}
      >
        <PersonAvatar id={mentor.id} name={mentor.fullName} src={mentor.avatarUrl} size={isMobile ? 44 : 52} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <Link
              to={`/profile/${mentor.id}`}
              style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', textDecoration: 'none' }}
            >
              {mentor.fullName}
            </Link>
            <RolePill role={mentor.role ?? 'alumni'} />
          </div>
          {subtitle && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{subtitle}</span>}
        </div>
        {actions}
      </div>

      {ended && (
        <div
          style={{
            margin: '0 16px 14px',
            padding: '10px 12px',
            background: 'var(--surface-raised)',
            borderRadius: 'var(--r-md)',
            fontSize: 12,
            lineHeight: 1.6,
            color: 'var(--text-secondary)',
          }}
        >
          {request.endedBy === viewerId ? 'You' : mentorFirst} ended this mentorship on{' '}
          {shortDate(request.endedAt ?? request.updatedAt)}.
          {request.endReason && ` Reason: ${request.endReason}.`}
          {request.endNote && ` Note: "${request.endNote}".`} Sessions and notes moved to Past mentors.
        </div>
      )}

      {!ended && open && (
        <StatusStrip
          tone="indigo"
          icon={<CalendarClock size={15} color="var(--uc-indigo-xl)" />}
          lead={open.status === 'scheduled' ? 'Session scheduled.' : 'Session requested.'}
          action={
            open.requestedBy === viewerId ? (
              <TextBtn
                disabled={withdraw.isPending}
                onClick={() =>
                  withdraw.mutate(
                    { requestId: request.id, sessionRequestId: open.id },
                    { onError: (e) => onError(e, 'Could not withdraw') },
                  )
                }
              >
                Withdraw
              </TextBtn>
            ) : undefined
          }
        >
          {open.status === 'scheduled'
            ? `${open.slotLabel}, set by ${mentorFirst}`
            : open.slotLabel
              ? `${open.slotLabel}, waiting for ${mentorFirst} to confirm`
              : `No time set. ${mentorFirst} will suggest one in chat`}
          {open.topic ? `. Topic: ${open.topic}` : '.'}
        </StatusStrip>
      )}

      {!ended && panel === 'request' && (
        <RequestSessionPanel request={request} onClose={close} onError={onError} />
      )}
      {!ended && panel === 'log' && (
        <LogSessionPanel
          request={request}
          onClose={close}
          onError={onError}
          onLogged={(s) => {
            setJustLogged(s)
            close()
          }}
        />
      )}
      {!ended && justLogged && panel !== 'log' && (
        <StatusStrip
          tone="mint"
          icon={<CheckCircle2 size={15} color="var(--uc-mint)" />}
          lead="Session logged."
          action={
            <TextBtn
              disabled={deleteSession.isPending}
              onClick={() =>
                deleteSession.mutate(
                  { requestId: request.id, sessionId: justLogged.id },
                  { onSuccess: () => setJustLogged(null), onError: (e) => onError(e, 'Could not undo') },
                )
              }
            >
              Undo
            </TextBtn>
          }
        >
          {justLogged.topic}, {shortDate(justLogged.sessionDate)}, {justLogged.durationMinutes} min. Added to past
          sessions below.
        </StatusStrip>
      )}
      {!ended && panel === 'end' && <EndMentorshipPanel request={request} onClose={close} onError={onError} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', borderTop: hairline }}>
        <Stat value={String(sessions.length)} label="Sessions logged" />
        <Stat value={formatMinutes(totalMinutes)} label="Time together" divider />
        <Stat value={daysSince(lastDate)} label="Since last session" divider />
      </div>

      <div style={{ borderTop: hairline, padding: '12px 16px 4px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 4 }}>
          <Eyebrow>Past sessions</Eyebrow>
          {sessions.length > 2 && (
            <TextBtn
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              style={{ color: 'var(--uc-indigo-xl)' }}
            >
              {expanded ? 'Show less' : `View all (${sessions.length})`}
            </TextBtn>
          )}
        </div>
        <div className="rail-scroll" style={{ maxHeight: 232, overflowY: 'auto', margin: '0 -8px 0 0', paddingRight: 8 }}>
          {sessionsQuery.isLoading && (
            <div style={{ padding: '10px 0', fontSize: 12, color: 'var(--text-tertiary)' }}>Loading sessions…</div>
          )}
          {!sessionsQuery.isLoading && sessions.length === 0 && (
            <div style={{ padding: '10px 0 12px', fontSize: 12, color: 'var(--text-tertiary)' }}>
              No sessions logged yet.
            </div>
          )}
          {shown.map((s, i) => (
            <SessionRow key={s.id} session={s} divider={i > 0} isNew={s.id === justLogged?.id} />
          ))}
        </div>
      </div>
    </section>
  )
}

function Stat({ value, label, divider }: { value: string; label: string; divider?: boolean }) {
  return (
    <div
      style={{
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        borderLeft: divider ? hairline : undefined,
        minWidth: 0,
      }}
    >
      <span style={{ fontSize: 20, fontWeight: 500, color: 'var(--text-primary)' }}>{value}</span>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
    </div>
  )
}

function SessionRow({ session, divider, isNew }: { session: MentorshipSession; divider: boolean; isNew: boolean }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '64px minmax(0, 1fr) auto',
        gap: 12,
        alignItems: 'baseline',
        padding: '10px 0',
        borderTop: divider ? hairline : 'none',
      }}
    >
      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{shortDate(session.sessionDate)}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
          {session.topic}
          {isNew && <StatusPill tone="mint">Just logged</StatusPill>}
        </span>
        <span style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
          {session.notes || 'No notes added.'}
        </span>
      </div>
      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{session.durationMinutes} min</span>
    </div>
  )
}

interface PanelProps {
  request: MyRequest
  onClose: () => void
  onError: (err: unknown, fallback: string) => void
}

function RequestSessionPanel({ request, onClose, onError }: PanelProps) {
  const slots = request.alumni.availability
  const mentorFirst = firstName(request.alumni.fullName)
  const [mode, setMode] = useState<'pick' | 'any'>(slots.length > 0 ? 'pick' : 'any')
  const [slot, setSlot] = useState<string | null>(null)
  const [topic, setTopic] = useState('')
  const create = useCreateSessionRequest()
  const canSend = mode === 'any' || !!slot

  return (
    <InlinePanel title={`Request a session with ${mentorFirst}`} onClose={onClose}>
      <div
        style={{
          display: 'flex',
          gap: 2,
          padding: 3,
          background: 'var(--surface-card)',
          border: hairline,
          borderRadius: 'var(--r-pill)',
          width: 'fit-content',
        }}
      >
        {(
          [
            ['pick', 'Propose a time'],
            ['any', 'No specific time'],
          ] as const
        ).map(([key, label]) => {
          const on = mode === key
          return (
            <button
              key={key}
              type="button"
              aria-pressed={on}
              onClick={() => setMode(key)}
              style={{
                height: 28,
                padding: '0 12px',
                fontSize: 12,
                border: 'none',
                borderRadius: 'var(--r-pill)',
                background: on ? 'var(--uc-indigo-bg)' : 'transparent',
                color: on ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
                fontWeight: on ? 500 : 400,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>
      {mode === 'pick' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{mentorFirst}'s open times</span>
          {slots.length === 0 ? (
            <span style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
              {mentorFirst} has not shared open times yet. Send the request without a time and agree one in chat.
            </span>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {slots.map((label) => (
                <button key={label} type="button" aria-pressed={slot === label} onClick={() => setSlot(label)} style={choiceStyle(slot === label)}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {mode === 'any' && (
        <span style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
          No time needed. {mentorFirst} will suggest one in chat based on their availability.
        </span>
      )}
      <FieldLabel label="What do you want to cover? (optional)">
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          maxLength={255}
          placeholder="e.g. Mock interview for backend roles"
          style={textareaStyle}
        />
      </FieldLabel>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn
          variant="primary"
          disabled={!canSend || create.isPending}
          onClick={() =>
            create.mutate(
              { requestId: request.id, slotLabel: mode === 'pick' ? slot : null, topic: topic.trim() || undefined },
              { onSuccess: onClose, onError: (e) => onError(e, 'Could not send the request') },
            )
          }
        >
          Send request
        </Btn>
      </div>
    </InlinePanel>
  )
}

function LogSessionPanel({ request, onClose, onError, onLogged }: PanelProps & { onLogged: (s: MentorshipSession) => void }) {
  const isMobile = useIsMobile()
  const mentorFirst = firstName(request.alumni.fullName)
  const [topic, setTopic] = useState('')
  const [date, setDate] = useState(todayIso())
  const [duration, setDuration] = useState(45)
  const [notes, setNotes] = useState('')
  const log = useLogSession()
  const ok = !!topic.trim() && !!date

  return (
    <InlinePanel title={`Log a session with ${mentorFirst}`} onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) 170px', gap: 10 }}>
        <FieldLabel label="Topic">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            maxLength={255}
            placeholder="e.g. Mock interview for backend roles"
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
      </div>
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
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={5000}
          placeholder="What did you cover, and what's next?"
          style={textareaStyle}
        />
      </FieldLabel>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
        <span style={{ flex: 1, fontSize: 12, color: 'var(--text-tertiary)' }}>Visible to you and {mentorFirst}</span>
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn
          variant="primary"
          disabled={!ok || log.isPending}
          onClick={() =>
            log.mutate(
              { requestId: request.id, topic: topic.trim(), sessionDate: date, durationMinutes: duration, notes: notes.trim() || null },
              { onSuccess: onLogged, onError: (e) => onError(e, 'Could not log the session') },
            )
          }
        >
          Save session
        </Btn>
      </div>
    </InlinePanel>
  )
}

function EndMentorshipPanel({ request, onClose, onError }: PanelProps) {
  const mentorFirst = firstName(request.alumni.fullName)
  const [reason, setReason] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const end = useEndMentorship()

  return (
    <InlinePanel
      role="alertdialog"
      title={`End mentorship with ${mentorFirst}?`}
      subtitle={`Your sessions and notes stay in Past mentors. ${mentorFirst} sees the reason you pick.`}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {END_REASONS.map((r) => (
          <button key={r} type="button" aria-pressed={reason === r} onClick={() => setReason(r)} style={choiceStyle(reason === r)}>
            {r}
          </button>
        ))}
      </div>
      <FieldLabel label={`Add a note for ${mentorFirst} (optional)`}>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
          placeholder="e.g. Thank you, I got the internship"
          style={textareaStyle}
        />
      </FieldLabel>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Btn onClick={onClose}>Keep mentorship</Btn>
        <Btn
          variant="danger"
          disabled={!reason || end.isPending}
          onClick={() =>
            reason &&
            end.mutate(
              { requestId: request.id, reason, note: note.trim() || undefined },
              { onSuccess: onClose, onError: (e) => onError(e, 'Could not end the mentorship') },
            )
          }
        >
          End mentorship
        </Btn>
      </div>
    </InlinePanel>
  )
}
