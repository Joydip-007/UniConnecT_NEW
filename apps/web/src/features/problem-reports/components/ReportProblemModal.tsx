import { useState } from 'react'
import { isAxiosError } from 'axios'
import { toast } from 'sonner'
import { GhostBtn, PrimaryBtn } from '@/components/Button'
import { Modal } from '@/components/Modal'
import type { ErrorReport } from '@/lib/errorReport'
import { useSubmitProblemReport } from '../hooks/useProblemReports'

const MAX = 1000

interface ReportProblemModalProps {
  report: ErrorReport
  isOpen: boolean
  onClose: () => void
}

/** Sends the crash the section boundary caught to the university admins' queue. */
export function ReportProblemModal({ report, isOpen, onClose }: ReportProblemModalProps) {
  const [description, setDescription] = useState('')
  const submit = useSubmitProblemReport()

  function send() {
    submit.mutate(
      {
        errorId: report.id,
        errorMessage: report.message,
        description: description.trim() || undefined,
        pageUrl: window.location.href,
        userAgent: navigator.userAgent.slice(0, 500),
      },
      {
        onSuccess: () => {
          toast.success('Report sent to your university admins')
          setDescription('')
          onClose()
        },
        onError: (err) => {
          const rateLimited = isAxiosError(err) && err.response?.status === 429
          toast.error(
            rateLimited
              ? 'You have sent a lot of reports recently. Try again later.'
              : `Could not send the report. Quote error ID ${report.id} if it keeps happening.`,
          )
        },
      },
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Report a problem" maxWidth={460}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
          Your university admins will see what went wrong, the page you were on and error ID{' '}
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{report.id}</span>.
        </p>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>What were you doing? (optional)</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, MAX))}
            placeholder="For example, I opened an event from a shared link"
            rows={3}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '10px 12px',
              background: 'var(--surface-page)',
              border: '0.5px solid var(--border-default)',
              borderRadius: 'var(--r-md)',
              color: 'var(--text-primary)',
              fontFamily: 'inherit',
              fontSize: 13,
              resize: 'vertical',
            }}
          />
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <PrimaryBtn onClick={send} disabled={submit.isPending}>
            {submit.isPending ? 'Sending…' : 'Send report'}
          </PrimaryBtn>
        </div>
      </div>
    </Modal>
  )
}
