import { useEffect, useState } from 'react'
import { CheckCircle2, ChevronDown, RotateCcw, XCircle } from 'lucide-react'
import { LEARNING } from '@uniconnect/shared'
import { usePath, useUnitAttempts } from '../hooks/useLearning'
import { LearnDialog } from './learnUi'
import { attemptDate, pillButton } from '../learnFormat'

interface PastResultsModalProps {
  pathId: string
  unitId: string
  onClose: () => void
  onBack?: () => void
  onRetake: () => void
}

/** Every attempt at a checkpoint quiz, newest first, each expandable to its answers. */
export function PastResultsModal({ pathId, unitId, onClose, onBack, onRetake }: PastResultsModalProps) {
  const { data: path } = usePath(pathId)
  const { data: attempts, isLoading } = useUnitAttempts(unitId)
  const unit = path?.units.find((u) => u.id === unitId)
  const passScore = unit?.completion_rule?.passScore ?? LEARNING.DEFAULT_QUIZ_PASS_SCORE
  const list = attempts ?? []
  const [open, setOpen] = useState<Record<string, boolean>>({})

  // The newest attempt opens expanded, as it is almost always the one being reviewed.
  const newestId = list[0]?.id
  useEffect(() => {
    if (newestId) setOpen((o) => (Object.keys(o).length ? o : { [newestId]: true }))
  }, [newestId])

  const best = list.length ? Math.max(...list.map((a) => a.score)) : null
  const stats = [
    { label: 'Attempts', value: String(list.length) },
    { label: 'Best score', value: best === null ? '–' : `${best}%` },
    { label: 'Latest', value: list[0] ? `${list[0].score}%` : '–' },
  ]

  return (
    <LearnDialog
      label="Past results"
      title="Past results"
      sub={`${unit?.title ?? 'Quiz'} · pass mark ${passScore}%`}
      onClose={onClose}
      onBack={onBack}
      strip={
        <div
          style={{
            flexShrink: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            borderBottom: '0.5px solid var(--border-default)',
          }}
        >
          {stats.map((s, i) => (
            <div
              key={s.label}
              style={{
                padding: '12px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                borderRight: i < stats.length - 1 ? '0.5px solid var(--border-default)' : 'none',
              }}
            >
              <span style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                {s.value}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{s.label}</span>
            </div>
          ))}
        </div>
      }
      footer={
        <button type="button" onClick={onRetake} className="press-feedback" style={{ ...pillButton('primary'), marginLeft: 'auto' }}>
          <RotateCcw size={14} aria-hidden="true" />
          {list.length ? 'Retake quiz' : 'Start quiz'}
        </button>
      }
    >
      {!isLoading && list.length === 0 && (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: '16px 0' }}>
          No attempts yet. Take the quiz to see your answers here.
        </p>
      )}
      {list.map((attempt, idx) => {
        const expanded = !!open[attempt.id]
        return (
          <div
            key={attempt.id}
            style={{
              border: '0.5px solid var(--border-default)',
              borderRadius: 'var(--r-md)',
              background: 'var(--surface-card)',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={() => setOpen((o) => ({ ...o, [attempt.id]: !expanded }))}
              aria-expanded={expanded}
              className="interactive-surface"
              style={{
                width: '100%',
                minHeight: 48,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                  Attempt {list.length - idx}
                </span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {attemptDate(attempt.createdAt)}
                </span>
              </span>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                {attempt.correctCount} / {attempt.totalQuestions}
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  padding: '2px 9px',
                  borderRadius: 'var(--r-pill)',
                  background: attempt.passed ? 'var(--uc-mint-bg)' : 'var(--uc-amber-bg)',
                  border: `0.5px solid ${attempt.passed ? 'var(--uc-mint-bdr)' : 'var(--uc-amber-bdr)'}`,
                  color: attempt.passed ? 'var(--uc-mint)' : 'var(--uc-amber-l)',
                }}
              >
                {attempt.passed ? 'Passed' : `Below ${passScore}%`}
              </span>
              <ChevronDown
                size={16}
                color="var(--text-tertiary)"
                aria-hidden="true"
                style={{ transition: 'transform 200ms var(--ease-out-strong)', transform: expanded ? 'rotate(180deg)' : 'none' }}
              />
            </button>
            {expanded && (
              <div style={{ borderTop: '0.5px solid var(--border-default)', padding: '4px 12px 8px' }}>
                {attempt.review.map((r, i) => (
                  <div
                    key={`${i}-${r.question}`}
                    style={{
                      display: 'flex',
                      gap: 10,
                      padding: '8px 0',
                      borderBottom: i === attempt.review.length - 1 ? 'none' : '0.5px solid var(--border-default)',
                    }}
                  >
                    {r.isCorrect ? (
                      <CheckCircle2 size={15} color="var(--uc-mint)" aria-label="Correct" style={{ flexShrink: 0, marginTop: 1 }} />
                    ) : (
                      <XCircle size={15} color="var(--uc-red)" aria-label="Wrong" style={{ flexShrink: 0, marginTop: 1 }} />
                    )}
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.45 }}>{r.question}</span>
                      <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                        Your answer: {r.selectedIndex === null ? 'Skipped' : r.options[r.selectedIndex] ?? 'Skipped'}
                      </span>
                      {!r.isCorrect && (
                        <span style={{ display: 'block', fontSize: 12, color: 'var(--uc-mint)', marginTop: 2 }}>
                          Correct: {r.options[r.correctIndex]}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </LearnDialog>
  )
}
