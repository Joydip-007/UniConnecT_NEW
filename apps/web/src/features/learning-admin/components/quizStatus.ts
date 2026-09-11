import type { AdminQuiz, AdminQuizStatus } from '@uniconnect/shared'

export const QUIZ_STATUS: Record<AdminQuizStatus, { label: string; color: string; bg: string; bdr: string }> = {
  published: { label: 'Published', color: 'var(--uc-mint)', bg: 'var(--uc-mint-bg)', bdr: 'var(--uc-mint-bdr)' },
  draft: { label: 'Draft', color: 'var(--text-secondary)', bg: 'var(--surface-raised)', bdr: 'var(--border-default)' },
  needs_review: { label: 'Needs review', color: 'var(--uc-amber-l)', bg: 'var(--uc-amber-bg)', bdr: 'var(--uc-amber-bdr)' },
  scheduled: { label: 'Scheduled', color: 'var(--uc-cyan)', bg: 'var(--uc-cyan-bg)', bdr: 'var(--uc-cyan-bdr)' },
}

export const quizSourceLabel = (q: AdminQuiz) =>
  q.source === 'staff' ? 'Written by staff' : q.status === 'needs_review' ? 'AI draft, unreviewed' : 'AI draft, edited'
