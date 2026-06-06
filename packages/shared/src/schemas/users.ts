import { z } from 'zod'
import type { ThemePreference } from '../types/user'

export const userRoleSchema = z.enum(['student', 'alumni', 'faculty', 'admin', 'driver'])

/**
 * Usernames that must never be assignable — they collide with routes, reserved
 * handles, or would be confusing. Kept here so the API, the backfill migration,
 * and the settings form all agree.
 */
export const RESERVED_USERNAMES = [
  'admin',
  'api',
  'www',
  'support',
  'about',
  'login',
  'register',
  'settings',
  'me',
  'profile',
  'null',
  'undefined',
] as const

/** Lowercase + trim — the canonical stored form of a username. */
export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase()
}

/**
 * Single source of truth for username validation. 3–30 chars, lowercase
 * letters/digits/`.`/`_`, must start and end alphanumeric, no consecutive
 * separators, not reserved. Input is lowercased + trimmed before validation.
 */
export const usernameSchema = z.preprocess(
  (val) => (typeof val === 'string' ? normalizeUsername(val) : val),
  z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(
      /^[a-z0-9](?:[a-z0-9._]){1,28}[a-z0-9]$/,
      'Use letters, numbers, . or _ — must start and end with a letter or number',
    )
    .refine((v) => !/[._]{2}/.test(v), 'No consecutive . or _')
    .refine(
      (v) => !RESERVED_USERNAMES.includes(v as (typeof RESERVED_USERNAMES)[number]),
      'This username is reserved',
    ),
)

export type Username = z.infer<typeof usernameSchema>

export const userProfileFieldsSchema = z.object({
  fullName: z.string(),
  bio: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  coverUrl: z.string().nullable(),
  headline: z.string().nullable(),
  department: z.string().nullable(),
  batchYear: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
  phone: z.string().nullable(),
  skills: z.array(z.string()),
  isOpenToWork: z.boolean(),
  isOpenToMentorship: z.boolean(),
  mentorshipPoints: z.number().int().nonnegative(),
  location: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  githubUrl: z.string().nullable(),
  portfolioUrl: z.string().nullable(),
  isOpenToMsg: z.boolean(),
})

export const themePreferenceSchema = z.enum(['light', 'dark', 'system'])
export type ThemePreferenceInput = ThemePreference

export const publicUserProfileSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  email: z.string(),
  role: userRoleSchema,
  universityId: z.string().uuid(),
  isVerified: z.boolean(),
  themePreference: themePreferenceSchema,
  isActive: z.boolean().optional(),
  lastActiveAt: z.union([z.string(), z.date()]).nullable().optional(),
  createdAt: z.union([z.string(), z.date()]),
  profile: userProfileFieldsSchema,
  connectionStatus: z.enum(['none', 'pending_sent', 'pending_received', 'connected']),
  connectionId: z.string().uuid().nullable(),
  mutualConnections: z.number().int().nonnegative(),
  stats: z.object({
    connections: z.number().int().nonnegative(),
    pendingReceived: z.number().int().nonnegative(),
    posts: z.number().int().nonnegative(),
  }),
})

export type PublicUserProfile = z.infer<typeof publicUserProfileSchema>

export const updateUserPreferencesSchema = z
  .object({
    themePreference: themePreferenceSchema.optional(),
  })
  .strict()
export type UpdateUserPreferencesInput = z.infer<typeof updateUserPreferencesSchema>
