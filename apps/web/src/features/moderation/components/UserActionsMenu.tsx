import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Ban, Flag, MoreHorizontal, VolumeX, Volume2 } from 'lucide-react'
import { useUserModeration } from '../hooks/useModeration'
import { ReportModal } from './ReportModal'

interface Props {
  userId: string
  userName: string
  isMuted: boolean
}

/** Profile overflow menu for moderating another user: mute, block, report. */
export function UserActionsMenu({ userId, userName, isMuted }: Props) {
  const [open, setOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const { block, mute, unmute } = useUserModeration(userId)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  const close = () => setOpen(false)

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`More actions for ${userName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className="press-feedback row-hover-bg"
        style={{
          background: 'transparent',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-pill)',
          cursor: 'pointer',
          padding: 8,
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <MoreHorizontal size={16} strokeWidth={1.5} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <button
              type="button"
              aria-label="Close menu"
              onClick={close}
              style={{ position: 'fixed', inset: 0, zIndex: 1099, background: 'transparent', border: 'none', padding: 0, cursor: 'default' }}
            />
            <motion.div
              role="menu"
              initial={{ opacity: 0, scale: 0.96, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -4 }}
              transition={{ type: 'tween', duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 4,
                zIndex: 1100,
                background: 'var(--surface-raised)',
                border: '0.5px solid var(--border-hover)',
                borderRadius: 'var(--r-md)',
                padding: 4,
                minWidth: 180,
                transformOrigin: 'top right',
              }}
            >
              <MenuRow
                icon={isMuted ? <Volume2 size={14} strokeWidth={1.5} /> : <VolumeX size={14} strokeWidth={1.5} />}
                label={isMuted ? 'Unmute posts' : 'Mute posts'}
                onClick={() => {
                  close()
                  if (isMuted) unmute.mutate()
                  else mute.mutate()
                }}
              />
              <MenuRow
                icon={<Ban size={14} strokeWidth={1.5} />}
                label="Block"
                tone="danger"
                onClick={() => {
                  close()
                  block.mutate()
                }}
              />
              <MenuRow
                icon={<Flag size={14} strokeWidth={1.5} />}
                label="Report"
                tone="danger"
                onClick={() => {
                  close()
                  setReportOpen(true)
                }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ReportModal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="user"
        targetId={userId}
        targetLabel={userName}
        triggerRef={triggerRef}
      />
    </div>
  )
}

function MenuRow({
  icon,
  label,
  onClick,
  tone = 'default',
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  tone?: 'default' | 'danger'
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="nav-menu-item"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '8px 12px',
        background: 'transparent',
        border: 'none',
        borderRadius: 'var(--r-sm)',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 400,
        color: tone === 'danger' ? 'var(--uc-red)' : 'var(--text-primary)',
        textAlign: 'left',
      }}
    >
      {icon}
      {label}
    </button>
  )
}
