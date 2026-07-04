import { useState } from 'react'
import { BookOpen, Play, PenLine, HelpCircle, Check } from 'lucide-react'
import { isAxiosError } from 'axios'
import { useCompleteUnit } from '../hooks/useLearning'
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
}: {
  entry: TodayEntry
  pathTitle?: string
  onQuizStart?: (unit: LearningUnit) => void
}) {
  const { unit, completedToday } = entry
  const [expanded, setExpanded] = useState(false)
  const mutation = useCompleteUnit()
  const show = useToastStore((s) => s.show)

  const Icon = TYPE_ICON[unit.type]

  function handleComplete() {
    mutation.mutate(
      { unitId: unit.id },
      {
        onSuccess: (result) => {
          show({ message: `Unit complete — streak: ${result.streak.currentStreak} days`, type: 'success' })
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
          <Check size={18} color="var(--uc-orange)" aria-hidden="true" />
          <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)' }}>
            Done for today — come back tomorrow
          </p>
        </div>
      ) : unit.type === 'quiz' ? (
        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            className="press-feedback"
            onClick={() => onQuizStart?.(unit)}
            style={buttonStyle}
          >
            Start quiz
          </button>
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          {unit.content?.body ? (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                marginBottom: 8,
                fontSize: 13,
                fontWeight: 400,
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              {expanded ? 'Hide content' : 'Show content'}
            </button>
          ) : null}
          {expanded && unit.content?.body ? (
            <div style={{ marginBottom: 12 }}>
              {unit.content.body.split('\n').filter(Boolean).map((para) => (
                <p
                  key={para}
                  style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 400, color: 'var(--text-primary)' }}
                >
                  {para}
                </p>
              ))}
            </div>
          ) : null}
          <button
            type="button"
            className="press-feedback"
            onClick={handleComplete}
            disabled={mutation.isPending}
            style={{ ...buttonStyle, opacity: mutation.isPending ? 0.6 : 1 }}
          >
            Mark complete
          </button>
        </div>
      )}
    </div>
  )
}

const buttonStyle: React.CSSProperties = {
  background: 'var(--uc-orange)',
  color: 'var(--uc-orange-l)',
  border: 'none',
  borderRadius: 'var(--r-pill)',
  padding: '8px 16px',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
}
