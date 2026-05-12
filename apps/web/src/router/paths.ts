export const PATHS = {
  LOGIN: '/login',
  REGISTER: '/register/:token',

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

  SEARCH: '/search',

  ADMIN: '/admin',
} as const

export type PathKey = keyof typeof PATHS
