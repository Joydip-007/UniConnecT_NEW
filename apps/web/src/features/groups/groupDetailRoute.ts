/**
 * `/groups/:id` keeps its section and any open overlay in the query string, so a
 * shared link lands on the right tab with the right dialog open, and Back closes
 * the dialog instead of leaving the group.
 *
 *   /groups/:id                      feed (the default stays out of the URL)
 *   /groups/:id?tab=members          a section
 *   /groups/:id?modal=share          an overlay, on top of whatever tab is set
 *   /groups/:id?modal=members        the members panel (from the header's avatar stack)
 *   /groups/:id?modal=invite         the invite panel — admins of non-system groups only
 *
 * Both params are read back defensively: a tab the viewer's role does not earn
 * (a student on `?tab=stats`) or a modal they cannot use (`?modal=invite` on a
 * group they do not admin) resolves to the default rather than an empty or
 * forbidden panel.
 */

export const GROUP_TABS = [
  'feed',
  'resources',
  'study-sessions',
  'academic',
  'members',
  'events',
  'about',
  'stats',
  'join-requests',
] as const
export type GroupTab = (typeof GROUP_TABS)[number]

export const DEFAULT_GROUP_TAB: GroupTab = 'feed'

/** Overlays that have a route: each one is backed by an endpoint the app already calls. */
export const GROUP_MODALS = ['share', 'members', 'invite'] as const
export type GroupModal = (typeof GROUP_MODALS)[number]

export function resolveGroupTab(raw: string | null, allowed: readonly string[]): GroupTab {
  if (raw && (GROUP_TABS as readonly string[]).includes(raw) && allowed.includes(raw)) {
    return raw as GroupTab
  }
  return DEFAULT_GROUP_TAB
}

export function resolveGroupModal(raw: string | null, allowed: readonly GroupModal[]): GroupModal | null {
  if (raw && (GROUP_MODALS as readonly string[]).includes(raw) && allowed.includes(raw as GroupModal)) {
    return raw as GroupModal
  }
  return null
}

/** Builds the group URL, leaving the default tab and a closed modal out of the query. */
export function groupDetailPath(
  groupId: string,
  opts: { tab?: GroupTab | null; modal?: GroupModal | null } = {},
): string {
  const params = new URLSearchParams()
  if (opts.tab && opts.tab !== DEFAULT_GROUP_TAB) params.set('tab', opts.tab)
  if (opts.modal) params.set('modal', opts.modal)
  const query = params.toString()
  return `/groups/${groupId}${query ? `?${query}` : ''}`
}
