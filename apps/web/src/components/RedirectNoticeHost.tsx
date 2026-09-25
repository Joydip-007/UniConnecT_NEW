import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Lock, X } from 'lucide-react'
import { useRedirectNoticeStore } from '@/stores/redirectNoticeStore'
import { DUR, EASE_OUT_EXPO } from '@/lib/motion'

/** Bottom-centre pill explaining a guard redirect. Mounted once, beside the Toaster. */
export function RedirectNoticeHost() {
  const notice = useRedirectNoticeStore((s) => s.notice)
  const dismiss = useRedirectNoticeStore((s) => s.dismiss)
  const reduced = useReducedMotion()

  return (
    <div className="redirect-notice-host" aria-live="polite">
      <AnimatePresence>
        {notice && (
          <motion.div
            key={notice.id}
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
              maxWidth: '100%',
              boxSizing: 'border-box',
              padding: '10px 12px 10px 16px',
              background: 'var(--surface-card)',
              border: '0.5px solid var(--border-hover)',
              borderRadius: 'var(--r-pill)',
            }}
          >
            <Lock size={15} strokeWidth={1.5} aria-hidden="true" style={{ color: 'var(--uc-indigo-l)', flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{notice.message}</span>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={dismiss}
              className="row-hover-bg"
              style={{
                width: 28,
                height: 28,
                flexShrink: 0,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: 'none',
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
              }}
            >
              <X size={14} strokeWidth={1.5} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
