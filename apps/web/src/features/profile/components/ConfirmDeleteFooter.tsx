import { GhostBtn, PrimaryBtn } from '@/components/Button'

interface Props {
  /** What is being deleted, e.g. "education entry". */
  noun: string
  pending: boolean
  failed: boolean
  onCancel: () => void
  onConfirm: () => void
}

/**
 * The second step of a delete inside an edit modal. It replaces the modal's footer
 * rather than opening a second modal on top, so there is one overlay, one Escape.
 */
export function ConfirmDeleteFooter({ noun, pending, failed, onCancel, onConfirm }: Props) {
  return (
    <div
      role="alertdialog"
      aria-label={`Delete this ${noun}?`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '14px 20px',
        borderTop: '0.5px solid var(--border-default)',
        background: 'var(--uc-red-bg)',
        flexShrink: 0,
      }}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--uc-red)' }}>Delete this {noun}?</span>
        <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--uc-red)' }}>
          {failed ? "Couldn't delete — try again" : "This can't be undone."}
        </span>
      </div>
      <GhostBtn type="button" onClick={onCancel} disabled={pending}>
        Keep
      </GhostBtn>
      <PrimaryBtn
        type="button"
        onClick={onConfirm}
        disabled={pending}
        autoFocus
        style={{ background: 'var(--uc-red)' }}
      >
        {pending ? 'Deleting…' : 'Delete'}
      </PrimaryBtn>
    </div>
  )
}
