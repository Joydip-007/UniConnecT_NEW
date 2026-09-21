export const UNIVERSITY_EVENTS = {
  DOMAINS_UPDATED: 'university:domains_updated',
} as const

export const CONNECTION_EVENTS = {
  REQUEST_RECEIVED: 'connection:request_received',
  ACCEPTED: 'connection:accepted',
} as const

export const CONTENT_SYNC_EVENTS = {
  RUN_COMPLETED: 'content_sync:run_completed',
} as const

export const POST_LIFECYCLE_EVENTS = {
  /** A scheduled post went live (also emitted as the normal feed:post:new). */
  PUBLISHED: 'post:published',
  /** A post was archived (manually or via expiry) — open feeds should drop it. */
  ARCHIVED: 'post:archived',
  /** A user shared (reposted) a post to their profile. */
  SHARED: 'post:shared',
  /** A user removed their repost. */
  UNSHARED: 'post:unshared',
} as const

export const GROUP_EVENTS = {
  /** A group's post/event review queue changed (new pending item) — sent to owner/admin/moderator rooms. */
  REVIEW_QUEUE_CHANGED: 'group:review-queue-changed',
} as const

export const PRESENCE_EVENTS = {
  /** Server → client: a user's online status changed. */
  UPDATE: 'presence:update',
  /** Client → server: heartbeat to keep the presence TTL alive. */
  PING: 'presence:ping',
} as const

export type PresenceStatus = 'online' | 'offline'

export interface PresenceUpdate {
  userId: string
  status: PresenceStatus
  lastSeenAt: string | null
}
