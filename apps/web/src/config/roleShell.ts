import type { UserRole } from '@uniconnect/shared'
import { PATHS } from '@/router/paths'

/**
 * The right rail's payload is addressed by key, never by the rail's own internals, so a
 * role's widget set is a data decision made here rather than a branch inside
 * `RightSidebar`. Every widget self-hides when its query comes back empty — a role that
 * lists three may legitimately render fewer, and that is the correct resting state.
 */
export type WidgetKey =
  | 'profile-progress'
  | 'people-you-may-know'
  | 'upcoming-events'
  | 'mentee-requests'
  | 'platform-today'
  | 'trending-tags'

/**
 * A key on the profile `stats` object. The role-scoped ones are computed server-side
 * only for the role they describe, so reading `mentees` off a student profile yields
 * undefined by design — the manifest is what guarantees a role only asks for its own.
 */
export type StatSource =
  | 'connections'
  | 'pendingReceived'
  | 'posts'
  | 'mentees'
  | 'sections'
  | 'students'
  | 'members'
  | 'verifications'

export interface StatSpec {
  key: StatSource
  label: string
  /**
   * True when the count is only meaningful on your own profile — `pendingReceived` is
   * returned as 0 for anyone else by design, so rendering it on a stranger's profile
   * would show a permanent zero. Surfaces viewing someone else swap in `PUBLIC_STAT`.
   */
  ownerOnly?: boolean
}

/** What an `ownerOnly` stat degrades to when a visitor is looking. */
export const PUBLIC_STAT: StatSpec = { key: 'posts', label: 'posts' }

/** The pair to show for `role`, with owner-only entries swapped out for visitors. */
export function statsFor(role: UserRole, isOwnProfile: boolean): [StatSpec, StatSpec] {
  const pair = ROLE_SHELL[role].stats
  if (isOwnProfile) return pair
  return pair.map((s) => (s.ownerOnly ? PUBLIC_STAT : s)) as [StatSpec, StatSpec]
}

export interface RoleShell {
  /** Where '/' (once authenticated) and the top-nav logo resolve to. */
  home: string
  primaryAction: { label: string; to: string }
  searchPlaceholder: string
  /** Rendered top to bottom. Capped at four; see `roleShell.test.ts`. */
  rightRail: WidgetKey[]
  /** The profile card's two numbers, in the rail and on the profile header. */
  stats: [StatSpec, StatSpec]
}

/**
 * A driver is a service account, not a member, so the social shell stays closed to it.
 * These are the only routes it may reach — the duty board, the surfaces its own rail
 * and tools point at, and the personal pages every account needs. Keep this in step
 * with `RAILS.driver`: a rail row outside this set would bounce straight back.
 */
const DRIVER_ALLOWED: readonly string[] = [
  PATHS.SHUTTLE_DRIVE,
  PATHS.SHUTTLE,
  PATHS.MESSAGES,
  PATHS.CONVERSATION,
  PATHS.NEWS,
  PATHS.NEWS_DETAIL,
  PATHS.NOTIFICATIONS,
  PATHS.SETTINGS,
  PATHS.PROFILE,
]

/** True when `role` may render `pathname` at all. Only the driver role is restricted. */
export function isRouteAllowedForRole(role: UserRole, pathname: string): boolean {
  if (role !== 'driver') return true
  return DRIVER_ALLOWED.some((allowed) => {
    const base = allowed.split(':')[0].replace(/\/$/, '')
    return pathname === base || pathname.startsWith(base + '/')
  })
}

export const ROLE_SHELL: Record<UserRole, RoleShell> = {
  student: {
    home: PATHS.FEED,
    primaryAction: { label: 'Post', to: PATHS.FEED },
    searchPlaceholder: 'Search people, posts, events, lost & found',
    // Progress disappears for good once the profile is complete, so the steady state
    // for an established student is the spec's three.
    rightRail: ['profile-progress', 'people-you-may-know', 'upcoming-events', 'trending-tags'],
    stats: [
      { key: 'connections', label: 'connections' },
      { key: 'pendingReceived', label: 'pending', ownerOnly: true },
    ],
  },
  alumni: {
    home: PATHS.FEED,
    primaryAction: { label: 'Post a job', to: PATHS.JOBS },
    searchPlaceholder: 'Search people, posts, events, lost & found',
    // Alumni contribute more than they browse, so the requests waiting on them lead.
    rightRail: ['mentee-requests', 'people-you-may-know', 'upcoming-events'],
    stats: [
      { key: 'connections', label: 'connections' },
      { key: 'mentees', label: 'mentees' },
    ],
  },
  faculty: {
    home: PATHS.FEED,
    primaryAction: { label: 'Announce', to: PATHS.NEWS },
    searchPlaceholder: 'Search people, posts, events, lost & found',
    // No mentorship widget: the module gives faculty no write access anywhere, so a
    // request queue it cannot action would violate the render-only-if-actionable rule.
    rightRail: ['upcoming-events', 'people-you-may-know', 'trending-tags'],
    // Sections, not groups, are the unit of navigation for faculty.
    stats: [
      { key: 'sections', label: 'sections' },
      { key: 'students', label: 'students' },
    ],
  },
  admin: {
    home: PATHS.ADMIN,
    primaryAction: { label: 'Broadcast', to: PATHS.ADMIN },
    searchPlaceholder: 'Search people, posts, events, lost & found',
    rightRail: ['platform-today', 'people-you-may-know', 'trending-tags'],
    stats: [
      { key: 'members', label: 'members' },
      { key: 'verifications', label: 'verifications' },
    ],
  },
  driver: {
    home: PATHS.SHUTTLE_DRIVE,
    primaryAction: { label: 'Start trip', to: PATHS.SHUTTLE_DRIVE },
    searchPlaceholder: 'Search people, posts, events, lost & found',
    // A driver reaches the shell only on /news and /shuttle. Its spec'd widgets (live
    // map, week's totals) have no endpoint yet, and the member widgets are all surfaces
    // it cannot act on — so the rail stays empty rather than borrowing student payload.
    rightRail: [],
    // Route and trips-today have no read endpoint yet, so the driver card falls back
    // to the two counts every account genuinely has.
    stats: [
      { key: 'connections', label: 'connections' },
      { key: 'posts', label: 'posts' },
    ],
  },
}
