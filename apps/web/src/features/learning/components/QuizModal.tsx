import { useEffect, useState } from 'react'
import { isAxiosError } from 'axios'
import { Check } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { useCompleteUnit } from '../hooks/useLearning'
import { useToastStore } from '@/stores/toastStore'
import type { LearningUnit } from '../types'

interface QuizModalProps {
  unit: LearningUnit | null
  open: boolean
  onClose: () => void
}

interface ResultState {
  score: number
  passed: boolean
  passScore: number
}

function extractErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err) && typeof err.response?.data?.error === 'string') {
    return err.response.data.error
  }
  return fallback
}

export function QuizModal({ unit, open, onClose }: QuizModalProps) {
  const questions = unit?.content?.questions ?? []
  const [answers, setAnswers] = useState<(number | null)[]>([])
  const [result, setResult] = useState<ResultState | null>(null)
  const mutation = useCompleteUnit()
  const show = useToastStore((s) => s.show)

  useEffect(() => {
    if (open) {
      setAnswers(questions.map(() => null))
      setResult(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, unit?.id])

  if (!unit) return null
  const currentUnit = unit

  const allAnswered = questions.length > 0 && answers.every((a) => a !== null)
  const passScore = currentUnit.completion_rule?.passScore ?? 70

  function handleSelect(qIndex: number, optionIndex: number) {
    setAnswers((prev) => prev.map((a, i) => (i === qIndex ? optionIndex : a)))
  }

  function handleSubmit() {
    const correct = questions.reduce((acc, q, i) => (answers[i] === q.answer ? acc + 1 : acc), 0)
    const score = Math.round((100 * correct) / questions.length)

    mutation.mutate(
      { unitId: currentUnit.id, score },
      {
        onSuccess: (res) => {
          setResult({ score, passed: true, passScore })
          show({ message: `Unit complete — streak: ${res.streak.currentStreak} days`, type: 'success' })
          if (res.pathCompleted) {
            show({ message: 'Path complete! Badge on its way', type: 'success' })
          }
        },
        onError: (err) => {
          if (isAxiosError(err) && err.response?.status === 429) {
            show({ message: extractErrorMessage(err, 'Too many attempts'), type: 'error' })
            onClose()
            return
          }
          setResult({ score, passed: false, passScore })
        },
      },
    )
  }

  function handleTryAgain() {
    setAnswers(questions.map(() => null))
    setResult(null)
  }

  return (
    <Modal isOpen={open} onClose={onClose} title={currentUnit.title}>
      {result ? (
        result.passed ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '12px 0' }}>
            <Check size={28} color="var(--uc-orange)" aria-hidden="true" />
            <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
              Score: {result.score}% — passed
            </p>
            <button type="button" className="press-feedback" onClick={onClose} style={buttonStyle}>
              Close
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0' }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 400, color: 'var(--text-primary)' }}>
              Score: {result.score}% — you need {result.passScore}%
            </p>
            <button type="button" className="press-feedback" onClick={handleTryAgain} style={buttonStyle}>
              Try again
            </button>
          </div>
        )
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {questions.map((question, qIndex) => (
            <fieldset
              key={question.q}
              style={{
                border: '0.5px solid var(--border-default)',
                borderRadius: 'var(--r-md)',
                padding: 12,
                margin: 0,
              }}
            >
              <legend style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', padding: '0 4px' }}>
                {question.q}
              </legend>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                {question.options.map((option, oIndex) => (
                  <label
                    key={option}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 13,
                      fontWeight: 400,
                      color: 'var(--text-primary)',
                      border: `0.5px solid ${answers[qIndex] === oIndex ? 'var(--uc-orange)' : 'var(--border-default)'}`,
                      borderRadius: 'var(--r-md)',
                      padding: '8px 10px',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name={`question-${qIndex}`}
                      checked={answers[qIndex] === oIndex}
                      onChange={() => handleSelect(qIndex, oIndex)}
                    />
                    {option}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <button
            type="button"
            className="press-feedback"
            onClick={handleSubmit}
            disabled={!allAnswered || mutation.isPending}
            style={{ ...buttonStyle, opacity: !allAnswered || mutation.isPending ? 0.6 : 1 }}
          >
            Submit
          </button>
        </div>
      )}
    </Modal>
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
