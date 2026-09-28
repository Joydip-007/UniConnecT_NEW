import { useState } from 'react'
import { BookOpen } from 'lucide-react'
import { pillButton } from '@/features/learning/learnFormat'
import { useTodayQuiz } from '../hooks/useQuiz'
import { DailyQuizModal } from './DailyQuizModal'

interface DailyQuizCardProps {
  /** Take the screen's one filled accent while today's quiz is still open. */
  accent?: boolean
  /** Phone layout: icon, text and button on one row. */
  compact?: boolean
}

export function DailyQuizCard({ accent = false, compact = false }: DailyQuizCardProps) {
  const { data: slot, isLoading } = useTodayQuiz()
  const [open, setOpen] = useState(false)

  if (isLoading) {
    return (
      <div style={{
        height: compact ? 64 : 88,
        borderRadius: 'var(--r-lg)',
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
      }} />
    )
  }

  if (!slot) return null

  const attempted = slot.myAttempt !== null
  const lead = accent && !attempted
  const title = `Daily quiz · ${slot.department}`
  const line = attempted
    ? `You scored ${slot.myAttempt!.score}% · ${slot.myAttempt!.correctCount} of ${slot.myAttempt!.totalQuestions} correct`
    : `${slot.questions.length} questions · test your knowledge today`
  const button = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="press-feedback"
      style={{
        ...pillButton(lead ? 'primary' : 'outline'),
        ...(compact ? { fontSize: 12, padding: '0 12px', flexShrink: 0 } : { alignSelf: 'start', justifySelf: 'start' }),
      }}
    >
      {attempted ? 'Review answers' : 'Take quiz'}
    </button>
  )

  return (
    <>
      {compact ? (
        <div style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <BookOpen size={18} color="var(--uc-indigo)" aria-hidden style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{title}</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>{line}</p>
          </div>
          {button}
        </div>
      ) : (
        <div style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: 16,
          display: 'grid',
          gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOpen size={16} color="var(--uc-indigo)" aria-hidden />
            <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{title}</p>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', textWrap: 'pretty' }}>{line}</p>
          {button}
        </div>
      )}

      {open && <DailyQuizModal slot={slot} open={open} onClose={() => setOpen(false)} />}
    </>
  )
}
