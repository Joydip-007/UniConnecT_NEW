import { useEffect, useState } from 'react'
import { isAxiosError } from 'axios'
import { Check, RotateCcw, X } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { useCompleteUnit, streakToastMessage } from '../hooks/useLearning'
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
  wrongCount: number
}

function extractErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err) && typeof err.response?.data?.error === 'string') {
    return err.response.data.error
  }
  return fallback
}

// Backend does not expose a distinct error code for "quiz failed" vs other 400s
// (e.g. "unit locked") — both use code BAD_REQUEST (see apps/api/src/modules/learning/service.ts).
// Discriminate on the message text so only an actual failed-quiz attempt shows the retry state.
function isQuizFailureError(err: unknown): boolean {
  if (!isAxiosError(err) || err.response?.status !== 400) return false
  const message = err.response?.data?.error
  return typeof message === 'string' && message.toLowerCase().includes('below pass mark')
}

const DEFAULT_PASS_SCORE = 70

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
  const passScore = currentUnit.completion_rule?.passScore ?? DEFAULT_PASS_SCORE
  const graded = result !== null

  function handleSelect(qIndex: number, optionIndex: number) {
    setAnswers((prev) => prev.map((a, i) => (i === qIndex ? optionIndex : a)))
  }

  function handleSubmit() {
    const correct = questions.reduce((acc, q, i) => (answers[i] === q.answer ? acc + 1 : acc), 0)
    const wrongCount = questions.length - correct
    const score = Math.round((100 * correct) / questions.length)

    mutation.mutate(
      { unitId: currentUnit.id, score },
      {
        onSuccess: (res) => {
          setResult({ score, passed: true, passScore, wrongCount })
          show({ message: streakToastMessage(res.streak.currentStreak), type: 'success' })
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
          if (isQuizFailureError(err)) {
            setResult({ score, passed: false, passScore, wrongCount })
            return
          }
          show({ message: extractErrorMessage(err, 'Something went wrong. Please try again.'), type: 'error' })
        },
      },
    )
  }

  /**
   * Retrying blanks only the questions that were wrong. The ones already correct keep their
   * answer and stay locked, so fixing two mistakes does not mean re-answering all five.
   */
  function handleRetry() {
    setAnswers((prev) => prev.map((a, i) => (a === questions[i].answer ? a : null)))
    setResult(null)
  }

  const resultTone = result?.passed
    ? {
        icon: Check,
        color: 'var(--uc-mint)',
        background: 'var(--uc-mint-bg)',
        border: '0.5px solid var(--uc-mint-bdr)',
        text:
          result.wrongCount === 0
            ? 'All correct. Checkpoint cleared.'
            : `Score ${result.score}% · passed.`,
      }
    : result
      ? {
          icon: RotateCcw,
          color: 'var(--uc-amber-l)',
          background: 'var(--uc-amber-bg)',
          border: '0.5px solid var(--uc-amber-bdr)',
          text: `Score ${result.score}%, you need ${result.passScore}%. ${result.wrongCount} of ${questions.length} to fix, the rest stay locked in.`,
        }
      : null

  const buttonLabel = !result
    ? 'Submit'
    : result.passed
      ? 'Done'
      : `Retry ${result.wrongCount} ${result.wrongCount === 1 ? 'question' : 'questions'}`

  return (
    <Modal isOpen={open} onClose={onClose} title={currentUnit.title}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {resultTone ? (
          <div
            role="status"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 12px',
              borderRadius: 'var(--r-md)',
              border: resultTone.border,
              background: resultTone.background,
              fontSize: 13,
              fontWeight: 400,
              color: 'var(--text-primary)',
            }}
          >
            <resultTone.icon size={14} color={resultTone.color} aria-hidden="true" style={{ flexShrink: 0 }} />
            {resultTone.text}
          </div>
        ) : null}

        {questions.map((question, qIndex) => {
          const right = answers[qIndex] === question.answer
          // A question you got right is settled: it keeps its answer through a retry, and
          // only then is it safe to point at the correct option. Questions still to fix mark
          // the answer you picked, never the one you missed — otherwise the retry is a formality.
          const locked = graded && right
          const revealAnswer = graded && (right || result.passed)

          return (
            <fieldset
              key={question.q}
              style={{
                border: `0.5px solid ${
                  !graded
                    ? 'var(--border-default)'
                    : right
                      ? 'var(--uc-mint-bdr)'
                      : 'var(--uc-red-bdr)'
                }`,
                borderRadius: 'var(--r-md)',
                padding: 12,
                margin: 0,
              }}
            >
              <legend style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', padding: '0 4px' }}>
                {question.q}
              </legend>

              {graded ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginTop: 2,
                    fontSize: 12,
                    fontWeight: 500,
                    color: right ? 'var(--uc-mint)' : 'var(--uc-red)',
                  }}
                >
                  {right ? <Check size={13} aria-hidden="true" /> : <X size={13} aria-hidden="true" />}
                  {right ? 'Correct, locked' : 'Retry this one'}
                </div>
              ) : null}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                {question.options.map((option, oIndex) => {
                  const picked = answers[qIndex] === oIndex
                  const isAnswer = oIndex === question.answer

                  let border = 'var(--border-default)'
                  let dotBorder = '1.5px solid var(--border-strong)'
                  let dotBackground = 'transparent'
                  if (revealAnswer && isAnswer) {
                    border = 'var(--uc-mint-bdr)'
                    dotBorder = '4px solid var(--uc-mint)'
                    dotBackground = 'var(--uc-mint-bg)'
                  } else if (graded && picked) {
                    border = 'var(--uc-red-bdr)'
                    dotBorder = '4px solid var(--uc-red)'
                  } else if (picked) {
                    border = 'var(--uc-orange)'
                    dotBorder = '4px solid var(--uc-orange)'
                  }

                  return (
                    <label
                      key={option}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 13,
                        fontWeight: 400,
                        color: 'var(--text-primary)',
                        border: `0.5px solid ${border}`,
                        borderRadius: 'var(--r-md)',
                        padding: '8px 10px',
                        cursor: locked ? 'default' : 'pointer',
                        opacity: locked && !isAnswer ? 0.5 : 1,
                      }}
                    >
                      <input
                        type="radio"
                        name={`question-${qIndex}`}
                        checked={picked}
                        disabled={locked}
                        onChange={() => handleSelect(qIndex, oIndex)}
                        // Visually hidden, not removed: the styled dot beside it is the
                        // only thing drawn, but the radio keeps the group keyboard- and
                        // screen-reader-navigable.
                        style={{
                          position: 'absolute',
                          width: 1,
                          height: 1,
                          padding: 0,
                          margin: -1,
                          overflow: 'hidden',
                          clip: 'rect(0 0 0 0)',
                          whiteSpace: 'nowrap',
                          border: 0,
                        }}
                      />
                      <span
                        aria-hidden="true"
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: '50%',
                          flexShrink: 0,
                          border: dotBorder,
                          background: dotBackground,
                          boxSizing: 'border-box',
                        }}
                      />
                      {option}
                    </label>
                  )
                })}
              </div>
            </fieldset>
          )
        })}

        <button
          type="button"
          className="press-feedback"
          onClick={!result ? handleSubmit : result.passed ? onClose : handleRetry}
          disabled={!result && (!allAnswered || mutation.isPending)}
          style={{
            ...buttonStyle,
            opacity: !result && (!allAnswered || mutation.isPending) ? 0.6 : 1,
          }}
        >
          {buttonLabel}
        </button>
      </div>
    </Modal>
  )
}

const buttonStyle: React.CSSProperties = {
  alignSelf: 'flex-start',
  background: 'var(--uc-orange)',
  color: 'var(--on-accent)',
  border: 'none',
  borderRadius: 'var(--r-pill)',
  padding: '8px 16px',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
}
