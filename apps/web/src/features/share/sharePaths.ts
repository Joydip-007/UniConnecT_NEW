import type { ShareEntityType } from '@uniconnect/shared'

/**
 * Maps a shareable entity to its in-app permalink path. Sharing is internal: the
 * resulting absolute URL only resolves for a logged-in member of the same university.
 * Lost-and-found items have no detail route, so they link to the list + an anchor.
 */
export const SHARE_PATHS: Record<ShareEntityType, (id: string) => string> = {
  post: (id) => `/feed/${id}`,
  job: (id) => `/jobs/${id}`,
  event: (id) => `/events/${id}`,
  news: (id) => `/news/${id}`,
  group: (id) => `/groups/${id}`,
  profile: (id) => `/profile/${id}`,
  'lost-found': (id) => `/lost-found#${id}`,
}

export function buildShareUrl(entityType: ShareEntityType, entityId: string): string {
  return `${window.location.origin}${SHARE_PATHS[entityType](entityId)}`
}
