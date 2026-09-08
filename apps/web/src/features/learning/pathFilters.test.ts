import { describe, expect, it } from 'vitest'
import { buildPathFilters, defaultFilterKey } from './pathFilters'
import type { LearningPath } from './types'

function path(overrides: Partial<LearningPath>): LearningPath {
  return {
    id: 'p',
    title: 'Path',
    description: null,
    category: 'career',
    difficulty: 'beginner',
    estimated_days: 5,
    badge_name: null,
    badge_icon: null,
    unitCount: 4,
    enrolledCount: 0,
    myEnrollmentStatus: null,
    completedUnitCount: 0,
    nextUnitTitle: null,
    ...overrides,
  }
}

describe('buildPathFilters', () => {
  it('omits "My paths" when nothing is enrolled', () => {
    const filters = buildPathFilters([path({ id: 'a' })])
    expect(filters.map((f) => f.key)).not.toContain('mine')
    expect(filters[0].key).toBe('all')
  })

  it('counts enrolled paths of any status under "My paths"', () => {
    const filters = buildPathFilters([
      path({ id: 'a', myEnrollmentStatus: 'active' }),
      path({ id: 'b', myEnrollmentStatus: 'completed' }),
      path({ id: 'c' }),
    ])
    const mine = filters.find((f) => f.key === 'mine')
    expect(mine?.count).toBe(2)
    expect(filters.find((f) => f.key === 'all')?.count).toBe(3)
  })

  it('only emits facets that occur in the catalogue', () => {
    const filters = buildPathFilters([
      path({ id: 'a', difficulty: 'beginner', category: 'career' }),
      path({ id: 'b', difficulty: 'advanced', category: 'technical' }),
    ])
    const keys = filters.map((f) => f.key)
    expect(keys).toContain('difficulty:beginner')
    expect(keys).toContain('difficulty:advanced')
    expect(keys).not.toContain('difficulty:intermediate')
    expect(keys).toContain('category:career')
    expect(keys).toContain('category:technical')
  })

  it('orders difficulties by level rather than alphabetically', () => {
    const filters = buildPathFilters([
      path({ id: 'a', difficulty: 'advanced' }),
      path({ id: 'b', difficulty: 'beginner' }),
      path({ id: 'c', difficulty: 'intermediate' }),
    ])
    const difficulties = filters.filter((f) => f.key.startsWith('difficulty:')).map((f) => f.label)
    expect(difficulties).toEqual(['Beginner', 'Intermediate', 'Advanced'])
  })

  it('counts each facet against the whole catalogue, not the selection', () => {
    const paths = [
      path({ id: 'a', difficulty: 'beginner' }),
      path({ id: 'b', difficulty: 'beginner' }),
      path({ id: 'c', difficulty: 'advanced' }),
    ]
    const beginner = buildPathFilters(paths).find((f) => f.key === 'difficulty:beginner')
    expect(beginner?.count).toBe(2)
    expect(paths.filter((p) => beginner!.matches(p))).toHaveLength(2)
  })
})

describe('defaultFilterKey', () => {
  it('opens on your own paths when you have any', () => {
    expect(defaultFilterKey(buildPathFilters([path({ myEnrollmentStatus: 'active' })]))).toBe('mine')
  })

  it('falls back to the full catalogue when you have none', () => {
    expect(defaultFilterKey(buildPathFilters([path({})]))).toBe('all')
  })
})
