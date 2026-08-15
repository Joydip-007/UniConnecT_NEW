import type { UserRole } from '@uniconnect/shared'
import { PATHS } from '@/router/paths'

export interface RoleShell {
  /** Where '/' (once authenticated) and the top-nav logo resolve to. */
  home: string
  primaryAction: { label: string; to: string }
  searchPlaceholder: string
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
  },
  alumni: {
    home: PATHS.FEED,
    primaryAction: { label: 'Post a job', to: PATHS.JOBS },
    searchPlaceholder: 'Search people, posts, events, lost & found',
  },
  faculty: {
    home: PATHS.FEED,
    primaryAction: { label: 'Announce', to: PATHS.NEWS },
    searchPlaceholder: 'Search people, posts, events, lost & found',
  },
  admin: {
    home: PATHS.ADMIN,
    primaryAction: { label: 'Broadcast', to: PATHS.ADMIN },
    searchPlaceholder: 'Search people, posts, events, lost & found',
  },
  driver: {
    home: PATHS.SHUTTLE_DRIVE,
    primaryAction: { label: 'Start trip', to: PATHS.SHUTTLE_DRIVE },
    searchPlaceholder: 'Search people, posts, events, lost & found',
  },
}
