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

/** Push is suppressed during this window (in-app notifications are still recorded). */
export interface QuietHours {
  enabled: boolean
  /** Local start time, "HH:MM" 24h. */
  start: string
  /** Local end time, "HH:MM" 24h. May be earlier than start for overnight windows. */
  end: string
  /** IANA timezone the start/end are expressed in. */
  timezone: string
}

/** How notification emails are delivered. `off` = no emails; `daily` = one digest per day. */
export type EmailDigestFrequency = 'off' | 'daily'

export type NotificationPreferences = Record<ControllableCategory, CategoryPreference> & {
  quietHours: QuietHours
  emailDigest: EmailDigestFrequency
}

export const DEFAULT_QUIET_HOURS: QuietHours = {
  enabled: false,
  start: '22:00',
  end: '07:00',
  timezone: 'Asia/Dhaka',
}

/** All channels on by default — preserves current behaviour for users who never visit settings. */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  connections: { in_app: true, push: true },
  feed: { in_app: true, push: true },
  groups: { in_app: true, push: true },
  mentorship: { in_app: true, push: true },
  messages: { in_app: true, push: true },
  quietHours: DEFAULT_QUIET_HOURS,
  emailDigest: 'off',
}

function quietHoursMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((n) => Number.parseInt(n, 10))
  return ((h % 24) * 60 + (m || 0)) % (24 * 60)
}

/**
 * Whether `now` falls inside the quiet-hours window, evaluated in the window's
 * timezone. Handles overnight windows (start > end, e.g. 22:00 → 07:00). Pure —
 * safe to share between the API (push gating) and tests.
 */
export function isWithinQuietHours(qh: QuietHours, now: Date = new Date()): boolean {
  if (!qh.enabled) return false
  const current = new Intl.DateTimeFormat('en-GB', {
    timeZone: qh.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now)
  const cur = quietHoursMinutes(current)
  const start = quietHoursMinutes(qh.start)
  const end = quietHoursMinutes(qh.end)
  if (start === end) return false
  return start < end ? cur >= start && cur < end : cur >= start || cur < end
}

/** Maps a notification `type` to its category. Unknown types fall back to `system` (always delivered). */
export const NOTIFICATION_CATEGORY_MAP: Record<string, NotificationCategory> = {
  // connections
  connection_request: 'connections',
  connection_accepted: 'connections',
  // feed
  post_reaction: 'feed',
  post_comment: 'feed',
  mention: 'feed',
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
  feed: { label: 'Feed', description: 'Reactions, comments, and mentions on your posts' },
  groups: { label: 'Groups', description: 'Invites, join requests, sessions and pinned updates' },
  mentorship: { label: 'Mentorship', description: 'Mentorship requests, reminders and updates' },
  messages: { label: 'Messages', description: 'New direct and group messages' },
}
