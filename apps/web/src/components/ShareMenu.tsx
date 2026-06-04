import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link2, Share2, Send } from 'lucide-react'
import type { ShareEntityType } from '@uniconnect/shared'
import { useShareLink } from '@/features/share/hooks/useShareLink'

export interface ShareMenuProps {
  entityType: ShareEntityType
  entityId: string
  /** Optional title passed to the native share sheet. */
  title?: string
  /** Render prop for the trigger. Receives a click handler that toggles the menu. */
  children?: (props: { open: boolean; toggle: () => void }) => React.ReactNode
}

/**
 * Facebook-style share popover, anchored to its trigger. Foundation rows are Copy link
 * and (when supported) Share via… (native sheet). The "Send in a message" row is a
 * reserved slot for the follow-up in-app share — disabled until that ships.
 */
export function ShareMenu({ entityType, entityId, title, children }: ShareMenuProps) {
  const [open, setOpen] = useState(false)
  const { copy, nativeShare, canNativeShare } = useShareLink(entityType, entityId, title)

  const toggle = () => setOpen((o) => !o)
  const close = () => setOpen(false)

  return (
    <div style={{ position: 'relative' }}>
      {children ? (
        children({ open, toggle })
      ) : (
        <button
          type="button"
          onClick={toggle}
          aria-label="Share"
          aria-haspopup="menu"
          aria-expanded={open}
          className="press-feedback row-hover-bg"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            borderRadius: 'var(--r-sm)',
            color: 'var(--text-tertiary)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Share2 size={16} strokeWidth={1.5} />
        </button>
      )}

      <AnimatePresence>
        {open && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={close} />
            <motion.div
              role="menu"
              initial={{ opacity: 0, scale: 0.96, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -4 }}
              transition={{ type: 'tween', duration: 0.15, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                zIndex: 50,
                background: 'var(--surface-raised)',
                border: '0.5px solid var(--border-hover)',
                borderRadius: 'var(--r-md)',
                padding: 4,
                minWidth: 180,
                marginTop: 4,
                transformOrigin: 'top right',
              }}
            >
              <Row icon={<Link2 size={13} strokeWidth={1.5} />} label="Copy link" onClick={() => { close(); void copy() }} />
              {canNativeShare && (
                <Row icon={<Share2 size={13} strokeWidth={1.5} />} label="Share via…" onClick={() => { close(); void nativeShare() }} />
              )}
              <Row icon={<Send size={13} strokeWidth={1.5} />} label="Send in a message" disabled />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

function Row({ icon, label, onClick, disabled }: { icon: React.ReactNode; label: string; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={disabled ? undefined : 'nav-menu-item'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '8px 12px',
        background: 'transparent',
        border: 'none',
        borderRadius: 'var(--r-sm)',
        cursor: disabled ? 'default' : 'pointer',
        fontSize: 13,
        fontWeight: 400,
        color: disabled ? 'var(--text-tertiary)' : 'var(--text-primary)',
        opacity: disabled ? 0.6 : 1,
        textAlign: 'left',
      }}
    >
      {icon}
      {label}
    </button>
  )
}
