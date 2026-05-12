// Shared types, Zod schemas, and constants for UniConnecT.
// All apps import exclusively from '@uniconnect/shared' — never cross-import between apps.

export interface ApiSuccess<T = unknown> {
  data: T;
}

export interface ApiError {
  error: string;
  code: string;
}

export type { User, UserProfile, UserRole } from './types/user'
