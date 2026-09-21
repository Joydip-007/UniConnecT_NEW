import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { X } from 'lucide-react'
import { Modal } from '@/components/Modal'

interface GroupPanelProps {
  icon: LucideIcon
  title: string
  subtitle?: string
  onClose: () => void
  footer?: ReactNode
  children: ReactNode
}

/**
 * The centred overlay frame the group screens share (Members, Invite): a header row
 * with an orange icon, a scrolling body and an optional footer. Built on `Modal`'s
 * portal + focus trap via `frame="panel"` rather than re-implementing them.
 */
export function GroupPanel({ icon: Icon, title, subtitle, onClose, footer, children }: GroupPanelProps) {
  return (
    <Modal isOpen onClose={onClose} title={title} frame="panel">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '14px 18px',
          borderBottom: '0.5px solid var(--border-default)',
          flexShrink: 0,
        }}
      >
        <Icon size={16} strokeWidth={1.5} color="var(--uc-orange)" aria-hidden />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>{title}</h2>
          {subtitle && (
            <p style={{ margin: '1px 0 0', fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>
              {subtitle}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="press-feedback"
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {children}
      </div>

      {footer && (
        <div
          style={{
            padding: '12px 18px',
            borderTop: '0.5px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
          }}
        >
          {footer}
        </div>
      )}
    </Modal>
  )
}
