import type { UserRole } from '@uniconnect/shared'
import { PATHS } from '@/router/paths'

/**
 * The right rail's payload is addressed by key, never by the rail's own internals, so a
 * role's widget set is a data decision made here rather than a branch inside
 * `RightSidebar`. Every widget self-hides when its query comes back empty — a role that
 * lists three may legitimately render fewer, and that is the correct resting state.
 *
 * A widget earns its place by addressing something the left rail cannot: a *specific*
 * event, person or tag. A widget whose every row leads back to a page the rail already
 * owns is that rail row a second time, in a second place, and belongs on the left only.
 */
export type WidgetKey =
  | 'profile-progress'
  | 'people-you-may-know'
  | 'upcoming-events'
  | 'trending-tags'
  | 'admin-queue'
  | 'admin-stats'

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
  | 'groups'

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

/**
 * Search is global — every query is routed to `/explore?q=`, and the endpoint behind it
 * spans profiles, posts, jobs, events and groups for every role alike. The placeholder
 * is therefore a single string rather than a per-role field: a manifest key that never
 * varies by role is a promise of variance the shell does not actually keep.
 */
export const SEARCH_PLACEHOLDER = 'Search people, posts, events, lost & found'

export interface RoleShell {
  /** Where '/' (once authenticated) and the top-nav logo resolve to. */
  home: string
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

/**
 * An admin reviews the feed from Content moderation; it does not read or post in it.
 * `/feed` and `/feed/:id` (the post detail a card's timestamp used to open) bounce back
 * to the admin home. Announcements still go out through the Announcements tab.
 */
const ADMIN_BLOCKED: readonly string[] = [PATHS.FEED]

function matchesRoute(pattern: string, pathname: string): boolean {
  const base = pattern.split(':')[0].replace(/\/$/, '')
  return pathname === base || pathname.startsWith(base + '/')
}

/** True when `role` may render `pathname` at all. Drivers are allowlisted, admins are kept out of the feed. */
export function isRouteAllowedForRole(role: UserRole, pathname: string): boolean {
  if (role === 'driver') return DRIVER_ALLOWED.some((allowed) => matchesRoute(allowed, pathname))
  if (role === 'admin') return !ADMIN_BLOCKED.some((blocked) => matchesRoute(blocked, pathname))
  return true
}

export const ROLE_SHELL: Record<UserRole, RoleShell> = {
  student: {
    home: PATHS.FEED,
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
    // No mentee-requests widget: every row in it — and its See all — went to
    // /mentorship, which is the `mentees` fixed row, and its count came from the same
    // query the contextual "Mentee requests" row already reads. One number, one
    // destination, rendered twice on one screen. The rail keeps what the left cannot
    // address: a specific person, a specific event, a specific tag.
    rightRail: ['people-you-may-know', 'upcoming-events', 'trending-tags', 'profile-progress'],
    stats: [
      { key: 'connections', label: 'connections' },
      { key: 'mentees', label: 'mentees' },
    ],
  },
  faculty: {
    home: PATHS.FEED,
    // No mentorship widget: the module gives faculty no write access anywhere, so a
    // request queue it cannot action would violate the render-only-if-actionable rule.
    // Progress trails the duty widgets rather than leading as it does for students —
    // `/users/me/progress` is own-profile, so every role can answer it, and the widget
    // retires itself once complete.
    rightRail: ['upcoming-events', 'people-you-may-know', 'trending-tags', 'profile-progress'],
    // Sections, not groups, are the unit of navigation for faculty.
    stats: [
      { key: 'sections', label: 'sections' },
      { key: 'students', label: 'students' },
    ],
  },
  admin: {
    home: PATHS.ADMIN,
    // The admin rail is a console, not a feed of suggestions: a queue of what is waiting
    // and a scoreboard for the screen you are on, both re-keyed by the `?tab=` you are
    // looking at (`rightRail/admin/useAdminRail.ts`). Every figure comes from the query
    // the matching tab already holds, so the rail never adds a request of its own. The
    // member widgets were dropped on purpose — an admin does not read the feed, so
    // events, people and tags were payload for a surface it is walled out of.
    rightRail: ['admin-queue', 'admin-stats'],
    stats: [
      { key: 'members', label: 'members' },
      { key: 'groups', label: 'groups' },
    ],
  },
  driver: {
    home: PATHS.SHUTTLE_DRIVE,
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
