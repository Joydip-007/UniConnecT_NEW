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
   * `panel` is the design's dialog chrome for a task surface: a header row with an
   * accent icon, title and one-line subtitle, a body that scrolls on its own, and an
   * optional pinned footer. The default chrome pads the whole card and lets it scroll.
   */
  variant?: 'default' | 'panel'
  icon?: React.ReactNode
  subtitle?: string
  footer?: React.ReactNode
}

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 440,
  triggerRef,
  variant = 'default',
  icon,
  subtitle,
  footer,
}: ModalProps) {
  const isPanel = variant === 'panel'
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
            initial={reduced ? false : modalIn.initial}
            animate={modalIn.animate}
            exit={reduced ? undefined : modalIn.exit}
            transition={modalIn.transition}
            style={{
              width: '100%',
              maxWidth,
              maxHeight: isPanel ? 'min(86vh, calc(100dvh - 48px))' : 'calc(100dvh - 48px)',
              overflowY: isPanel ? 'hidden' : 'auto',
              display: isPanel ? 'flex' : undefined,
              flexDirection: isPanel ? 'column' : undefined,
              background: 'var(--surface-card)',
              border: '0.5px solid var(--border-hover)',
              borderRadius: isPanel ? 'var(--r-lg)' : 'var(--r-xl)',
              padding: isPanel ? 0 : 20,
            }}
          >
            {isPanel ? (
              <div
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '16px 18px',
                  borderBottom: '0.5px solid var(--border-default)',
                }}
              >
                {icon && (
                  <span style={{ color: 'var(--uc-orange-l)', lineHeight: 0, marginTop: 3, flexShrink: 0 }}>{icon}</span>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>{title}</h2>
                  {subtitle && (
                    <p style={{ margin: '2px 0 0', fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>{subtitle}</p>
                  )}
                </div>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="press-feedback"
                  style={{
                    flexShrink: 0,
                    width: 28,
                    height: 28,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'none',
                    border: 'none',
                    borderRadius: 'var(--r-sm)',
                    cursor: 'pointer',
                    color: 'var(--text-tertiary)',
                  }}
                >
                  <X size={15} strokeWidth={1.5} />
                </button>
              </div>
            ) : (
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
            {isPanel ? (
              <div
                className="rail-scroll"
                style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}
              >
                {children}
              </div>
            ) : (
              children
            )}
            {isPanel && footer && (
              <div
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 18px',
                  borderTop: '0.5px solid var(--border-default)',
                  background: 'var(--surface-card)',
                }}
              >
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
