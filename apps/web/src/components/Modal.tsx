import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'
import { modalIn, overlayIn } from '@/lib/motion'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  maxWidth?: number
  triggerRef?: React.RefObject<HTMLButtonElement | null>
  /**
   * `frame="panel"` renders only the portal, backdrop, focus trap and dialog shell —
   * no padding and no built-in title row — so a caller can compose its own
   * header / scroll body / footer (see `features/groups/components/GroupPanel`).
   * `title` still feeds `aria-label`.
   */
  frame?: 'default' | 'panel'
  /**
   * Renders as a bottom sheet under 767px (drag handle, bottom-anchored,
   * top corners only) via the `.modal--sheet` CSS class — desktop is unaffected.
   */
  sheet?: boolean
  /** Width cap for `frame="panel"`. */
  panelWidth?: number
  /**
   * Panel fill. `raised` lifts the dialog one step so `--surface-card` rows inside it
   * still read as cards (the Learn dialogs stack unit and attempt cards).
   */
  panelSurface?: 'card' | 'raised'
}

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 440,
  triggerRef,
  frame = 'default',
  sheet = false,
  panelWidth = 560,
  panelSurface = 'card',
}: ModalProps) {
  const isPanel = frame === 'panel'
  const panelRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  // Escape + Tab trap
  useEffect(() => {
    if (!isOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (items.length === 0) return
      const idx = items.indexOf(document.activeElement as HTMLElement)
      if (idx === -1) {
        e.preventDefault()
        if (e.shiftKey) {
          items[items.length - 1].focus()
        } else {
          items[0].focus()
        }
      } else if (e.shiftKey && idx <= 0) {
        e.preventDefault()
        items[items.length - 1].focus()
      } else if (!e.shiftKey && idx === items.length - 1) {
        e.preventDefault()
        items[0].focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  // Scroll lock + initial focus + focus return
  useEffect(() => {
    if (!isOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)
    first?.focus()
    const previousTrigger = triggerRef?.current
    return () => {
      document.body.style.overflow = prevOverflow
      previousTrigger?.focus()
    }
  }, [isOpen, triggerRef])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          data-testid="modal-backdrop"
          onClick={onClose}
          className={sheet ? 'modal-overlay--sheet' : undefined}
          initial={reduced ? false : overlayIn.initial}
          animate={overlayIn.animate}
          exit={reduced ? undefined : overlayIn.exit}
          transition={overlayIn.transition}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 'var(--z-modal)',
            background: 'var(--overlay-bg)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={(e) => e.stopPropagation()}
            className={sheet ? 'modal--sheet' : undefined}
            initial={reduced ? false : modalIn.initial}
            animate={modalIn.animate}
            exit={reduced ? undefined : modalIn.exit}
            transition={modalIn.transition}
            style={
              isPanel
                ? {
                    width: `min(${panelWidth}px, 100%)`,
                    maxHeight: '80vh',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    background: panelSurface === 'raised' ? 'var(--surface-raised)' : 'var(--surface-card)',
                    border: '0.5px solid var(--border-hover)',
                    borderRadius: 'var(--r-xl)',
                  }
                : {
                    width: '100%',
                    maxWidth,
                    maxHeight: 'calc(100dvh - 48px)',
                    overflowY: 'auto',
                    background: 'var(--surface-card)',
                    border: '0.5px solid var(--border-hover)',
                    borderRadius: 'var(--r-xl)',
                    padding: 20,
                  }
            }
          >
            {sheet && <div className="modal-drag-handle" aria-hidden />}
            {!isPanel && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>{title}</h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="press-feedback"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={16} />
              </button>
            </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
