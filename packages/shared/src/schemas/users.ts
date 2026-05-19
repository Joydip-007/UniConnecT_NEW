import { z } from 'zod'
import type { ThemePreference } from '../types/user'

export const userRoleSchema = z.enum(['student', 'alumni', 'faculty', 'admin'])

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
})

export const themePreferenceSchema = z.enum(['light', 'dark', 'system'])
export type ThemePreferenceInput = ThemePreference

export const publicUserProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  role: userRoleSchema,
  universityId: z.string().uuid(),
  isVerified: z.boolean(),
  themePreference: themePreferenceSchema,
  isActive: z.boolean().optional(),
  lastActiveAt: z.union([z.string(), z.date()]).nullable().optional(),
  createdAt: z.union([z.string(), z.date()]),
  profile: userProfileFieldsSchema,
  stats: z.object({
    followers: z.number().int().nonnegative(),
    following: z.number().int().nonnegative(),
    posts: z.number().int().nonnegative(),
  }),
  isFollowing: z.boolean(),
})

export type PublicUserProfile = z.infer<typeof publicUserProfileSchema>

export const updateUserPreferencesSchema = z
  .object({
    themePreference: themePreferenceSchema.optional(),
  })
  .strict()
export type UpdateUserPreferencesInput = z.infer<typeof updateUserPreferencesSchema>
