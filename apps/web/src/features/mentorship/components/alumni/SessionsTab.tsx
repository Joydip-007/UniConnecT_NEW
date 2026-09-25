import { useSessionHistory } from '../../hooks/useMentorship'
import { plural, shortDate } from '../../format'
import { PersonAvatar } from '../ui'
import { cardStyle, hairline, useIsMobile } from '../styles'

/** Every session the alumnus logged, with the points each paid; ended-before-a-session rows earn none. */
export function SessionsTab() {
  const isMobile = useIsMobile()
  const { data, isLoading } = useSessionHistory()
  const items = data?.items ?? []

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: isMobile ? 14 : 15, fontWeight: 500, color: 'var(--text-primary)' }}>Session history</h2>
        {data && (
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            {plural(data.totalSessions, 'session')} completed · {data.pointsEarned} points earned
          </span>
        )}
      </div>
      {isLoading && <div style={{ ...cardStyle, padding: 24, fontSize: 13, color: 'var(--text-secondary)' }}>Loading sessions…</div>}
      {!isLoading && items.length === 0 && (
        <div style={{ ...cardStyle, padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
          No sessions logged yet. Log one from the Mentees tab to earn points.
        </div>
      )}
      {items.length > 0 && (
        <div className="rail-scroll" style={{ ...cardStyle, maxHeight: isMobile ? undefined : 360, overflowY: 'auto' }}>
          {items.map((s, i) => {
            const canceled = s.kind === 'canceled'
            return (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '12px 16px',
                  borderTop: i === 0 ? 'none' : hairline,
                }}
              >
                <PersonAvatar id={s.student.id} name={s.student.fullName} src={s.student.avatarUrl} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                    {canceled ? 'Mentorship ended by you' : s.topic}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {s.student.fullName} · {shortDate(s.sessionDate)} · {canceled ? '—' : `${s.durationMinutes} min`}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4, lineHeight: 1.5 }}>
                    {canceled
                      ? `You ended this mentorship before a session could be logged${s.endReason ? ` (${s.endReason})` : ''}. No points awarded.`
                      : s.notes || 'No notes added.'}
                  </div>
                </div>
                {canceled ? (
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0, marginTop: 1 }}>Canceled · no points</span>
                ) : s.pointsAwarded > 0 ? (
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--uc-orange-l)', flexShrink: 0, marginTop: 1 }}>
                    +{s.pointsAwarded} pts
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
