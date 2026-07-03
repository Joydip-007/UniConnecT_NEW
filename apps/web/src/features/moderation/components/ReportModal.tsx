import { useEffect, useState } from 'react'
import type { ReportReason, ReportTargetType } from '@uniconnect/shared'
import { GhostBtn, OrangeBtn } from '@/components/Button'
import { Modal } from '@/components/Modal'
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

export function ReportModal({ isOpen, onClose, targetType, targetId, targetLabel, triggerRef }: Props) {
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [description, setDescription] = useState('')
  const report = useReport()
  const MAX = 1000

  useEffect(() => {
    if (isOpen) {
      setReason(null)
      setDescription('')
    }
  }, [isOpen])

  const submit = () => {
    if (!reason) return
    report.mutate(
      { targetType, targetId, reason, description: description.trim() || undefined },
      { onSuccess: onClose },
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Report ${targetLabel}`} maxWidth={440} triggerRef={triggerRef}>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '0 0 16px' }}>
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
    </Modal>
  )
}
