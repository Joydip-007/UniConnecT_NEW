import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ReportReason, ReportTargetType } from '@uniconnect/shared'
import { GhostBtn, OrangeBtn } from '@/components/Button'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useReport } from '../hooks/useModeration'

interface Props {
  isOpen: boolean
  onClose: () => void
  targetType: ReportTargetType
  targetId: string
  /** What is being reported, shown in the heading (e.g. a person's name or "this post"). */
  targetLabel: string
  triggerRef?: React.RefObject<HTMLButtonElement>
}

const REASONS: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: 'Spam or scam' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'hate_speech', label: 'Hate speech' },
  { value: 'violence', label: 'Violence or threats' },
  { value: 'nudity', label: 'Nudity or sexual content' },
  { value: 'misinformation', label: 'False information' },
  { value: 'impersonation', label: 'Impersonation' },
  { value: 'self_harm', label: 'Self-harm' },
  { value: 'other', label: 'Something else' },
]

export function ReportModal({ isOpen, onClose, targetType, targetId, targetLabel }: Props) {
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [description, setDescription] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)
  const report = useReport()
  const MAX = 1000

  // Trap focus within the dialog and restore it to the trigger on close.
  useFocusTrap(isOpen, dialogRef)

  useEffect(() => {
    if (isOpen) {
      setReason(null)
      setDescription('')
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const submit = () => {
    if (!reason) return
    report.mutate(
      { targetType, targetId, reason, description: description.trim() || undefined },
      { onSuccess: onClose },
    )
  }

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'var(--overlay-bg)' }} onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-modal-title"
        tabIndex={-1}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 440,
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: 20,
          maxHeight: '85vh',
          overflowY: 'auto',
        }}
      >
        <h2 id="report-modal-title" style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
          Report {targetLabel}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '6px 0 16px' }}>
          Your report is anonymous and reviewed by your university's admins.
        </p>

        <fieldset style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <legend style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>Why are you reporting this?</legend>
          {REASONS.map((r) => (
            <label
              key={r.value}
              className="row-hover-bg"
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontSize: 14, color: 'var(--text-primary)' }}
            >
              <input
                type="radio"
                name="report-reason"
                value={r.value}
                checked={reason === r.value}
                onChange={() => setReason(r.value)}
                style={{ accentColor: 'var(--uc-orange)' }}
              />
              {r.label}
            </label>
          ))}
        </fieldset>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, MAX))}
          placeholder="Add any details (optional)"
          rows={3}
          style={{
            width: '100%',
            marginTop: 14,
            padding: '10px 12px',
            background: 'var(--surface-page)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-md)',
            color: 'var(--text-primary)',
            fontSize: 13,
            resize: 'vertical',
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <GhostBtn onClick={onClose} disabled={report.isPending}>Cancel</GhostBtn>
          <OrangeBtn onClick={submit} disabled={!reason || report.isPending}>
            {report.isPending ? 'Submitting…' : 'Submit report'}
          </OrangeBtn>
        </div>
      </div>
    </div>,
    document.body,
  )
}
