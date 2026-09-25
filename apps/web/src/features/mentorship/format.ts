import type { AlumniMentor } from './types'

const DAY_MS = 24 * 60 * 60 * 1000

/** Mirrors the API's `REQUEST_EXPIRY_MS` — a pending request expires after 7 days. */
export const REQUEST_EXPIRY_DAYS = 7
export const POINTS_PER_SESSION = 10
export const POINTS_PER_USD = 100

/** Date-only strings ('YYYY-MM-DD') are calendar days — parse them as UTC so no TZ shifts a day. */
function toDate(value: string | Date): Date {
  if (value instanceof Date) return value
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : new Date(value)
}

function isDateOnly(value: string | Date) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

/** "Sep 18" — with the year only when it is not this year ("Dec 2, 2025"). */
export function shortDate(value: string | Date): string {
  const d = toDate(value)
  const timeZone = isDateOnly(value) ? 'UTC' : undefined
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone,
  })
}

export function todayIso(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** "2h 15m", or "45m" under an hour. */
export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

/** "Today" / "1 day" / "7 days" since a date-only string. */
export function daysSince(dateOnly: string | null): string {
  if (!dateOnly) return 'No sessions yet'
  const days = Math.max(0, Math.floor((Date.now() - toDate(dateOnly).getTime()) / DAY_MS))
  if (days === 0) return 'Today'
  return days === 1 ? '1 day' : `${days} days`
}

/** "2 days ago" / "5 hours ago" / "just now". */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(diff / (60 * 60 * 1000))
  if (hours < 1) return 'just now'
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? '1 day ago' : `${days} days ago`
}

/** "Expires in 5 days" for a pending request, from when it was sent. */
export function expiresIn(createdAt: string): string {
  const left = new Date(createdAt).getTime() + REQUEST_EXPIRY_DAYS * DAY_MS - Date.now()
  if (left <= 0) return 'Expiring now'
  const days = Math.floor(left / DAY_MS)
  if (days >= 1) return days === 1 ? 'Expires in 1 day' : `Expires in ${days} days`
  const hours = Math.max(1, Math.floor(left / (60 * 60 * 1000)))
  return hours === 1 ? 'Expires in 1 hour' : `Expires in ${hours} hours`
}

/** "replies within a day" / "replies in about 2 days" — null for a mentor with no history. */
export function replyText(avgHours: number | null): string | null {
  if (avgHours === null) return null
  if (avgHours <= 24) return 'replies within a day'
  const days = Math.round(avgHours / 24)
  return `replies in about ${days} days`
}

/** "CSE · 2026", skipping whichever half is missing. */
export function deptBatch(department: string | null, batchYear: string | null): string {
  return [department, batchYear].filter(Boolean).join(' · ')
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

/** A mentor's tags: their mentoring topics, or their first profile skills until they set some. */
export function mentorTags(m: AlumniMentor): string[] {
  return m.topics.length > 0 ? m.topics : m.skills.slice(0, 3)
}
