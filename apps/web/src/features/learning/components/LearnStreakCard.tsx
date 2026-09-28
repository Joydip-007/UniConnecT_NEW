import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { PATHS } from '@/router/paths'
import { useAuthStore } from '@/stores/authStore'
import { useBadgeProgress, useLearningStats } from '../hooks/useLearning'
import { buildBadgeCards, earnedStack, type BadgeCard } from '../badgeLadders'
import { StreakBanner } from './StreakBanner'

function badgesHref(card?: BadgeCard) {
  const params = new URLSearchParams({ view: 'badges' })
  if (card) {
    params.set('cat', card.category)
    params.set('badge', card.key)
  }
  return `${PATHS.LEARN}?${params.toString()}`
}

/**
 * The streak card with its earned-badges row. It owns its queries so it can sit in the
 * Learn right rail and, on narrower screens where the rail is hidden, in the centre column.
 * Badges are a student surface in the design, so other roles get the streak alone.
 */
export function LearnStreakCard({ variant = 'rail' }: { variant?: 'rail' | 'compact' }) {
  const navigate = useNavigate()
  const isStudent = useAuthStore((s) => s.user?.role) === 'student'
  const { data: stats, isLoading } = useLearningStats()
  const { data: progress } = useBadgeProgress(isStudent)
  const earned = useMemo(() => (progress ? earnedStack(buildBadgeCards(progress)) : null), [progress])

  if (isLoading) {
    return (
      <div
        style={{
          height: variant === 'compact' ? 96 : 150,
          borderRadius: 'var(--r-lg)',
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          flexShrink: 0,
        }}
      />
    )
  }
  if (!stats) return null

  return (
    <StreakBanner
      stats={stats}
      variant={variant}
      earned={isStudent ? earned ?? [] : null}
      onOpenBadges={(card) => {
        navigate(badgesHref(card))
        document.scrollingElement?.scrollTo?.({ top: 0 })
      }}
    />
  )
}
