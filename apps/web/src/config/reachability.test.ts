import { describe, expect, it } from 'vitest'
import type { UserRole } from '@uniconnect/shared'
import { ROLE_SHELL, isRouteAllowedForRole } from './roleShell'
import { RAILS } from '@/components/leftSidebar.config'
import { PATHS } from '@/router/paths'

const ROLES: UserRole[] = ['student', 'alumni', 'faculty', 'admin', 'driver']

/**
 * Routes that legitimately have no nav row. Each is reached by acting on a thing —
 * opening a record, or moving through an unauthenticated flow — so nothing here is
 * "orphaned" in the sense the shell spec means. Anything NOT listed must be clickable
 * from the shell for at least one role.
 */
const REACHED_BY_CONTEXT = new Set<string>([
  // Unauthenticated flows, reached before a shell exists.
  PATHS.LOGIN,
  PATHS.REGISTER_ENTRY,
  PATHS.REGISTER,
  PATHS.OTP,
  PATHS.VERIFY_OTP,
  PATHS.FORGOT_PASSWORD,
  PATHS.ABOUT,
  // Detail routes — reached by opening an item from its own list page.
  PATHS.POST_DETAIL,
  PATHS.JOB_DETAIL,
  PATHS.EVENT_DETAIL,
  PATHS.NEWS_DETAIL,
  PATHS.GROUP_DETAIL,
  PATHS.CONVERSATION,
  PATHS.TAG,
  // Manage page for one learning path's units — reached via the "Manage" button on the
  // admin learning library, same as GROUP_DETAIL is reached from the group list. It is a
  // builder function rather than a plain pattern, so it's normalized with a placeholder id.
  PATHS.ADMIN_LEARNING_PATH(':pathId'),
  // Owned by the avatar menu, which every role renders.
  PATHS.PROFILE,
  PATHS.SETTINGS,
  // Sub-navigation inside the settings page itself.
  PATHS.SETTINGS_NOTIFICATIONS,
  PATHS.SETTINGS_APPEARANCE,
  PATHS.SETTINGS_ACCOUNT,
  PATHS.SETTINGS_PRIVACY,
  // Sub-navigation inside the page that absorbed them — see ABSORBED_INTO.
  PATHS.LOST_FOUND,
  PATHS.CONNECTIONS,
])

/**
 * Pages that were absorbed into another page as a section tab. Each still has a
 * registered route so deep links and old links keep working, but the shell must offer
 * exactly ONE home per feature: the section, which sits with the content it belongs to.
 *
 * This map exists because the duplicate is otherwise invisible to this file.
 * `shellDestinations` strips the query string, so `/explore?section=lost-found` can only
 * ever register as `/explore` — a section can never satisfy a feature, which is exactly
 * the pressure that put a second "Lost & found" row in `secondary` next to its own tab.
 * The `MEMBER_FEATURES` check below covers the absorbing page instead, and the tab's own
 * existence is covered by `pages/sectionTabs.test.tsx`.
 */
const ABSORBED_INTO: Record<string, string> = {
  [PATHS.LOST_FOUND]: `${PATHS.EXPLORE}?section=lost-found`,
  [PATHS.CONNECTIONS]: `${PATHS.GROUPS}?section=people`,
}

/** Every destination the shell offers a given role, across all four nav zones. */
function shellDestinations(role: UserRole): Set<string> {
  const rail = RAILS[role]
  const out = new Set<string>()
  const add = (to: string) => out.add(to.split('?')[0])

  rail.fixed.forEach((row) => add(row.to))
  rail.secondary.forEach((row) => add(row.to))
  rail.contextual.forEach((rule) => add(rule.to))
  rail.tools.forEach((tool) => tool.to && add(tool.to))
  add(ROLE_SHELL[role].home)
  return out
}

describe('shell reachability', () => {
  // Most PATHS entries are plain route-pattern strings; ADMIN_LEARNING_PATH is a builder
  // function instead (it needs a real id at call sites), so it's excluded here and its
  // normalized pattern is covered directly via the REACHED_BY_CONTEXT entry above.
  const navigable = (Object.values(PATHS) as Array<string | ((id: string) => string)>)
    .filter((p): p is string => typeof p === 'string')
    .filter((p) => !REACHED_BY_CONTEXT.has(p))

  it.each(navigable)('%s is reachable from the shell for at least one role', (path) => {
    const roles = ROLES.filter((role) => shellDestinations(role).has(path))
    expect(roles.length).toBeGreaterThan(0)
  })

  /** Every module a member role can act on, so every one must be clickable for it. */
  const MEMBER_FEATURES = [
    PATHS.FEED,
    PATHS.EXPLORE,
    PATHS.GROUPS,
    PATHS.EVENTS,
    PATHS.JOBS,
    PATHS.NEWS,
    PATHS.LEARN,
    PATHS.DRAFTS,
    PATHS.MESSAGES,
    PATHS.NOTIFICATIONS,
    PATHS.SHUTTLE,
  ]

  it.each<UserRole>(['student', 'alumni', 'faculty', 'admin'])(
    'offers the %s role every member feature',
    (role) => {
      const reachable = shellDestinations(role)
      const missing = MEMBER_FEATURES.filter((p) => !reachable.has(p))
      expect({ role, missing }).toEqual({ role, missing: [] })
    },
  )

  // The mentorship API is `requireRole('student')` plus `requireRole('alumni','admin')`.
  // Faculty can act nowhere in the module, so per the deciding rule it gets no row.
  it.each<UserRole>(['student', 'alumni', 'admin'])('offers mentorship to %s', (role) => {
    expect(shellDestinations(role).has(PATHS.MENTORSHIP)).toBe(true)
  })

  it('does not offer mentorship to faculty, which cannot act on it', () => {
    expect(shellDestinations('faculty').has(PATHS.MENTORSHIP)).toBe(false)
  })

  it('never offers a role a destination its route guard would reject', () => {
    ROLES.forEach((role) => {
      const rejected = [...shellDestinations(role)].filter(
        (path) => !isRouteAllowedForRole(role, path),
      )
      expect({ role, rejected }).toEqual({ role, rejected: [] })
    })
  })

  /**
   * The guard for the redundancy this map documents. An absorbed page must not be
   * advertised as its own row anywhere — fixed, secondary, contextual or tools — or the
   * feature has two homes in one zone again, which is how "Lost & found" ended up both in
   * the More sheet and as a tab inside Explore.
   */
  it.each(Object.entries(ABSORBED_INTO))(
    '%s has no rail row of its own — it lives at %s',
    (absorbed) => {
      const offending = ROLES.filter((role) => shellDestinations(role).has(absorbed))
      expect({ absorbed, offending }).toEqual({ absorbed, offending: [] })
    },
  )

  /** The absorbing page itself must still be reachable, or the section is orphaned too. */
  it.each(Object.entries(ABSORBED_INTO))('%s stays reachable via %s', (_absorbed, section) => {
    const base = section.split('?')[0]
    const roles = ROLES.filter((role) => shellDestinations(role).has(base))
    expect(roles.length).toBeGreaterThan(0)
  })

  it('keeps the driver walled off from the social app', () => {
    const reachable = shellDestinations('driver')
    const social = [PATHS.FEED, PATHS.JOBS, PATHS.GROUPS, PATHS.MENTORSHIP, PATHS.EVENTS, PATHS.EXPLORE]
    social.forEach((path) => expect(reachable.has(path)).toBe(false))
  })
})
