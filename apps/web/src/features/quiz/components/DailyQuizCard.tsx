import { useState } from 'react'
import { BookOpen } from 'lucide-react'
import { useTodayQuiz } from '../hooks/useQuiz'
import { DailyQuizModal } from './DailyQuizModal'

export function DailyQuizCard() {
  const { data: slot, isLoading } = useTodayQuiz()
  const [open, setOpen] = useState(false)

  if (isLoading) {
    return (
      <div style={{
        height: 88,
        borderRadius: 'var(--r-lg)',
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
      }} />
    )
  }

  if (!slot) return null

  const attempted = slot.myAttempt !== null

  return (
    <>
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
          <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
            Daily quiz — {slot.department}
          </p>
        </div>

        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', textWrap: 'pretty' }}>
          {attempted
            ? `You scored ${slot.myAttempt!.score}% · ${slot.myAttempt!.correctCount} of ${slot.myAttempt!.totalQuestions} correct`
            : `${slot.questions.length} questions · test your knowledge today`}
        </p>

        {!attempted && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            style={{
              height: 36,
              padding: '0 16px',
              borderRadius: 'var(--r-md)',
              background: 'var(--uc-indigo)',
              color: 'var(--on-accent)',
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
              alignSelf: 'start',
              transition: 'opacity var(--dur-fast) var(--ease-standard)',
            }}
          >
            Take quiz
          </button>
        )}
      </div>

      {open && <DailyQuizModal slot={slot} open={open} onClose={() => setOpen(false)} />}
    </>
  )
}
