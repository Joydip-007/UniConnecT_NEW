import type { LucideIcon } from 'lucide-react'
import { ArrowLeft, RotateCcw, WifiOff } from 'lucide-react'
import { GhostBtn } from '@/components/Button'
import { useBareShell } from '@/stores/shellStore'

type DetailUnavailableProps =
  | {
      kind: 'not-found'
      icon: LucideIcon
      title: string
      body: string
      /** "Back to feed" and the like. */
      backLabel: string
      onBack: () => void
    }
  | {
      kind: 'failed'
      title: string
      body: string
      onRetry: () => void
    }

/**
 * The one card every detail route shows when its item can't be shown. A real 404 is
 * quiet (tertiary icon, a way back); a failed request is red with Try again, so the
 * two never read alike. Drops the shell to the bare 560px column while mounted.
 */
export function DetailUnavailable(props: DetailUnavailableProps) {
  useBareShell()
  const failed = props.kind === 'failed'
  const Icon = failed ? WifiOff : props.icon

  return (
    <div
      role={failed ? 'alert' : undefined}
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: '40px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        textAlign: 'center',
      }}
    >
      <Icon
        size={32}
        strokeWidth={1.5}
        aria-hidden="true"
        style={{ color: failed ? 'var(--uc-red)' : 'var(--text-tertiary)', flexShrink: 0 }}
      />
      <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>{props.title}</p>
      <p
        style={{
          margin: 0,
          maxWidth: 340,
          fontSize: 13,
          lineHeight: 1.6,
          color: 'var(--text-secondary)',
          textWrap: 'pretty',
        }}
      >
        {props.body}
      </p>
      <GhostBtn onClick={props.kind === 'failed' ? props.onRetry : props.onBack} style={{ marginTop: 6 }}>
        {failed ? <RotateCcw size={14} strokeWidth={1.5} /> : <ArrowLeft size={14} strokeWidth={1.5} />}
        {props.kind === 'failed' ? 'Try again' : props.backLabel}
      </GhostBtn>
    </div>
  )
}
