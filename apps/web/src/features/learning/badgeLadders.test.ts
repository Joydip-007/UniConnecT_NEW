import { describe, expect, it } from 'vitest'
import { badgeSummary, buildBadgeCards, buildBadgeFilters, earnedStack } from './badgeLadders'
import type { BadgeProgress } from './types'

function badge(over: Partial<BadgeProgress> & Pick<BadgeProgress, 'id' | 'name' | 'triggerType' | 'target'>): BadgeProgress {
  return {
    description: null,
    iconUrl: null,
    skillPathId: null,
    pathTitle: null,
    current: 0,
    earned: false,
    awardedAt: null,
    pinned: false,
    pinnedAt: null,
    heldByPct: 10,
    ...over,
  }
}

const streaks = [
  badge({ id: 's7', name: 'Week one', triggerType: 'streak_milestone', target: 7, current: 12, earned: true, description: 'Kept a 7-day learning streak', heldByPct: 34 }),
  badge({ id: 's30', name: 'Scholar', triggerType: 'streak_milestone', target: 30, current: 12, description: 'Kept a 30-day learning streak' }),
  badge({ id: 's100', name: 'Centurion', triggerType: 'streak_milestone', target: 100, current: 12, description: 'Kept a 100-day learning streak' }),
]
const pathBadge = badge({
  id: 'p1', name: 'Merge master', triggerType: 'path_completed', target: 5, current: 5, earned: true, skillPathId: 'path-git', pathTitle: 'Git for group projects', pinned: true, heldByPct: 19,
})
const lockedPath = badge({ id: 'p2', name: 'Algorithmist', triggerType: 'path_completed', target: 8, current: 5, skillPathId: 'path-algo', pathTitle: 'Algorithms, properly' })

describe('buildBadgeCards', () => {
  it('folds threshold badges into one tiered ladder aimed at the next rung', () => {
    const [card] = buildBadgeCards(streaks)
    expect(card).toMatchObject({
      name: 'Week one',
      tierLabel: 'Tier I',
      hasNext: true,
      criteria: 'Kept a 30-day learning streak',
      progressLabel: '12 / 30 days · next tier',
      progressPct: 40,
      pinBadgeId: 's7',
    })
  })

  it('shows a single-step path badge as earned with its rarity and no next tier', () => {
    const card = buildBadgeCards([pathBadge]).find((c) => c.key === 'path:path-git')
    expect(card).toMatchObject({ tierLabel: 'Earned', hasNext: false, pinned: true, heldByPct: 19 })
  })

  it('describes a locked path badge by its path when the badge has no description', () => {
    const card = buildBadgeCards([lockedPath])[0]
    expect(card).toMatchObject({ earned: false, tierLabel: 'Locked', criteria: 'Finish Algorithms, properly', progressLabel: '5 / 8 units', pinBadgeId: null })
  })
})

describe('filters, summary and stack', () => {
  const cards = buildBadgeCards([...streaks, pathBadge, lockedPath])

  it('only offers categories that have badges, with earned/total counts', () => {
    expect(buildBadgeFilters(cards).map((f) => f.label)).toEqual(['All · 2/3', 'Streaks · 1/1', 'Paths · 1/2'])
  })

  it('summarises earned and pinned counts against the pin cap', () => {
    expect(badgeSummary(cards)).toBe('2 of 3 earned · 1 of 3 pinned to your profile')
  })

  it('stacks pinned badges ahead of the rest', () => {
    expect(earnedStack(cards).map((c) => c.name)).toEqual(['Merge master', 'Week one'])
  })
})
