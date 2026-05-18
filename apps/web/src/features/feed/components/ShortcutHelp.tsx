import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'

interface Props {
  open: boolean
  onClose: () => void
}

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const SHORTCUTS: Array<{ keys: string[]; label: string }> = [
  { keys: ['j'], label: 'Next post' },
  { keys: ['k'], label: 'Previous post' },
  { keys: ['c'], label: 'Compose a post' },
  { keys: ['1', '2', '3', '4'], label: 'Switch filter tab' },
  { keys: ['?'], label: 'Toggle this cheatsheet' },
  { keys: ['Esc'], label: 'Close cheatsheet' },
]

export function ShortcutHelp({ open, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.requestAnimationFrame(() => closeButtonRef.current?.focus())
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [],
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKeyDown)
      if (previousFocusRef.current && document.contains(previousFocusRef.current)) {
        previousFocusRef.current.focus()
      }
    }
  }, [onClose, open])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        background: 'var(--overlay-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 360,
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: 18,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
            Keyboard shortcuts
          </span>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              padding: 2,
              lineHeight: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>

        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SHORTCUTS.map((s) => (
            <li
              key={s.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{s.label}</span>
              <span style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 22,
                      height: 22,
                      padding: '0 6px',
                      background: 'var(--surface-raised)',
                      border: '0.5px solid var(--border-default)',
                      borderRadius: 'var(--r-sm)',
                      fontSize: 11,
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                      fontFamily: 'inherit',
                    }}
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>

        <p
          style={{
            margin: '14px 0 0',
            fontSize: 11,
            color: 'var(--text-tertiary)',
            lineHeight: 1.5,
          }}
        >
          Shortcuts pause while you're typing.
        </p>
      </div>
    </div>
  )
}
