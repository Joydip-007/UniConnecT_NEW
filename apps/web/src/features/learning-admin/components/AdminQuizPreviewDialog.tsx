import { ListChecks } from 'lucide-react'
import type { AdminQuiz } from '@uniconnect/shared'
import { useAdminQuizQuestions, useApproveQuizBatch, useDiscardQuizBatch } from '../hooks/useLearningAdmin'
import { DialogBtn, DialogFrame } from './learningAdminUi'
import { quizSourceLabel } from './quizStatus'

interface Props {
  quiz: AdminQuiz | null
  onClose: () => void
}

/**
 * "Results" / "Preview" for any Quizzes-tab row: the questions with the correct option
 * marked, plus attempt stats when live. An AI batch awaiting review also gets its
 * Approve / Discard here, since that is the only decision the row is waiting on.
 */
export function AdminQuizPreviewDialog({ quiz, onClose }: Props) {
  const { data, isLoading } = useAdminQuizQuestions(quiz?.kind ?? null, quiz?.id ?? null)
  const approve = useApproveQuizBatch()
  const discard = useDiscardQuizBatch()
  if (!quiz) return null

  const live = quiz.status === 'published'
  const reviewable = quiz.kind === 'ai_batch' && quiz.status === 'needs_review'
  const busy = approve.isPending || discard.isPending

  return (
    <DialogFrame
      open
      onClose={onClose}
      icon={<ListChecks size={18} />}
      title={quiz.title}
      subtitle={
        live
          ? `${quiz.attempts.toLocaleString()} attempts · avg score ${quiz.avgScore ?? 0}% · pass ${quiz.passMark}%`
          : `${quiz.pathTitle} · ${quizSourceLabel(quiz)}`
      }
      maxWidth={560}
      footer={
        reviewable ? (
          <>
            <DialogBtn tone="ghost" onClick={() => discard.mutate(quiz.id, { onSuccess: onClose })} disabled={busy}>
              Discard
            </DialogBtn>
            <DialogBtn tone="solid" onClick={() => approve.mutate(quiz.id, { onSuccess: onClose })} disabled={busy}>
              Approve
            </DialogBtn>
          </>
        ) : (
          <DialogBtn tone="ghost" onClick={onClose}>
            Close
          </DialogBtn>
        )
      }
    >
      {isLoading || !data ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>Loading…</p>
      ) : data.questions.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>No questions yet.</p>
      ) : (
        data.questions.map((question, qIndex) => (
          <fieldset key={qIndex} style={{ border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-md)', padding: 12, margin: 0 }}>
            <legend style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', padding: '0 4px' }}>{question.q}</legend>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {question.options.map((option, oIndex) => {
                const correct = oIndex === question.answer
                return (
                  <div
                    key={oIndex}
                    style={{
                      fontSize: 13,
                      padding: '7px 10px',
                      borderRadius: 'var(--r-md)',
                      border: `0.5px solid ${correct ? 'var(--uc-mint-bdr)' : 'var(--border-default)'}`,
                      background: correct ? 'var(--uc-mint-bg)' : 'transparent',
                      color: correct ? 'var(--uc-mint)' : 'var(--text-primary)',
                      fontWeight: correct ? 500 : 400,
                    }}
                  >
                    {option}
                    {correct ? ' — correct' : ''}
                  </div>
                )
              })}
            </div>
          </fieldset>
        ))
      )}
    </DialogFrame>
  )
}
