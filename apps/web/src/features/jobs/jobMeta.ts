import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import type { ApplicationStatus } from '@uniconnect/shared'

export type JobType = 'full_time' | 'part_time' | 'internship' | 'remote' | 'contract'

export const TYPE_LABELS: Record<JobType, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  internship: 'Internship',
  remote: 'Remote',
  contract: 'Contract',
}

const LOGO_PALETTE = [
  { bg: 'var(--uc-indigo-bg)', border: 'var(--uc-indigo-bdr)', color: 'var(--uc-indigo-l)' },
  { bg: 'var(--uc-orange-bg)', border: 'var(--uc-orange-bdr)', color: 'var(--uc-orange-l)' },
  { bg: 'var(--uc-mint-bg)', border: 'var(--uc-mint-bdr)', color: 'var(--uc-mint)' },
  { bg: 'var(--uc-cyan-bg)', border: 'var(--uc-cyan-bdr)', color: 'var(--uc-cyan)' },
]

/** A stable tint per company, so the same employer always reads the same colour. */
export function seedLogoStyle(company: string) {
  const sum = [...company].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return LOGO_PALETTE[sum % LOGO_PALETTE.length]
}

export interface Tone {
  label: string
  bg: string
  fg: string
  bdr: string
}

export const STATUS_TONES: Record<ApplicationStatus, Tone> = {
  pending: { label: 'Pending', bg: 'var(--surface-raised)', fg: 'var(--text-secondary)', bdr: 'var(--border-default)' },
  reviewed: { label: 'Reviewed', bg: 'var(--uc-indigo-bg)', fg: 'var(--uc-indigo-l)', bdr: 'var(--uc-indigo-bdr)' },
  shortlisted: { label: 'Shortlisted', bg: 'var(--uc-cyan-bg)', fg: 'var(--uc-cyan)', bdr: 'var(--uc-cyan-bdr)' },
  interviewed: { label: 'Interviewed', bg: 'var(--uc-orange-bg)', fg: 'var(--uc-orange-l)', bdr: 'var(--uc-orange-bdr)' },
  offered: { label: 'Offered', bg: 'var(--uc-mint-bg)', fg: 'var(--uc-mint)', bdr: 'var(--uc-mint-bdr)' },
  rejected: { label: 'Rejected', bg: 'var(--uc-red-bg)', fg: 'var(--uc-red)', bdr: 'var(--uc-red-bdr)' },
  withdrawn: { label: 'Withdrawn', bg: 'var(--surface-raised)', fg: 'var(--text-tertiary)', bdr: 'var(--border-default)' },
}

export function statusTone(status: string | null | undefined): Tone {
  return STATUS_TONES[(status ?? 'pending') as ApplicationStatus] ?? STATUS_TONES.pending
}

export function daysUntil(deadline: string): number {
  return differenceInCalendarDays(parseISO(deadline), new Date())
}

/** Deadline chip tone: red inside 3 days, orange inside a week, plain otherwise. */
export function deadlineTone(deadline: string | null) {
  if (!deadline) return { label: 'No deadline', fg: 'var(--text-tertiary)', bg: 'transparent', bdr: 'transparent', boxed: false }
  const days = daysUntil(deadline)
  const label = days < 0 ? 'Expired' : `Closes ${format(parseISO(deadline), 'MMM d')}`
  if (days >= 0 && days < 3) return { label, fg: 'var(--uc-red)', bg: 'var(--uc-red-bg)', bdr: 'var(--uc-red-bdr)', boxed: true }
  if (days >= 0 && days < 7) return { label, fg: 'var(--uc-orange-l)', bg: 'var(--uc-orange-bg)', bdr: 'var(--uc-orange-bdr)', boxed: true }
  return { label, fg: 'var(--text-tertiary)', bg: 'transparent', bdr: 'transparent', boxed: false }
}

export function daysLeftLabel(deadline: string): string {
  const d = daysUntil(deadline)
  if (d <= 0) return 'Closes today'
  return d === 1 ? '1 day left' : `${d} days left`
}

/** "Tue, Sep 29 at 9:00 AM" in the viewer's zone — the publish-time phrasing the design uses. */
export function formatWhen(date: Date): string {
  return `${format(date, 'EEE, MMM d')} at ${format(date, 'h:mm a')}`
}
