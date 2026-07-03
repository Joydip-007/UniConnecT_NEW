import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { drawerIn, overlayIn } from '@/lib/motion'

interface DrawerProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  height?: string
}

export function Drawer({ isOpen, onClose, title, children, height = '70dvh' }: DrawerProps) {
  const reduced = useReducedMotion()

  useEffect(() => {
    if (!isOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen, onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          data-testid="drawer-backdrop"
          onClick={onClose}
          initial={reduced ? false : overlayIn.initial}
          animate={overlayIn.animate}
          exit={reduced ? undefined : overlayIn.exit}
          transition={overlayIn.transition}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 'var(--z-modal)',
            background: 'var(--overlay-bg-soft)',
            display: 'flex',
            alignItems: 'flex-end',
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={(e) => e.stopPropagation()}
            initial={reduced ? false : drawerIn.initial}
            animate={drawerIn.animate}
            exit={reduced ? undefined : drawerIn.exit}
            transition={drawerIn.transition}
            style={{
              width: '100%',
              height,
              background: 'var(--surface-card)',
              borderTop: '0.5px solid var(--border-hover)',
              borderRadius: 'var(--r-xl) var(--r-xl) 0 0',
              padding: '12px 16px 16px',
              overflowY: 'auto',
            }}
          >
            <div
              aria-hidden="true"
              style={{
                width: 36,
                height: 4,
                borderRadius: 'var(--r-pill)',
                background: 'var(--border-strong)',
                margin: '0 auto 12px',
              }}
            />
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
