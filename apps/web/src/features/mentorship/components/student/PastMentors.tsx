import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useRequestSessions } from '../../hooks/useMentorship'
import { deptBatch, formatMinutes, plural, shortDate } from '../../format'
import type { MyRequest } from '../../types'
import { Eyebrow, PersonAvatar, StatusPill } from '../ui'
import { cardStyle, hairline } from '../styles'

/** A mentorship the student or mentor wrapped up because it worked reads "Completed". */
function statusLabel(r: MyRequest) {
  return !r.endReason || r.endReason === 'Goals met' ? 'Completed' : 'Ended'
}

function summary(r: MyRequest) {
  if (r.sessionCount === 0 || !r.firstSessionDate || !r.lastSessionDate) {
    return `Ended ${shortDate(r.endedAt ?? r.updatedAt)} · no sessions logged`
  }
  const span =
    r.firstSessionDate === r.lastSessionDate
      ? shortDate(r.firstSessionDate)
      : `${shortDate(r.firstSessionDate)} to ${shortDate(r.lastSessionDate)}`
  return `${span} · ${plural(r.sessionCount, 'session')} · ${formatMinutes(r.totalMinutes)}`
}

export function PastMentors({ requests }: { requests: MyRequest[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>({})
  if (requests.length === 0) return null
  const totalSessions = requests.reduce((n, r) => n + r.sessionCount, 0)

  return (
    <section aria-label="Past mentors" style={{ ...cardStyle, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px 12px' }}>
        <Eyebrow>Past mentors</Eyebrow>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          {plural(requests.length, 'mentor')} · {plural(totalSessions, 'session')}
        </span>
      </div>
      <div className="rail-scroll" style={{ maxHeight: 380, overflowY: 'auto' }}>
        {requests.map((r) => {
          const isOpen = !!open[r.id]
          const role = [r.alumni.headline, deptBatch(r.alumni.department, r.alumni.batchYear)].filter(Boolean).join(' · ')
          return (
            <div key={r.id} style={{ borderTop: hairline }}>
              <button
                type="button"
                onClick={() => setOpen((s) => ({ ...s, [r.id]: !s[r.id] }))}
                aria-expanded={isOpen}
                className="mentorship-row-btn"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  color: 'inherit',
                }}
              >
                <PersonAvatar id={r.alumni.id} name={r.alumni.fullName} src={r.alumni.avatarUrl} size={40} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{r.alumni.fullName}</span>
                    <StatusPill tone="neutral">{statusLabel(r)}</StatusPill>
                  </div>
                  {role && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{role}</span>}
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{summary(r)}</span>
                </div>
                <span
                  style={{
                    lineHeight: 0,
                    color: 'var(--text-tertiary)',
                    transition: 'transform 200ms var(--ease-out-strong)',
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}
                >
                  <ChevronDown size={16} />
                </span>
              </button>
              {isOpen && <PastSessions requestId={r.id} />}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function PastSessions({ requestId }: { requestId: string }) {
  const { data, isLoading } = useRequestSessions(requestId)
  const sessions = data ?? []
  return (
    <div style={{ padding: '0 16px 8px 68px', display: 'flex', flexDirection: 'column' }}>
      {isLoading && <div style={{ padding: '10px 0', fontSize: 12, color: 'var(--text-tertiary)' }}>Loading sessions…</div>}
      {!isLoading && sessions.length === 0 && (
        <div style={{ padding: '10px 0', borderTop: hairline, fontSize: 12, color: 'var(--text-tertiary)' }}>
          No sessions were logged.
        </div>
      )}
      {sessions.map((s) => (
        <div
          key={s.id}
          style={{
            display: 'grid',
            gridTemplateColumns: '56px minmax(0, 1fr) auto',
            gap: 12,
            alignItems: 'baseline',
            padding: '10px 0',
            borderTop: hairline,
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{shortDate(s.sessionDate)}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{s.topic}</span>
            {s.notes && (
              <div
                style={{
                  padding: '8px 10px',
                  background: 'var(--surface-raised)',
                  borderRadius: 'var(--r-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <Eyebrow>Session notes</Eyebrow>
                <span style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{s.notes}</span>
              </div>
            )}
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{s.durationMinutes} min</span>
        </div>
      ))}
    </div>
  )
}
