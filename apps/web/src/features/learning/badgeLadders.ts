import { Award, BookOpen, Flame, ListChecks, type LucideIcon } from 'lucide-react'
import { LEARNING } from '@uniconnect/shared'
import type { BadgeProgress, BadgeTrigger } from './types'

export type BadgeCategory = 'streaks' | 'paths' | 'units' | 'quizzes'
export type BadgeTone = 'amber' | 'indigo' | 'orange' | 'mint'

export const BADGE_CATEGORY_META: Record<BadgeCategory, { label: string; tone: BadgeTone; icon: LucideIcon; unit: string }> = {
  streaks: { label: 'Streaks', tone: 'amber', icon: Flame, unit: 'days' },
  paths: { label: 'Paths', tone: 'indigo', icon: Award, unit: 'units' },
  units: { label: 'Units', tone: 'orange', icon: BookOpen, unit: 'units' },
  quizzes: { label: 'Quizzes', tone: 'mint', icon: ListChecks, unit: 'quizzes' },
}

const CATEGORY_BY_TRIGGER: Record<BadgeTrigger, BadgeCategory> = {
  streak_milestone: 'streaks',
  path_completed: 'paths',
  unit_completed: 'units',
  quiz_win: 'quizzes',
}

const CATEGORY_ORDER: BadgeCategory[] = ['streaks', 'paths', 'units', 'quizzes']
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V']

/**
 * One card on the badges grid. Badges that share a trigger and differ only by threshold
 * (7/30/100-day streaks) are one ladder shown as tiers; a path badge is its own card.
 */
export interface BadgeCard {
  key: string
  category: BadgeCategory
  name: string
  criteria: string
  earned: boolean
  tierLabel: string
  hasNext: boolean
  current: number
  target: number
  progressPct: number
  progressLabel: string
  heldByPct: number
  pinned: boolean
  /** The badge a pin toggles: the highest tier earned. */
  pinBadgeId: string | null
  /** Every pinned badge in the ladder, so unpinning clears all of them. */
  pinnedIds: string[]
}

function ladderKey(b: BadgeProgress) {
  return b.triggerType === 'path_completed' ? `path:${b.skillPathId ?? b.id}` : b.triggerType
}

export function buildBadgeCards(badges: BadgeProgress[]): BadgeCard[] {
  const ladders = new Map<string, BadgeProgress[]>()
  for (const b of badges) ladders.set(ladderKey(b), [...(ladders.get(ladderKey(b)) ?? []), b])

  const cards = [...ladders.entries()].map(([key, rungs]) => {
    const steps = [...rungs].sort((a, b) => a.target - b.target)
    const category = CATEGORY_BY_TRIGGER[steps[0].triggerType]
    const unit = BADGE_CATEGORY_META[category].unit
    const earnedSteps = steps.filter((s) => s.earned)
    const top = earnedSteps[earnedSteps.length - 1] ?? null
    const next = steps.find((s) => !s.earned) ?? null
    const goal = next ?? steps[steps.length - 1]
    const earned = top !== null
    const hasNext = next !== null
    const current = goal.current
    const target = Math.max(goal.target, 0)
    const shown = Math.min(current, target)
    const pinnedIds = steps.filter((s) => s.pinned).map((s) => s.id)

    return {
      key,
      category,
      name: (top ?? steps[0]).name,
      criteria:
        goal.description ??
        (goal.pathTitle ? `Finish ${goal.pathTitle}` : `Reach ${target} ${unit}`),
      earned,
      tierLabel: earned ? (steps.length > 1 ? `Tier ${ROMAN[earnedSteps.length] ?? earnedSteps.length}` : 'Earned') : 'Locked',
      hasNext,
      current,
      target,
      progressPct: target > 0 ? Math.min(100, Math.round((100 * current) / target)) : 0,
      progressLabel: `${shown} / ${target} ${unit}${earned && hasNext ? ' · next tier' : ''}`,
      heldByPct: (top ?? goal).heldByPct,
      pinned: pinnedIds.length > 0,
      pinBadgeId: top?.id ?? null,
      pinnedIds,
    } satisfies BadgeCard
  })

  return cards.sort(
    (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || a.name.localeCompare(b.name),
  )
}

export type BadgeFilterKey = 'all' | BadgeCategory

export function buildBadgeFilters(cards: BadgeCard[]) {
  const present = CATEGORY_ORDER.filter((c) => cards.some((card) => card.category === c))
  return (['all', ...present] as BadgeFilterKey[]).map((key) => {
    const inCat = cards.filter((c) => key === 'all' || c.category === key)
    return {
      key,
      label: `${key === 'all' ? 'All' : BADGE_CATEGORY_META[key].label} · ${inCat.filter((c) => c.earned).length}/${inCat.length}`,
    }
  })
}

export function isBadgeFilterKey(value: string | null): value is BadgeFilterKey {
  return value === 'all' || CATEGORY_ORDER.includes(value as BadgeCategory)
}

export function badgeSummary(cards: BadgeCard[]) {
  const earned = cards.filter((c) => c.earned).length
  const pinned = cards.filter((c) => c.pinned).length
  return `${earned} of ${cards.length} earned · ${pinned} of ${LEARNING.MAX_PINNED_BADGES} pinned to your profile`
}

/** Earned cards for the streak card's overlapping stack: pinned first, then the rest. */
export function earnedStack(cards: BadgeCard[]) {
  const earned = cards.filter((c) => c.earned)
  return [...earned.filter((c) => c.pinned), ...earned.filter((c) => !c.pinned)]
}
