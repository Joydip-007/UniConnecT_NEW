export const controlButton = {
  minHeight: 44,
  padding: '8px 14px',
  borderRadius: 'var(--r-pill)',
  border: '0.5px solid var(--border-default)',
  background: 'var(--surface-raised)',
  color: 'var(--text-secondary)',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
  transitionProperty: 'background-color, color, border-color, transform',
  transitionDuration: '150ms',
} as const

export const iconButton = {
  minWidth: 44,
  minHeight: 44,
  borderRadius: 'var(--r-pill)',
  border: '0.5px solid var(--border-default)',
  background: 'var(--surface-raised)',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  transitionProperty: 'background-color, color, border-color, transform',
  transitionDuration: '150ms',
} as const

export const fieldStyle = {
  minHeight: 44,
  width: '100%',
  padding: '9px 12px',
  borderRadius: 'var(--r-sm)',
  border: '0.5px solid var(--border-default)',
  background: 'var(--surface-raised)',
  color: 'var(--text-primary)',
  fontSize: 13,
  fontWeight: 400,
  outline: 'none',
  boxSizing: 'border-box',
} as const

export const listSurface = {
  background: 'var(--surface-card)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-sm)',
  overflow: 'hidden',
} as const

export function formatDisplayDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Updated recently'
  return `Updated ${new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)}`
}

export function shortPreview(value: string, maxLength = 140) {
  const compact = value.replace(/\s+/g, ' ').trim()
  return compact.length > maxLength ? `${compact.slice(0, maxLength - 1).trim()}...` : compact
}
