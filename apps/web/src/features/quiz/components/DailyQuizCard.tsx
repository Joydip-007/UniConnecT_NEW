import { useState } from 'react'
import { BookOpen } from 'lucide-react'
import { useTodayQuiz } from '../hooks/useQuiz'
import { DailyQuizModal } from './DailyQuizModal'

export function DailyQuizCard({ accent = false }: { accent?: boolean }) {
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
  // Only one filled accent on the Learn screen. The quiz claims it when nothing above it
  // in Today still needs doing (`accent`) and it has not been attempted yet.
  const lead = accent && !attempted

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
            Daily quiz · {slot.department}
          </p>
        </div>

        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', textWrap: 'pretty' }}>
          {attempted
            ? `You scored ${slot.myAttempt!.score}% · ${slot.myAttempt!.correctCount} of ${slot.myAttempt!.totalQuestions} correct`
            : `${slot.questions.length} questions · test your knowledge today`}
        </p>

        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            height: 36,
            padding: '0 16px',
            borderRadius: 'var(--r-pill)',
            background: lead ? 'var(--uc-orange)' : 'transparent',
            color: lead ? 'var(--on-accent)' : 'var(--text-secondary)',
            border: lead ? 'none' : '0.5px solid var(--border-default)',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
            // The card is a grid, so `alignSelf` only pins the block axis — without
            // `justifySelf` the pill stretches the full card width and reads as a banner.
            alignSelf: 'start',
            justifySelf: 'start',
            transition: 'opacity var(--dur-fast) var(--ease-standard)',
          }}
        >
          {attempted ? 'Review answers' : 'Take quiz'}
        </button>
      </div>

      {open && <DailyQuizModal slot={slot} open={open} onClose={() => setOpen(false)} />}
    </>
  )
}
