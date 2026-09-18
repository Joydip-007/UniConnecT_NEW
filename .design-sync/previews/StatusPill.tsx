import { StatusPill } from 'web';

// 11px pill carrying the four admin quiz statuses. The colour triplets are the
// QUIZ_STATUS map verbatim — mint for published, neutral for draft, amber for
// needs review, cyan for scheduled.

const frame = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap' as const,
  alignItems: 'center',
  padding: 16,
  width: 360,
  background: 'var(--surface-page)',
};

export function QuizStatuses() {
  return (
    <div style={frame}>
      <StatusPill label="Published" color="var(--uc-mint)" bg="var(--uc-mint-bg)" bdr="var(--uc-mint-bdr)" />
      <StatusPill label="Draft" color="var(--text-secondary)" bg="var(--surface-raised)" bdr="var(--border-default)" />
      <StatusPill label="Needs review" color="var(--uc-amber-l)" bg="var(--uc-amber-bg)" bdr="var(--uc-amber-bdr)" />
      <StatusPill label="Scheduled" color="var(--uc-cyan)" bg="var(--uc-cyan-bg)" bdr="var(--uc-cyan-bdr)" />
    </div>
  );
}

export function InAQuizRow() {
  return (
    <div style={{ padding: 16, width: 360, background: 'var(--surface-page)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: 14,
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
            Pointers and memory
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            AI draft, unreviewed · 5 questions
          </div>
        </div>
        <StatusPill label="Needs review" color="var(--uc-amber-l)" bg="var(--uc-amber-bg)" bdr="var(--uc-amber-bdr)" />
      </div>
    </div>
  );
}
