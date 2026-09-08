import type { LearningPath } from './types'

export interface PathFilter {
  key: string
  label: string
  count: number
  matches: (path: LearningPath) => boolean
}

const DIFFICULTY_ORDER: LearningPath['difficulty'][] = ['beginner', 'intermediate', 'advanced']

function sentenceCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}

/**
 * The chip row over the paths grid. "My paths" and "All" are always the first two; the rest
 * are the difficulties and categories that actually occur in the catalogue, so a facet with
 * nothing behind it never renders as a chip that empties the grid.
 *
 * Counts are computed against the whole catalogue, not the current selection — a chip has to
 * say how much it would show, or switching between them reads as a bug.
 */
export function buildPathFilters(paths: LearningPath[]): PathFilter[] {
  const mineCount = paths.filter((p) => p.myEnrollmentStatus !== null).length

  const filters: PathFilter[] = []
  if (mineCount > 0) {
    filters.push({
      key: 'mine',
      label: 'My paths',
      count: mineCount,
      matches: (p) => p.myEnrollmentStatus !== null,
    })
  }
  filters.push({ key: 'all', label: 'All', count: paths.length, matches: () => true })

  for (const difficulty of DIFFICULTY_ORDER) {
    const count = paths.filter((p) => p.difficulty === difficulty).length
    if (count > 0) {
      filters.push({
        key: `difficulty:${difficulty}`,
        label: sentenceCase(difficulty),
        count,
        matches: (p) => p.difficulty === difficulty,
      })
    }
  }

  const categories = [...new Set(paths.map((p) => p.category).filter(Boolean))].sort()
  for (const category of categories) {
    filters.push({
      key: `category:${category}`,
      label: sentenceCase(category),
      count: paths.filter((p) => p.category === category).length,
      matches: (p) => p.category === category,
    })
  }

  return filters
}

/** The chip the page opens on: your own paths when you have any, otherwise the full list. */
export function defaultFilterKey(filters: PathFilter[]): string {
  return filters.some((f) => f.key === 'mine') ? 'mine' : 'all'
}
