import { motion, useScroll } from 'framer-motion'

export function ScrollProgressBar() {
  const { scrollYProgress } = useScroll()

  return (
    <motion.div
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        zIndex: 60,
        background: 'linear-gradient(90deg, var(--uc-indigo), var(--uc-orange))',
        transformOrigin: '0 50%',
        scaleX: scrollYProgress,
        pointerEvents: 'none',
      }}
    />
  )
}
