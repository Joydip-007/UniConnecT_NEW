import { useEffect, useState } from 'react'
import { isAxiosError } from 'axios'
import { Check, History, RotateCcw, X } from 'lucide-react'
import { LEARNING } from '@uniconnect/shared'
import { useToastStore } from '@/stores/toastStore'
import { streakToastMessage, usePath, useSubmitUnitQuiz, useUnitAttempts } from '../hooks/useLearning'
import type { UnitQuizAttempt } from '../types'
import { LearnDialog } from './learnUi'
import { pillButton } from '../learnFormat'

interface QuizModalProps {
  pathId: string
  unitId: string
  onClose: () => void
  /** Present when the quiz was opened from its unit inside the path dialog. */
  onBack?: () => void
  onShowResults: () => void
}

function errorMessage(err: unknown, fallback: string) {
  if (isAxiosError(err) && typeof err.response?.data?.error === 'string') return err.response.data.error
  return fallback
}

const visuallyHidden: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
}

/**
 * A path checkpoint quiz. The server grades each submission and records it (Past results),
 * and a pass on the current unit completes it. Retrying keeps the questions you got right
 * locked in and only blanks the ones to fix.
 */
export function QuizModal({ pathId, unitId, onClose, onBack, onShowResults }: QuizModalProps) {
  const { data: path } = usePath(pathId)
  const { data: attempts } = useUnitAttempts(unitId)
  const submit = useSubmitUnitQuiz()
  const show = useToastStore((s) => s.show)

  const unit = path?.units.find((u) => u.id === unitId)
  const questions = unit?.content?.questions ?? []
  const [picks, setPicks] = useState<(number | null)[]>([])
  const [graded, setGraded] = useState<UnitQuizAttempt | null>(null)

  useEffect(() => {
    setPicks(questions.map(() => null))
    setGraded(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId, questions.length])

  const passScore = unit?.completion_rule?.passScore ?? LEARNING.DEFAULT_QUIZ_PASS_SCORE
  const answered = questions.length > 0 && picks.length === questions.length && picks.every((p) => p !== null)
  const wrong = graded ? graded.review.filter((r) => !r.isCorrect).length : 0

  function handleSubmit() {
    if (!answered || submit.isPending) return
    submit.mutate(
      { unitId, answers: picks as number[] },
      {
        onSuccess: (res) => {
          setGraded(res.attempt)
          if (res.completion && !res.completion.alreadyCompleted) {
            show({ message: streakToastMessage(res.completion.streak.currentStreak), type: 'success' })
            if (res.completion.pathCompleted) show({ message: 'Path complete! Badge on its way', type: 'success' })
          }
          if (res.completionError) show({ message: res.completionError, type: 'error' })
        },
        onError: (err) => show({ message: errorMessage(err, 'Could not submit your answers'), type: 'error' }),
      },
    )
  }

  function handleRetry() {
    if (!graded) return
    setPicks((prev) => prev.map((p, i) => (graded.review[i]?.isCorrect ? p : null)))
    setGraded(null)
  }

  function handleFooter() {
    if (!graded) return handleSubmit()
    if (wrong > 0) return handleRetry()
    return onBack ? onBack() : onClose()
  }

  const buttonLabel = !graded
    ? 'Submit'
    : wrong === 0
      ? 'Done'
      : `Retry ${wrong} ${wrong === 1 ? 'question' : 'questions'}`

  return (
    <LearnDialog
      label="Quiz"
      title={unit?.title ?? 'Quiz'}
      sub={`${path ? `${path.title} · ` : ''}pass mark ${passScore}%`}
      onClose={onClose}
      onBack={onBack}
      headerAction={
        attempts && attempts.length > 0 ? (
          <button
            type="button"
            onClick={onShowResults}
            className="interactive-surface"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'none',
              border: 'none',
              padding: '6px 8px',
              borderRadius: 'var(--r-pill)',
              fontSize: 12,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <History size={14} aria-hidden="true" />
            Past results
          </button>
        ) : null
      }
      footer={
        <button
          type="button"
          onClick={handleFooter}
          aria-disabled={!graded && (!answered || submit.isPending)}
          className="press-feedback"
          style={{ ...pillButton('primary'), opacity: !graded && (!answered || submit.isPending) ? 0.6 : 1 }}
        >
          {buttonLabel}
        </button>
      }
    >
      {graded && (
        <div
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 12px',
            borderRadius: 'var(--r-md)',
            border: `0.5px solid ${wrong === 0 ? 'var(--uc-mint-bdr)' : 'var(--uc-amber-bdr)'}`,
            background: wrong === 0 ? 'var(--uc-mint-bg)' : 'var(--uc-amber-bg)',
            fontSize: 13,
            color: 'var(--text-primary)',
          }}
        >
          {wrong === 0 ? (
            <Check size={14} color="var(--uc-mint)" aria-hidden="true" style={{ flexShrink: 0 }} />
          ) : (
            <RotateCcw size={14} color="var(--uc-amber-l)" aria-hidden="true" style={{ flexShrink: 0 }} />
          )}
          {wrong === 0
            ? 'All correct. Checkpoint cleared.'
            : `${wrong} of ${questions.length} to fix. The rest stay locked in.`}
        </div>
      )}

      {!unit ? (
        <div style={{ height: 160, borderRadius: 'var(--r-md)', background: 'var(--surface-card)' }} />
      ) : questions.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>This quiz has no questions yet.</p>
      ) : (
        questions.map((question, qIndex) => {
          const review = graded?.review[qIndex]
          const right = review?.isCorrect ?? false
          const locked = !!graded && right
          return (
            <fieldset
              key={`${qIndex}-${question.q}`}
              style={{
                border: `0.5px solid ${!graded ? 'var(--border-default)' : right ? 'var(--uc-mint-bdr)' : 'var(--uc-red-bdr)'}`,
                borderRadius: 'var(--r-md)',
                padding: 12,
                margin: 0,
              }}
            >
              <legend style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', padding: '0 4px' }}>{question.q}</legend>
              {graded && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 500,
                    color: right ? 'var(--uc-mint)' : 'var(--uc-red)',
                    marginTop: 2,
                  }}
                >
                  {right ? <Check size={13} aria-hidden="true" /> : <X size={13} aria-hidden="true" />}
                  {right ? 'Correct, locked' : 'Retry this one'}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                {question.options.map((option, oIndex) => {
                  const picked = picks[qIndex] === oIndex
                  const isAnswer = review ? review.correctIndex === oIndex : false
                  let border = 'var(--border-default)'
                  let dotBorder = '1.5px solid var(--border-strong)'
                  if (graded && isAnswer) {
                    border = 'var(--uc-mint-bdr)'
                    dotBorder = '4px solid var(--uc-mint)'
                  } else if (graded && picked) {
                    border = 'var(--uc-red-bdr)'
                    dotBorder = '4px solid var(--uc-red)'
                  } else if (picked) {
                    border = 'var(--uc-orange)'
                    dotBorder = '4px solid var(--uc-orange)'
                  }
                  return (
                    <label
                      key={`${oIndex}-${option}`}
                      style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        minHeight: 36,
                        boxSizing: 'border-box',
                        fontSize: 13,
                        color: 'var(--text-primary)',
                        border: `0.5px solid ${border}`,
                        borderRadius: 'var(--r-md)',
                        padding: '8px 10px',
                        cursor: graded ? 'default' : 'pointer',
                        opacity: locked && !isAnswer ? 0.5 : 1,
                      }}
                    >
                      <input
                        type="radio"
                        name={`question-${qIndex}`}
                        checked={picked}
                        disabled={!!graded}
                        onChange={() => setPicks((prev) => prev.map((p, i) => (i === qIndex ? oIndex : p)))}
                        style={visuallyHidden}
                      />
                      <span
                        aria-hidden="true"
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: '50%',
                          flexShrink: 0,
                          boxSizing: 'border-box',
                          border: dotBorder,
                          background: graded && isAnswer ? 'var(--uc-mint-bg)' : 'transparent',
                        }}
                      />
                      {option}
                    </label>
                  )
                })}
              </div>
            </fieldset>
          )
        })
      )}
    </LearnDialog>
  )
}
