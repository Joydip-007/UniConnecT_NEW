import { describe, expect, it } from 'vitest'
import { buildPathFilters, isPathFilterKey, matchesPathFilter, pathStatus } from './pathFilters'
import type { LearningPath } from './types'

function makePath(id: string, myEnrollmentStatus: LearningPath['myEnrollmentStatus']): LearningPath {
  return {
    id,
    title: id,
    description: null,
    category: 'technical',
    difficulty: 'beginner',
    estimated_days: 7,
    badge_name: null,
    badge_icon: null,
    unitCount: 3,
    enrolledCount: 0,
    myEnrollmentStatus,
    completedUnitCount: 0,
    nextUnitTitle: null,
  }
}

const paths = [
  makePath('a', 'active'),
  makePath('b', 'active'),
  makePath('c', 'completed'),
  makePath('d', 'abandoned'),
  makePath('e', null),
]

describe('pathStatus', () => {
  it('maps enrollments onto the four statuses', () => {
    expect(pathStatus('active')).toBe('active')
    expect(pathStatus('completed')).toBe('completed')
    expect(pathStatus('abandoned')).toBe('dropped')
    expect(pathStatus(null)).toBe('new')
  })
})

describe('buildPathFilters', () => {
  it('always renders every status chip, counted against the whole catalogue', () => {
    expect(buildPathFilters(paths).map((f) => `${f.label} · ${f.count}`)).toEqual([
      'All · 5',
      'In progress · 2',
      'Not started · 1',
      'Completed · 1',
      'Dropped · 1',
    ])
  })

  it('keeps zero-count chips so the row never reflows', () => {
    const filters = buildPathFilters([makePath('x', null)])
    expect(filters.find((f) => f.key === 'dropped')?.count).toBe(0)
    expect(filters).toHaveLength(5)
  })
})

describe('matchesPathFilter', () => {
  it('matches a dropped path only under Dropped and All', () => {
    const dropped = makePath('d', 'abandoned')
    expect(matchesPathFilter(dropped, 'all')).toBe(true)
    expect(matchesPathFilter(dropped, 'dropped')).toBe(true)
    expect(matchesPathFilter(dropped, 'new')).toBe(false)
  })
})

describe('isPathFilterKey', () => {
  it('rejects a stale or hand-edited URL value', () => {
    expect(isPathFilterKey('active')).toBe(true)
    expect(isPathFilterKey('category:career')).toBe(false)
    expect(isPathFilterKey(null)).toBe(false)
  })
})
