import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'

interface Props {
  open: boolean
  onClose: () => void
}

const SHORTCUTS: Array<{ keys: string[]; label: string }> = [
  { keys: ['j'], label: 'Next post' },
  { keys: ['k'], label: 'Previous post' },
  { keys: ['c'], label: 'Compose a post' },
  { keys: ['?'], label: 'Toggle this cheatsheet' },
  { keys: ['Esc'], label: 'Close cheatsheet' },
]

export function ShortcutHelp({ open, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialogEl = dialogRef.current
    if (!dialogEl) return
    if (open && !dialogEl.open) {
      dialogEl.showModal()
    } else if (!open && dialogEl.open) {
      dialogEl.close()
    }
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      aria-label="Keyboard shortcuts"
      onClose={onClose}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose()
      }}
      style={{
        padding: 0,
        border: 'none',
        background: 'transparent',
        maxWidth: 'none',
        maxHeight: 'none',
        margin: 'auto',
      }}
    >
      <div
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
                      fontSize: 12,
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
            fontSize: 12,
            color: 'var(--text-tertiary)',
            lineHeight: 1.5,
          }}
        >
          Shortcuts pause while you're typing.
        </p>
      </div>
    </dialog>
  )
}
