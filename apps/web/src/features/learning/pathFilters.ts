import type { LearningPath } from './types'

/** Where the caller stands on a path. `dropped` is an abandoned enrollment. */
export type PathStatus = 'active' | 'new' | 'completed' | 'dropped'

export type StatusTone = 'indigo' | 'mint' | 'amber' | 'neutral'

export const PATH_STATUS_META: Record<PathStatus, { label: string; tone: StatusTone }> = {
  active: { label: 'In progress', tone: 'indigo' },
  new: { label: 'Not started', tone: 'neutral' },
  completed: { label: 'Completed', tone: 'mint' },
  dropped: { label: 'Dropped', tone: 'amber' },
}

/** Pill colours for a status tone: text, fill and the matching 0.5px border. */
export const TONE_STYLE: Record<StatusTone, { color: string; background: string; border: string }> = {
  indigo: { color: 'var(--uc-indigo-l)', background: 'var(--uc-indigo-bg)', border: '0.5px solid var(--uc-indigo-bdr)' },
  mint: { color: 'var(--uc-mint)', background: 'var(--uc-mint-bg)', border: '0.5px solid var(--uc-mint-bdr)' },
  amber: { color: 'var(--uc-amber-l)', background: 'var(--uc-amber-bg)', border: '0.5px solid var(--uc-amber-bdr)' },
  neutral: { color: 'var(--text-secondary)', background: 'var(--surface-raised)', border: '0.5px solid var(--border-default)' },
}

export function pathStatus(status: LearningPath['myEnrollmentStatus']): PathStatus {
  if (status === 'active' || status === 'completed') return status
  if (status === 'abandoned') return 'dropped'
  return 'new'
}

export type PathFilterKey = 'all' | PathStatus

export interface PathFilter {
  key: PathFilterKey
  label: string
  count: number
}

const FILTER_ORDER: { key: PathFilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: PATH_STATUS_META.active.label },
  { key: 'new', label: PATH_STATUS_META.new.label },
  { key: 'completed', label: PATH_STATUS_META.completed.label },
  { key: 'dropped', label: PATH_STATUS_META.dropped.label },
]

/** How many path cards the Learn page shows before "See all" opens the full list. */
export const PATHS_PREVIEW_COUNT = 6

export function matchesPathFilter(path: LearningPath, key: PathFilterKey): boolean {
  return key === 'all' || pathStatus(path.myEnrollmentStatus) === key
}

/**
 * The status chip row over the paths grid. Every chip always renders, and its count is taken
 * against the whole catalogue rather than the current selection — a chip has to say how much
 * it would show, or switching between them reads as a bug.
 */
export function buildPathFilters(paths: LearningPath[]): PathFilter[] {
  return FILTER_ORDER.map(({ key, label }) => ({
    key,
    label,
    count: paths.filter((p) => matchesPathFilter(p, key)).length,
  }))
}

export function isPathFilterKey(value: string | null): value is PathFilterKey {
  return FILTER_ORDER.some((f) => f.key === value)
}
