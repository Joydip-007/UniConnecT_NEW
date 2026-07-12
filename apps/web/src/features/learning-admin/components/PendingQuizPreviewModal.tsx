import { formatDistanceToNow } from 'date-fns'
import { Modal } from '@/components/Modal'
import { usePendingQuizBatchDetail } from '../hooks/useLearningAdmin'

interface PendingQuizPreviewModalProps {
  batchId: string | null
  open: boolean
  onClose: () => void
}

const labelStyle: React.CSSProperties = { fontSize: 13, color: 'var(--text-secondary)' }

/** Read-only "how it will look to students" preview of a generated quiz batch, with the correct answer marked. */
export function PendingQuizPreviewModal({ batchId, open, onClose }: PendingQuizPreviewModalProps) {
  const { data: batch, isLoading } = usePendingQuizBatchDetail(batchId)

  if (!open) return null

  return (
    <Modal isOpen={open} onClose={onClose} title={batch ? `${batch.department} quiz` : 'Quiz preview'} maxWidth={560}>
      {isLoading || !batch ? (
        <p style={labelStyle}>Loading…</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ margin: 0, ...labelStyle }}>
            Generated {formatDistanceToNow(new Date(batch.generated_at), { addSuffix: true })}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {batch.questions.map((question, qIndex) => (
              <fieldset
                key={qIndex}
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  {question.options.map((option, oIndex) => (
                    <div
                      key={oIndex}
                      style={{
                        fontSize: 13,
                        padding: '7px 10px',
                        borderRadius: 'var(--r-md)',
                        border: `0.5px solid ${oIndex === question.answer ? 'var(--uc-mint-bdr)' : 'var(--border-default)'}`,
                        background: oIndex === question.answer ? 'var(--uc-mint-bg)' : 'transparent',
                        color: oIndex === question.answer ? 'var(--uc-mint)' : 'var(--text-primary)',
                        fontWeight: oIndex === question.answer ? 500 : 400,
                      }}
                    >
                      {option}
                      {oIndex === question.answer ? ' — correct' : ''}
                    </div>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}
