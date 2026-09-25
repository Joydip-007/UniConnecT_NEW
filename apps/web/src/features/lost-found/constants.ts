import { formatDistanceToNow, parseISO } from 'date-fns'
import type { FocusEvent } from 'react'
import type { FilterTab } from './types'

export const FILTER_TABS: { label: string; value: FilterTab; hint: string; empty: string }[] = [
  { label: 'All', value: 'all', hint: 'Open lost reports and found items, newest first', empty: 'Be the first to report a lost or found item.' },
  { label: 'Lost', value: 'lost', hint: 'Posted by people who lost something', empty: 'No open lost reports. Nothing is missing right now.' },
  { label: 'Found', value: 'found', hint: 'Posted by people who found something and want to return it', empty: 'Nobody has posted a found item yet.' },
  { label: 'Resolved', value: 'resolved', hint: 'Items already returned to their owner', empty: 'Nothing has been marked resolved yet.' },
]

/** Lost reads red, found reads mint — the two sides of the board at a glance. */
export const TYPE_TONES = {
  lost: { label: 'Lost', bg: 'var(--uc-red-bg)', bdr: 'var(--uc-red-bdr)', fg: 'var(--uc-red)' },
  found: { label: 'Found', bg: 'var(--uc-mint-bg)', bdr: 'var(--uc-mint-bdr)', fg: 'var(--uc-mint)' },
} as const

export const AVATAR_PALETTE = [
  'var(--uc-indigo)',
  'var(--uc-orange)',
  'var(--uc-cyan)',
  'var(--uc-mint)',
  'var(--uc-navy)',
]

export const MAX_IMAGES = 3
export const MAX_IMG_BYTES = 5 * 1024 * 1024

export function focusBorder(e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = 'var(--uc-indigo-bdr)'
}

export function blurBorder(e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = 'var(--border-default)'
}

export function seedColor(id: string): string {
  let hash = 0
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true })
  } catch {
    return iso
  }
}
