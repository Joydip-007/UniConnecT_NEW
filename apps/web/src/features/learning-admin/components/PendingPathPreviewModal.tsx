import { BookOpen, Film, PenLine, HelpCircle } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { usePendingPathDetail } from '../hooks/useLearningAdmin'

interface PendingPathPreviewModalProps {
  pathId: string | null
  open: boolean
  onClose: () => void
}

const UNIT_ICON = { read: BookOpen, video: Film, exercise: PenLine, quiz: HelpCircle } as const

const labelStyle: React.CSSProperties = { fontSize: 13, color: 'var(--text-secondary)' }

/** Read-only "how it will render for students" preview — no enroll/complete actions. */
export function PendingPathPreviewModal({ pathId, open, onClose }: PendingPathPreviewModalProps) {
  const { data: path, isLoading } = usePendingPathDetail(pathId)

  if (!open) return null

  return (
    <Modal isOpen={open} onClose={onClose} title={path?.title ?? 'Path preview'} maxWidth={560}>
      {isLoading || !path ? (
        <p style={labelStyle}>Loading…</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {path.description}
          </p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>
            {path.units.length} units · ~{path.estimated_days} days · {path.difficulty} · {path.category}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {path.units.map((unit) => {
              const Icon = UNIT_ICON[unit.type]
              return (
                <div
                  key={unit.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    padding: '10px 12px',
                    borderRadius: 'var(--r-md)',
                    border: '0.5px solid var(--border-default)',
                    background: 'var(--surface-card)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Icon size={15} style={{ color: 'var(--uc-indigo-l)', flexShrink: 0 }} aria-hidden="true" />
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{unit.title}</span>
                  </div>

                  {unit.type === 'quiz' && unit.content?.questions ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 25 }}>
                      {unit.content.questions.map((q, qIndex) => (
                        <div key={qIndex}>
                          <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
                            {q.q}
                          </p>
                          <ul style={{ margin: '4px 0 0', paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {q.options.map((opt, oIndex) => (
                              <li
                                key={oIndex}
                                style={{
                                  fontSize: 12,
                                  color: oIndex === q.answer ? 'var(--uc-mint)' : 'var(--text-secondary)',
                                  fontWeight: oIndex === q.answer ? 500 : 400,
                                }}
                              >
                                {opt}
                                {oIndex === q.answer ? ' ✓' : ''}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : unit.content?.body ? (
                    <p
                      style={{
                        margin: 0,
                        paddingLeft: 25,
                        fontSize: 12,
                        color: 'var(--text-secondary)',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {unit.content.body}
                    </p>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </Modal>
  )
}
