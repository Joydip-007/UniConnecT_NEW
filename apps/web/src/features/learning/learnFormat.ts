import type { CSSProperties } from 'react'
import type { LearningPath } from './types'

type PillVariant = 'primary' | 'outline' | 'disabled'

export function pillButton(variant: PillVariant, minHeight = 36): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '0 16px',
    minHeight,
    borderRadius: 'var(--r-pill)',
    fontSize: 13,
    fontWeight: 500,
    cursor: variant === 'disabled' ? 'not-allowed' : 'pointer',
    ...(variant === 'primary'
      ? { background: 'var(--uc-orange)', color: 'var(--on-accent)', border: 'none' }
      : variant === 'disabled'
        ? { background: 'var(--surface-card)', color: 'var(--text-tertiary)', border: '0.5px solid var(--border-default)' }
        : { background: 'transparent', color: 'var(--text-secondary)', border: '0.5px solid var(--border-default)' }),
  }
}

/** Text-only action: "Past results · 2", "See all". */
export const linkButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  background: 'none',
  border: 'none',
  padding: 0,
  fontSize: 13,
  color: 'var(--text-secondary)',
  cursor: 'pointer',
}

/** Unit kind line: "Video · 8 min", "Reading · 7 min", "Quiz · 2 questions". */
export function unitKindLabel(unit: { type: string; minutes?: number | null; questionCount?: number }) {
  if (unit.type === 'quiz') {
    const n = unit.questionCount ?? 0
    return `Quiz · ${n} ${n === 1 ? 'question' : 'questions'}`
  }
  const kind = unit.type === 'video' ? 'Video' : unit.type === 'exercise' ? 'Exercise' : 'Reading'
  return unit.minutes ? `${kind} · ${unit.minutes} min` : kind
}

export function plural(n: number, noun: string) {
  return `${n} ${noun}${n === 1 ? '' : 's'}`
}

/** "18 Sep · 9:12 pm", or "Today · 9:12 pm". */
export function attemptDate(iso: string, now = new Date()) {
  const d = new Date(iso)
  const time = d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()
  const sameDay = d.toDateString() === now.toDateString()
  const day = sameDay ? 'Today' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return `${day} · ${time}`
}

export function pathMeta(path: Pick<LearningPath, 'unitCount' | 'estimated_days' | 'difficulty'>) {
  return `${path.unitCount} units · ~${path.estimated_days} days · ${path.difficulty}`
}
