import { motion, useReducedMotion } from 'framer-motion'
import { DUR, EASE_OUT_EXPO } from '@/lib/motion'

/** One-time subtle celebration shown at the end of the feed once there are no
    more pages to load and at least one post is visible. Never loops. */
export function CaughtUpFooter() {
  const reduced = useReducedMotion()

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DUR.slow, ease: EASE_OUT_EXPO }}
      style={{ textAlign: 'center', padding: '28px 0 8px' }}
    >
      <div aria-hidden="true" style={{ fontSize: 20, lineHeight: 1, color: 'var(--uc-mint)' }}>
        ✓
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginTop: 8 }}>
        You're all caught up
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
        You've seen every new post from your campus
      </div>
    </motion.div>
  )
}
