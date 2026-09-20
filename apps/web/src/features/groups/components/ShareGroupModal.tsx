import { useState } from 'react'
import { Check, ChevronRight, Copy, Link2, Send, Share2 } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { useShareLink } from '@/features/share/hooks/useShareLink'
import type { Group } from '../types'

/**
 * The group's share dialog, routed at `/groups/:id?modal=share`.
 *
 * Rows mirror `ShareMenu`: the link itself, Copy, the device share sheet where the
 * Web Share API exists, and the reserved "Send in a message" slot — disabled here for
 * the same reason it is disabled there, so a shared URL never promises a row the app
 * cannot honour yet.
 */
export function ShareGroupModal({ group, onClose }: { group: Group; onClose: () => void }) {
  const { url, copy, nativeShare, canNativeShare } = useShareLink('group', group.id, group.name)
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await copy()
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <Modal isOpen onClose={onClose} variant="panel" title="Share this group" maxWidth={420}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.04em', color: 'var(--text-label)' }}>Group link</span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 12px',
            background: 'var(--surface-raised)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-pill)',
          }}
        >
          <span style={{ lineHeight: 0, color: 'var(--text-tertiary)' }}>
            <Link2 size={14} strokeWidth={1.5} />
          </span>
          <span
            data-testid="share-group-url"
            style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {url}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="press-feedback"
          style={{
            alignSelf: 'flex-start',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            whiteSpace: 'nowrap',
            fontSize: 13,
            fontWeight: 500,
            fontFamily: 'inherit',
            borderRadius: 'var(--r-pill)',
            padding: '9px 16px',
            cursor: 'pointer',
            background: copied ? 'var(--uc-mint-bg)' : 'var(--uc-indigo-bg)',
            border: `0.5px solid ${copied ? 'var(--uc-mint-bdr)' : 'var(--uc-indigo-bdr)'}`,
            color: copied ? 'var(--uc-mint)' : 'var(--uc-indigo-xl)',
            transition: 'background 150ms, color 150ms, border-color 150ms',
          }}
        >
          {copied ? <Check size={14} strokeWidth={1.5} /> : <Copy size={14} strokeWidth={1.5} />}
          {copied ? 'Link copied' : 'Copy link'}
        </button>
      </div>

      <div style={{ margin: '2px -18px -16px', borderTop: '0.5px solid var(--border-default)' }}>
        {canNativeShare && (
          <TargetRow
            icon={<Share2 size={15} strokeWidth={1.5} />}
            label="Share via…"
            hint="Your device's share sheet"
            onClick={() => void nativeShare()}
          />
        )}
        <TargetRow
          icon={<Send size={15} strokeWidth={1.5} />}
          label="Send in a message"
          hint="Coming soon"
          disabled
          last
        />
      </div>
    </Modal>
  )
}

function TargetRow({
  icon,
  label,
  hint,
  onClick,
  disabled,
  last,
}: {
  icon: React.ReactNode
  label: string
  hint: string
  onClick?: () => void
  disabled?: boolean
  last?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={disabled ? undefined : 'row-hover-bg'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        textAlign: 'left',
        padding: '12px 18px',
        background: 'transparent',
        border: 'none',
        borderBottom: last ? 'none' : '0.5px solid var(--border-default)',
        cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'inherit',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span
        style={{
          width: 32,
          height: 32,
          borderRadius: 'var(--r-sm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          background: 'var(--uc-indigo-bg)',
          color: 'var(--uc-indigo-l)',
        }}
      >
        {icon}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</span>
        <span style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{hint}</span>
      </span>
      {!disabled && (
        <span style={{ lineHeight: 0, color: 'var(--text-tertiary)', flexShrink: 0 }}>
          <ChevronRight size={15} strokeWidth={1.5} />
        </span>
      )}
    </button>
  )
}
