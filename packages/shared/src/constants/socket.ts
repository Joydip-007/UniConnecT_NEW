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
