import { z } from 'zod'

export const profileExperienceSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string(),
  company: z.string(),
  location: z.string().nullable(),
  startDate: z.union([z.string(), z.date()]),
  endDate: z.union([z.string(), z.date()]).nullable(),
  description: z.string().nullable(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
})

export const profileEducationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  institution: z.string(),
  degree: z.string().nullable(),
  fieldOfStudy: z.string().nullable(),
  startYear: z.number().int(),
  endYear: z.number().int().nullable(),
  grade: z.string().nullable(),
  description: z.string().nullable(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
})

export const profileFeaturedSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  type: z.enum(['post', 'link']),
  postId: z.string().uuid().nullable(),
  linkUrl: z.string().nullable(),
  linkTitle: z.string().nullable(),
  linkDescription: z.string().nullable(),
  displayOrder: z.number().int(),
  createdAt: z.union([z.string(), z.date()]),
})

export const profileAnalyticsSchema = z.object({
  profileViews: z.object({
    last7d: z.number().int().nonnegative(),
    last30d: z.number().int().nonnegative(),
    last90d: z.number().int().nonnegative(),
  }),
  postReach: z.object({
    reactions: z.number().int().nonnegative(),
    comments: z.number().int().nonnegative(),
    shares: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  }),
})

export const profileViewerSchema = z.object({
  viewedAt: z.union([z.string(), z.date()]),
  anonymous: z.boolean(),
  // Present when anonymous=false
  id: z.string().uuid().optional(),
  fullName: z.string().optional(),
  avatarUrl: z.string().nullable().optional(),
  headline: z.string().nullable().optional(),
  role: z.enum(['student', 'alumni', 'faculty', 'admin']).optional(),
  department: z.string().nullable().optional(),
  connectionStatus: z.enum(['none', 'pending_sent', 'pending_received', 'connected']).optional(),
})

export const jobMatchSchema = z.object({
  matched: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  percentage: z.number().nonnegative(),
}).nullable()

export type ProfileExperience = z.infer<typeof profileExperienceSchema>
export type ProfileEducation = z.infer<typeof profileEducationSchema>
export type ProfileFeatured = z.infer<typeof profileFeaturedSchema>
export type ProfileAnalytics = z.infer<typeof profileAnalyticsSchema>
export type ProfileViewer = z.infer<typeof profileViewerSchema>
export type JobMatch = z.infer<typeof jobMatchSchema>
