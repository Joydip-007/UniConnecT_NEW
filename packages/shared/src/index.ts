// Shared types, Zod schemas, and constants for UniConnecT.
// All apps import exclusively from '@uniconnect/shared' — never cross-import between apps.

export interface ApiSuccess<T = unknown> {
  data: T;
}

export interface ApiError {
  error: string;
  code: string;
}

export type { User, UserProfile, UserRole, ThemePreference } from './types/user'
export type { FeedPost, FeedPoll, FeedPollOption, FeedPostAuthor, FeedComment } from './types/feed'
export * from './schemas/auth'
export * from './schemas/users'
export * from './schemas/connections'
export * from './schemas/profile'
export * from './schemas/content-sync'
export * from './schemas/notifications'
export * from './schemas/push'
export * from './constants/socket'
export * from './constants/notifications'
