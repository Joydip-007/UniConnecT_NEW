import type { Group } from './types'

export type GroupTab =
  | 'feed'
  | 'resources'
  | 'study-sessions'
  | 'academic'
  | 'events'
  | 'stats'
  | 'join-requests'

export interface GroupTabDef {
  value: GroupTab
  label: string
  /** Rendered as a pill on the right of the row — used for pending join requests. */
  badge?: number
}

/** Academic groups land on their LMS by default; everyone else lands on Feed. */
export function defaultTabFor(group: Pick<Group, 'type'> | null | undefined): GroupTab {
  return group?.type === 'academic' ? 'academic' : 'feed'
}

/**
 * The tabs a given group + viewer combination earns, in display order. Members and
 * About are deliberately absent — Members becomes an overlay and About moves to the
 * right rail in later tasks.
 */
export function groupTabsFor(group: Group, opts: { pendingCount: number }): GroupTabDef[] {
  const userRole = group.userRole
  const isModeratorOrAbove = !!(userRole && ['owner', 'admin', 'moderator'].includes(userRole))
  const isAdmin = userRole === 'owner' || userRole === 'admin'

  return [
    { value: 'feed', label: 'Feed' },
    { value: 'resources', label: 'Resources' },
    { value: 'study-sessions', label: 'Study sessions' },
    ...(group.type === 'academic' ? [{ value: 'academic', label: 'Academic LMS' } as GroupTabDef] : []),
    { value: 'events', label: 'Events' },
    ...(isModeratorOrAbove ? [{ value: 'stats', label: 'Stats' } as GroupTabDef] : []),
    ...(isAdmin
      ? [{ value: 'join-requests', label: 'Join requests', badge: opts.pendingCount } as GroupTabDef]
      : []),
  ]
}
