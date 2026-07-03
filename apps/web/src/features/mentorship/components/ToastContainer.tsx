import type { ToastItem } from '../types'

export function ToastContainer({ toasts }: { toasts: ToastItem[] }) {
  if (toasts.length === 0) return null
  return (
    <div
      style={{
        position: 'fixed',
        top: 20,
        right: 20,
        zIndex: 'var(--z-toast)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            padding: '10px 16px',
            background:
              t.type === 'error'
                ? 'var(--uc-red)'
                : t.type === 'info'
                  ? 'var(--uc-indigo)'
                  : 'var(--uc-mint)',
            color: 'var(--text-primary)',
            borderRadius: 'var(--r-md)',
            fontSize: 13,
            fontWeight: 500,
            maxWidth: 340,
            lineHeight: 1.4,
          }}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
