import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Link2, Share2, Send, Repeat2 } from 'lucide-react'
import type { ShareEntityType } from '@uniconnect/shared'
import { useShareLink } from '@/features/share/hooks/useShareLink'

export interface ShareMenuProps {
  entityType: ShareEntityType
  entityId: string
  /** Optional title passed to the native share sheet. */
  title?: string
  /** Render prop for the trigger. Receives a click handler that toggles the menu. */
  children?: (props: { open: boolean; toggle: () => void }) => React.ReactNode
  /** When provided, adds "Share to profile" row at the top. */
  onShareToProfile?: () => void
  /** When true, "Share to profile" shows a "Remove share" option instead. */
  isSharedByMe?: boolean
  onUnshare?: () => void
}

/**
 * Facebook-style share popover, anchored to its trigger. Foundation rows are Copy link
 * and (when supported) Share via… (native sheet). The "Send in a message" row is a
 * reserved slot for the follow-up in-app share — disabled until that ships.
 */
export function ShareMenu({ entityType, entityId, title, children, onShareToProfile, isSharedByMe, onUnshare }: ShareMenuProps) {
  const [open, setOpen] = useState(false)
  const { copy, nativeShare, canNativeShare } = useShareLink(entityType, entityId, title)

  const anchorRef = useRef<HTMLDivElement>(null)
  // Fixed-viewport coordinates for the portalled popover, so no ancestor's
  // `overflow: hidden` (e.g. the rounded post card) can clip it.
  const [pos, setPos] = useState<{ top: number; right: number; up: boolean } | null>(null)

  // Rows: Copy link (always) + Share via… (when supported) + Send in a message.
  const rowCount = canNativeShare ? 3 : 2
  const estHeight = rowCount * 35 + 8

  const place = useCallback(() => {
    const el = anchorRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const up = r.bottom + estHeight + 8 > window.innerHeight && r.top - estHeight - 8 > 0
    setPos({
      top: up ? r.top - estHeight - 4 : r.bottom + 4,
      right: window.innerWidth - r.right,
      up,
    })
  }, [estHeight])

  useLayoutEffect(() => {
    if (!open) return
    place()
    const onScroll = () => place()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open, place])

  const toggle = () => setOpen((o) => !o)
  const close = () => setOpen(false)

  return (
    <div ref={anchorRef} style={{ position: 'relative', display: 'inline-flex' }}>
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

      {createPortal(
        <AnimatePresence>
          {open && pos && (
            <>
              <button
                type="button"
                aria-label="Close share menu"
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 1099,
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  margin: 0,
                  cursor: 'default',
                }}
                onClick={close}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    close();
                  }
                }}
              />
              <motion.div
                role="menu"
                initial={{ opacity: 0, scale: 0.96, y: pos.up ? 4 : -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: pos.up ? 4 : -4 }}
                transition={{ type: 'tween', duration: 0.15, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
                style={{
                  position: 'fixed',
                  top: pos.top,
                  right: pos.right,
                  zIndex: 1100,
                  background: 'var(--surface-raised)',
                  border: '0.5px solid var(--border-hover)',
                  borderRadius: 'var(--r-md)',
                  padding: 4,
                  minWidth: 180,
                  transformOrigin: pos.up ? 'bottom right' : 'top right',
                }}
              >
                {onShareToProfile && !isSharedByMe && (
                  <Row icon={<Repeat2 size={13} strokeWidth={1.5} />} label="Share to profile" onClick={() => { close(); onShareToProfile() }} />
                )}
                {isSharedByMe && onUnshare && (
                  <Row icon={<Repeat2 size={13} strokeWidth={1.5} />} label="Remove share" onClick={() => { close(); onUnshare() }} danger />
                )}
                <Row icon={<Link2 size={13} strokeWidth={1.5} />} label="Copy link" onClick={() => { close(); void copy() }} />
                {canNativeShare && (
                  <Row icon={<Share2 size={13} strokeWidth={1.5} />} label="Share via…" onClick={() => { close(); void nativeShare() }} />
                )}
                <Row icon={<Send size={13} strokeWidth={1.5} />} label="Send in a message" disabled />
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}

function Row({ icon, label, onClick, disabled, danger }: { icon: React.ReactNode; label: string; onClick?: () => void; disabled?: boolean; danger?: boolean }) {
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
        color: disabled ? 'var(--text-tertiary)' : danger ? 'var(--uc-red)' : 'var(--text-primary)',
        opacity: disabled ? 0.6 : 1,
        textAlign: 'left',
      }}
    >
      {icon}
      {label}
    </button>
  )
}
