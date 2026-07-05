import { useState } from 'react'
import { Trophy } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { useSubmitAttempt } from '../hooks/useQuiz'
import type { DailyQuizSlot, QuizAttemptResult } from '../types'

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
  const [result, setResult] = useState<QuizAttemptResult | null>(null)
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
      <Modal isOpen title="Quiz result" onClose={handleClose}>
        <div style={{ padding: '8px 0 16px', display: 'grid', gap: 16, textAlign: 'center' }}>
          <Trophy size={40} color={result.passed ? 'var(--uc-amber)' : 'var(--text-tertiary)'} aria-hidden />
          <p style={{ margin: 0, fontSize: 28, fontWeight: 500, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
            {result.score}%
          </p>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)' }}>
            {result.correctCount} of {result.totalQuestions} correct
            {result.passed ? ' — you passed!' : ' — try again tomorrow'}
          </p>
          <button type="button" onClick={handleClose} style={actionButton}>Done</button>
        </div>
      </Modal>
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
