import type { CSSProperties } from 'react'

/** Non-component exports for the admin Learning screen, split out so the component file stays Fast-Refresh clean. */

export const cardStyle: CSSProperties = {
  background: 'var(--surface-card)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-lg)',
}

export const fieldLabelStyle: CSSProperties = { fontSize: 12, fontWeight: 500, color: 'var(--text-label)' }

export const inputStyle: CSSProperties = {
  fontSize: 14,
  color: 'var(--text-primary)',
  background: 'var(--surface-raised)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-md)',
  padding: '10px 12px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

/** The 40px modal input from the design's AI dialogs. */
export const modalInputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  height: 40,
  background: 'var(--surface-raised)',
  border: '0.5px solid var(--border-hover)',
  borderRadius: 'var(--r-sm)',
  padding: '0 12px',
  fontSize: 13,
  color: 'var(--text-primary)',
  fontFamily: 'inherit',
}

export const modalTextareaStyle: CSSProperties = {
  ...modalInputStyle,
  height: 'auto',
  minHeight: 72,
  resize: 'vertical',
  padding: '10px 12px',
  lineHeight: 1.6,
}

export const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const
export type Difficulty = (typeof DIFFICULTIES)[number]
export const capitalise = (s: string) => (s.length ? s[0].toUpperCase() + s.slice(1) : s)
