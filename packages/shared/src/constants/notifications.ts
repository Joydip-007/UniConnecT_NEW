// Notification categories, type→category mapping, and default preferences.
// Single source of truth shared by the API (enforcement) and web (settings UI).

export const NOTIFICATION_CATEGORIES = [
  'connections',
  'feed',
  'groups',
  'mentorship',
  'messages',
  'system',
] as const

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number]

/** Categories the user can toggle. `system` is always delivered and has no toggle. */
export const USER_CONTROLLABLE_CATEGORIES = [
  'connections',
  'feed',
  'groups',
  'mentorship',
  'messages',
] as const

export type ControllableCategory = (typeof USER_CONTROLLABLE_CATEGORIES)[number]

export type NotificationChannel = 'in_app' | 'push'

export interface CategoryPreference {
  in_app: boolean
  push: boolean
}

export type NotificationPreferences = Record<ControllableCategory, CategoryPreference>

/** All channels on by default — preserves current behaviour for users who never visit settings. */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  connections: { in_app: true, push: true },
  feed: { in_app: true, push: true },
  groups: { in_app: true, push: true },
  mentorship: { in_app: true, push: true },
  messages: { in_app: true, push: true },
}

/** Maps a notification `type` to its category. Unknown types fall back to `system` (always delivered). */
export const NOTIFICATION_CATEGORY_MAP: Record<string, NotificationCategory> = {
  // connections
  connection_request: 'connections',
  connection_accepted: 'connections',
  // feed
  post_reaction: 'feed',
  post_comment: 'feed',
  // groups
  group_join_request: 'groups',
  group_join_approved: 'groups',
  group_join_declined: 'groups',
  group_invite: 'groups',
  group_pinned_update: 'groups',
  group_study_session_created: 'groups',
  // mentorship
  mentorship: 'mentorship',
  mentorship_request_declined: 'mentorship',
  request_reminder: 'mentorship',
  request_expire: 'mentorship',
  // messages
  'message:new': 'messages',
  // system (always-on)
  system: 'system',
  password_changed: 'system',
}

export function resolveNotificationCategory(type: string): NotificationCategory {
  return NOTIFICATION_CATEGORY_MAP[type] ?? 'system'
}

/** Display metadata for the settings UI (sentence case, matches design rules). */
export const NOTIFICATION_CATEGORY_META: Record<
  ControllableCategory,
  { label: string; description: string }
> = {
  connections: { label: 'Connections', description: 'Connection requests and acceptances' },
  feed: { label: 'Feed', description: 'Reactions and comments on your posts' },
  groups: { label: 'Groups', description: 'Invites, join requests, sessions and pinned updates' },
  mentorship: { label: 'Mentorship', description: 'Mentorship requests, reminders and updates' },
  messages: { label: 'Messages', description: 'New direct and group messages' },
}
