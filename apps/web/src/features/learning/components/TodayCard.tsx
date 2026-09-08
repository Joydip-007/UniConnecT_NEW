import { useState } from 'react'
import { BookOpen, Play, PenLine, HelpCircle, Check } from 'lucide-react'
import { isAxiosError } from 'axios'
import { useCompleteUnit, streakToastMessage } from '../hooks/useLearning'
import { useToastStore } from '@/stores/toastStore'
import type { LearningUnit, TodayEntry } from '../types'

const TYPE_ICON = {
  read: BookOpen,
  video: Play,
  exercise: PenLine,
  quiz: HelpCircle,
} as const

function extractErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err) && typeof err.response?.data?.error === 'string') {
    return err.response.data.error
  }
  return fallback
}

export function TodayCard({
  entry,
  pathTitle,
  onQuizStart,
  isLead = false,
}: {
  entry: TodayEntry
  pathTitle?: string
  onQuizStart?: (unit: LearningUnit) => void
  /**
   * Today can stack several cards and the daily quiz below them. Exactly one of those
   * carries the filled accent — the first thing still to do — so the screen has a single
   * obvious target instead of four competing buttons. Everything else waits its turn as a
   * quiet outline button.
   */
  isLead?: boolean
}) {
  const { unit, completedToday } = entry
  const [expanded, setExpanded] = useState(false)
  const mutation = useCompleteUnit()
  const show = useToastStore((s) => s.show)

  const Icon = TYPE_ICON[unit.type]
  const isQuiz = unit.type === 'quiz'
  const body = unit.content?.body ?? unit.content?.text ?? ''

  function handleComplete() {
    mutation.mutate(
      { unitId: unit.id },
      {
        onSuccess: (result) => {
          show({ message: streakToastMessage(result.streak.currentStreak), type: 'success' })
          if (result.pathCompleted) {
            show({ message: 'Path complete! Badge on its way', type: 'success' })
          }
        },
        onError: (err) => {
          show({ message: extractErrorMessage(err, 'Could not complete unit'), type: 'error' })
        },
      },
    )
  }

  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <Icon size={20} color="var(--text-secondary)" aria-hidden="true" style={{ marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
            {unit.title}
          </p>
          {pathTitle ? (
            <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)' }}>
              {pathTitle}
            </p>
          ) : null}
          {completedToday ? null : (
            <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)' }}>
              ~5-10 min
            </p>
          )}
        </div>
      </div>

      {completedToday ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <Check size={18} color="var(--uc-mint)" aria-hidden="true" />
          <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)' }}>
            Done for today. Come back tomorrow
          </p>
        </div>
      ) : (
        <>
          {expanded && body ? (
            <div style={{ marginTop: 12 }}>
              {body.split('\n').filter(Boolean).map((para) => (
                <p
                  key={para}
                  style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 400, color: 'var(--text-primary)', lineHeight: 1.6 }}
                >
                  {para}
                </p>
              ))}
            </div>
          ) : null}

          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              className="press-feedback"
              onClick={isQuiz ? () => onQuizStart?.(unit) : handleComplete}
              disabled={!isQuiz && mutation.isPending}
              style={{
                ...primaryStyle(isLead),
                opacity: !isQuiz && mutation.isPending ? 0.6 : 1,
              }}
            >
              {isQuiz ? 'Start quiz' : 'Mark complete'}
            </button>

            {body ? (
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  fontSize: 13,
                  fontWeight: 400,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                {expanded ? 'Hide content' : 'Show content'}
              </button>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}

function primaryStyle(isLead: boolean): React.CSSProperties {
  return {
    background: isLead ? 'var(--uc-orange)' : 'transparent',
    color: isLead ? 'var(--on-accent)' : 'var(--text-secondary)',
    border: isLead ? 'none' : '0.5px solid var(--border-default)',
    borderRadius: 'var(--r-pill)',
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
  }
}
