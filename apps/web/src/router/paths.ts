export const PATHS = {
  LOGIN: '/login',
  REGISTER_ENTRY: '/register',
  REGISTER: '/register/:token',
  OTP: '/otp',
  VERIFY_OTP: '/verify-otp',
  FORGOT_PASSWORD: '/forgot-password',

  FEED: '/feed',
  POST_DETAIL: '/feed/:id',

  JOBS: '/jobs',
  JOB_DETAIL: '/jobs/:id',

  EVENTS: '/events',
  EVENT_DETAIL: '/events/:id',

  MESSAGES: '/messages',
  CONVERSATION: '/messages/:id',

  PROFILE: '/profile/:id',

  GROUPS: '/groups',
  GROUP_DETAIL: '/groups/:id',

  NOTIFICATIONS: '/notifications',

  NEWS: '/news',
  NEWS_DETAIL: '/news/:id',

  LOST_FOUND: '/lost-found',

  MENTORSHIP: '/mentorship',

  SHUTTLE: '/shuttle',
  SHUTTLE_DRIVE: '/shuttle/drive',

  EXPLORE: '/explore',
  TAG: '/explore/tag/:tag',

  CONNECTIONS: '/connections',

  DRAFTS: '/drafts',

  SETTINGS: '/settings',
  SETTINGS_NOTIFICATIONS: '/settings/notifications',
  SETTINGS_APPEARANCE: '/settings/appearance',
  SETTINGS_ACCOUNT: '/settings/account',
  SETTINGS_PRIVACY: '/settings/privacy',

  ADMIN: '/admin',
} as const

export type PathKey = keyof typeof PATHS
