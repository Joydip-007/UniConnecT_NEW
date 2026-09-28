import { useState } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import { LearnDialog } from '@/features/learning/components/learnUi'
import { pillButton } from '@/features/learning/learnFormat'
import { Modal } from '@/components/Modal'
import { useSubmitAttempt } from '../hooks/useQuiz'
import type { DailyQuizSlot, QuizAttemptResult, QuizReviewItem } from '../types'

interface Props { slot: DailyQuizSlot; open: boolean; onClose: () => void }

const optionButton = (selected: boolean): React.CSSProperties => ({
  width: '100%',
  minHeight: 44,
  textAlign: 'left',
  padding: '10px 14px',
  borderRadius: 'var(--r-md)',
  border: `0.5px solid ${selected ? 'var(--uc-indigo)' : 'var(--border-default)'}`,
  background: selected ? 'var(--surface-raised)' : 'var(--surface-card)',
  color: 'var(--text-primary)',
  fontSize: 14,
  fontWeight: selected ? 500 : 400,
  cursor: 'pointer',
  transition: 'background-color var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard)',
})

const actionButton: React.CSSProperties = {
  height: 44,
  borderRadius: 'var(--r-md)',
  background: 'var(--uc-indigo)',
  color: 'var(--on-accent)',
  border: 'none',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 500,
}

export function DailyQuizModal({ slot, open, onClose }: Props) {
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<number[]>([])
  const [result, setResult] = useState<QuizAttemptResult | null>(
    slot.myAttempt ? { ...slot.myAttempt, passed: slot.myAttempt.score >= 70 } : null,
  )
  const submit = useSubmitAttempt(slot.id)

  if (!open) return null

  const questions = slot.questions
  const current = questions[index]
  const selectedForCurrent = answers[index] ?? null
  const allAnswered = answers.length === questions.length && answers.every((a) => a !== undefined)

  function select(optionIndex: number) {
    const next = [...answers]
    next[index] = optionIndex
    setAnswers(next)
    if (index < questions.length - 1) {
      setTimeout(() => setIndex((i) => i + 1), 180)
    }
  }

  function handleSubmit() {
    submit.mutate(answers, { onSuccess: (res) => setResult(res) })
  }

  function handleClose() {
    setIndex(0); setAnswers([]); setResult(null); onClose()
  }

  if (result) {
    return (
      <LearnDialog
        label="Daily quiz answers"
        title={`Daily quiz · ${slot.department}`}
        sub={`Today · ${result.correctCount} of ${result.totalQuestions} correct · ${result.score}%`}
        onClose={handleClose}
        footer={
          <>
            <span style={{ flex: 1, fontSize: 12, color: 'var(--text-tertiary)' }}>A new daily quiz opens at midnight.</span>
            <button type="button" onClick={handleClose} className="press-feedback" style={pillButton('outline')}>
              Close
            </button>
          </>
        }
      >
        <QuizReviewList review={result.review} />
      </LearnDialog>
    )
  }

  return (
    <Modal isOpen title={`Daily quiz — ${slot.department}`} onClose={handleClose}>
      <div style={{ padding: '4px 0 16px', display: 'grid', gap: 16 }}>
        {/* Progress bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--border-default)', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${((index + 1) / questions.length) * 100}%`,
              background: 'var(--uc-indigo)',
              transition: 'width var(--dur-med) var(--ease-standard)',
            }} />
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
            {index + 1} / {questions.length}
          </span>
        </div>

        {/* Question */}
        <p style={{ margin: 0, fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', textWrap: 'balance' }}>
          {current.q}
        </p>

        {/* Options */}
        <div style={{ display: 'grid', gap: 8 }}>
          {current.options.map((opt, i) => (
            <button key={opt} type="button" onClick={() => select(i)} style={optionButton(selectedForCurrent === i)}>
              {opt}
            </button>
          ))}
        </div>

        {/* Submit — only visible when all questions answered */}
        {allAnswered && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submit.isPending}
            style={{
              ...actionButton,
              opacity: submit.isPending ? 0.6 : 1,
              transition: 'opacity var(--dur-fast) var(--ease-standard)',
            }}
          >
            Submit
          </button>
        )}
      </div>
    </Modal>
  )
}

function QuizReviewList({ review }: { review: QuizReviewItem[] }) {
  if (review.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {review.map((item, i) => (
        <div
          key={item.question}
          style={{
            display: 'flex',
            gap: 10,
            padding: '10px 0',
            borderBottom: i === review.length - 1 ? 'none' : '0.5px solid var(--border-default)',
          }}
        >
          {item.isCorrect ? (
            <CheckCircle2 size={15} color="var(--uc-mint)" aria-label="Correct" style={{ flexShrink: 0, marginTop: 1 }} />
          ) : (
            <XCircle size={15} color="var(--uc-red)" aria-label="Wrong" style={{ flexShrink: 0, marginTop: 1 }} />
          )}
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.45 }}>{item.question}</span>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
              Your answer: {item.selectedIndex >= 0 ? item.options[item.selectedIndex] : 'No answer'}
            </span>
            {!item.isCorrect && (
              <span style={{ display: 'block', fontSize: 12, color: 'var(--uc-mint)', marginTop: 2 }}>
                Correct: {item.options[item.correctIndex]}
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  )
}
