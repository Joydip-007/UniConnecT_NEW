import { CheckCircle2, CircleHelp, History, Lock, RotateCcw, type LucideIcon } from 'lucide-react'
import { TONE_STYLE, type StatusTone } from '../pathFilters'
import type { MyQuiz } from '../types'
import { StatusPill } from './learnUi'
import { linkButton, pillButton, plural } from '../learnFormat'

function quizStatus(quiz: MyQuiz): { label: string; tone: StatusTone; icon: LucideIcon } {
  if (quiz.passed) return { label: 'Passed', tone: 'mint', icon: CheckCircle2 }
  if (quiz.attemptCount > 0) return { label: `Below ${quiz.passScore}%`, tone: 'amber', icon: RotateCcw }
  if (quiz.state === 'locked') return { label: 'Locked', tone: 'neutral', icon: Lock }
  return { label: 'Not taken', tone: 'indigo', icon: CircleHelp }
}

function quizLockReason(quiz: Pick<MyQuiz, 'pathStarted' | 'blockedByTitle'>) {
  return !quiz.pathStarted || !quiz.blockedByTitle
    ? 'Start this path to unlock its units'
    : `Finish "${quiz.blockedByTitle}" first`
}

interface QuizListProps {
  quizzes: MyQuiz[]
  onStart: (quiz: MyQuiz) => void
  onResults: (quiz: MyQuiz) => void
  compact?: boolean
}

/** Every checkpoint quiz across the caller's paths, one row each. */
export function QuizList({ quizzes, onStart, onResults, compact = false }: QuizListProps) {
  if (quizzes.length === 0) {
    return (
      <p style={{ margin: 0, padding: '24px 0', fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center' }}>
        No checkpoint quizzes yet. They appear here as paths add them.
      </p>
    )
  }

  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        overflow: 'hidden',
      }}
    >
      {quizzes.map((quiz, idx) => {
        const status = quizStatus(quiz)
        const tone = TONE_STYLE[status.tone]
        const Icon = status.icon
        const locked = quiz.state === 'locked'
        const meta = `${quiz.pathTitle} · ${plural(quiz.questionCount, 'question')}${
          quiz.bestScore !== null ? ` · best ${quiz.bestScore}%` : ''
        }`
        return (
          <div
            key={quiz.unitId}
            style={{
              display: 'flex',
              flexDirection: compact ? 'column' : 'row',
              alignItems: compact ? 'stretch' : 'center',
              gap: compact ? 10 : 12,
              padding: compact ? 14 : '14px 16px',
              borderTop: idx === 0 ? 'none' : '0.5px solid var(--border-default)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 0 }}>
              <span
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 'var(--r-sm)',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: tone.background,
                  color: tone.color,
                }}
              >
                <Icon size={16} aria-hidden="true" />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: compact ? 13 : 14, fontWeight: 500, color: 'var(--text-primary)' }}>{quiz.title}</span>
                  <StatusPill tone={status.tone}>{status.label}</StatusPill>
                </div>
                {quiz.summary && (
                  <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.45 }}>{quiz.summary}</p>
                )}
                <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>{meta}</p>
                {locked && (
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Lock size={12} aria-hidden="true" />
                    {quizLockReason(quiz)}
                  </p>
                )}
              </div>
            </div>
            {(quiz.attemptCount > 0 || !locked) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0, paddingLeft: compact ? 48 : 0 }}>
                {quiz.attemptCount > 0 && (
                  <button
                    type="button"
                    onClick={() => onResults(quiz)}
                    style={{ ...linkButton, ...(compact ? { minHeight: 44, fontSize: 12 } : {}) }}
                  >
                    <History size={14} aria-hidden="true" />
                    Past results · {quiz.attemptCount}
                  </button>
                )}
                {!locked && (
                  <button
                    type="button"
                    onClick={() => onStart(quiz)}
                    className="press-feedback interactive-surface"
                    style={pillButton('outline', compact ? 44 : 34)}
                  >
                    {quiz.attemptCount > 0 ? 'Retake' : 'Start quiz'}
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
