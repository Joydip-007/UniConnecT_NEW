import { formatDistanceToNow, parseISO } from 'date-fns'

// ── Avatar ─────────────────────────────────────────────────────────────────────

export const AVATAR_COLORS = [
  'var(--uc-indigo)',
  'var(--uc-orange)',
  'var(--uc-cyan)',
  'var(--uc-mint)',
  'var(--uc-navy)',
] as const

export function seedColor(seed: string): string {
  const sum = [...seed].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_COLORS[sum % AVATAR_COLORS.length]
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

// ── Time formatting ────────────────────────────────────────────────────────────

export function relativeTime(iso: string): string {
  const raw = formatDistanceToNow(parseISO(iso), { addSuffix: false })
    .replace('about ', '')
    .replace('less than a ', '<1 ')
    .replace('almost ', '')
    .replace('over ', '')

  // minutes / hours / days — collapse plural
  if (raw.includes('minute')) return raw.replace(/ minutes?/, 'm')
  if (raw.includes('hour')) return raw.replace(/ hours?/, 'h')
  if (raw.includes('day')) return raw.replace(/ days?/, 'd')
  if (raw.includes('month')) return raw.replace(/ months?/, 'mo')
  if (raw.includes('year')) return raw.replace(/ years?/, 'y')
  // catch-all for "<1 minute" or unknown date-fns output
  return raw
}
