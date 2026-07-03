import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useToastStore } from '@/stores/toastStore'
import { DUR, EASE_OUT_EXPO } from '@/lib/motion'

const typeColor = {
  success: 'var(--uc-mint)',
  error: 'var(--uc-red)',
  info: 'var(--uc-indigo-l)',
} as const

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)
  const reduced = useReducedMotion()

  return (
    <div
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 'var(--z-toast)' as unknown as number,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            role="status"
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, y: 12 }}
            transition={{ duration: DUR.med, ease: EASE_OUT_EXPO }}
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'var(--surface-raised)',
              border: '0.5px solid var(--border-hover)',
              borderRadius: 'var(--r-pill)',
              padding: '9px 16px',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--text-primary)',
            }}
          >
            <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: typeColor[t.type], flexShrink: 0 }} />
            {t.message}
            {t.onUndo && (
              <button
                onClick={() => {
                  t.onUndo?.()
                  dismiss(t.id)
                }}
                className="press-feedback"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--uc-indigo-l)',
                  padding: 0,
                }}
              >
                Undo
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
