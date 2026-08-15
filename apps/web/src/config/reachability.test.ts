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
  // Owned by the avatar menu, which every role renders.
  PATHS.PROFILE,
  PATHS.SETTINGS,
  // Sub-navigation inside the settings page itself.
  PATHS.SETTINGS_NOTIFICATIONS,
  PATHS.SETTINGS_APPEARANCE,
  PATHS.SETTINGS_ACCOUNT,
  PATHS.SETTINGS_PRIVACY,
])

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
  const navigable = Object.values(PATHS).filter((p) => !REACHED_BY_CONTEXT.has(p))

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
    PATHS.LOST_FOUND,
    PATHS.DRAFTS,
    PATHS.CONNECTIONS,
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

  it('keeps the driver walled off from the social app', () => {
    const reachable = shellDestinations('driver')
    const social = [PATHS.FEED, PATHS.JOBS, PATHS.GROUPS, PATHS.MENTORSHIP, PATHS.EVENTS, PATHS.EXPLORE]
    social.forEach((path) => expect(reachable.has(path)).toBe(false))
  })
})
