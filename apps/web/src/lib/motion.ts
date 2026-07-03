/* Shared framer-motion presets. Every popover/modal/drawer imports these —
   never inline transition objects (spec §7.1). Durations mirror the CSS
   --dur-* tokens (seconds here because framer uses seconds). */

export const DUR = { fast: 0.15, med: 0.2, slow: 0.3 } as const

export const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1]
export const EASE_DRAWER: [number, number, number, number] = [0.32, 0.72, 0, 1]

interface Preset {
  initial: Record<string, string | number>
  animate: Record<string, string | number>
  exit: Record<string, string | number>
  transition: { duration: number; ease: [number, number, number, number] }
  /** Exits run ~25% faster than entrances. Spread onto exit via the
      `transition` prop of AnimatePresence children when needed. */
  exitTransition: { duration: number; ease: [number, number, number, number] }
}

function preset(
  initial: Preset['initial'],
  animate: Preset['animate'],
  exit: Preset['exit'],
  duration: number,
  ease: [number, number, number, number],
): Preset {
  return {
    initial,
    animate,
    exit,
    transition: { duration, ease },
    exitTransition: { duration: duration * 0.75, ease },
  }
}

export const popoverIn = preset(
  { opacity: 0, scale: 0.96, y: -4 },
  { opacity: 1, scale: 1, y: 0 },
  { opacity: 0, scale: 0.96, y: -4 },
  DUR.med,
  EASE_OUT_EXPO,
)

export const modalIn = preset(
  { opacity: 0, scale: 0.96 },
  { opacity: 1, scale: 1 },
  { opacity: 0, scale: 0.96 },
  DUR.med,
  EASE_OUT_EXPO,
)

export const drawerIn = preset(
  { y: '100%' },
  { y: 0 },
  { y: '100%' },
  DUR.slow,
  EASE_DRAWER,
)

export const overlayIn = preset(
  { opacity: 0 },
  { opacity: 1 },
  { opacity: 0 },
  DUR.med,
  EASE_OUT_EXPO,
)

export function listStagger(delayMs = 35) {
  return {
    initial: {},
    animate: { transition: { staggerChildren: delayMs / 1000 } },
  }
}

export const listItem = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: DUR.med, ease: EASE_OUT_EXPO } },
}
