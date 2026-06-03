export const PATHS = {
  LOGIN: '/login',
  REGISTER_ENTRY: '/register',
  REGISTER: '/register/:token',
  OTP: '/otp',
  VERIFY_OTP: '/verify-otp',
  FORGOT_PASSWORD: '/forgot-password',

  FEED: '/feed',

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

  EXPLORE: '/explore',
  TAG: '/explore/tag/:tag',

  CONNECTIONS: '/connections',

  DRAFTS: '/drafts',

  ADMIN: '/admin',
} as const

export type PathKey = keyof typeof PATHS
