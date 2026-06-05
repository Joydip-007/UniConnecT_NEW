import { z } from 'zod'
import type { ThemePreference } from '../types/user'

export const userRoleSchema = z.enum(['student', 'alumni', 'faculty', 'admin', 'driver'])

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
