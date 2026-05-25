import { z } from 'zod'

const optionalString = z.string().trim().nullable().optional()

export const UpdateProfileSchema = z
  .object({
    fullName: z.string().trim().min(1).optional(),
    bio: optionalString,
    headline: optionalString,
    department: optionalString,
    batchYear: optionalString,
    linkedinUrl: optionalString,
    phone: optionalString,
    skills: z.array(z.string().trim().min(1)).optional(),
    avatarUrl: optionalString,
    coverUrl: optionalString,
    isOpenToWork: z.boolean().optional(),
    isOpenToMentorship: z.boolean().optional(),
    maxMentees: z.number().int().min(1).max(20).optional(),
    location: z.string().max(100).nullable().optional(),
    websiteUrl: z.string().url().nullable().optional(),
    githubUrl: z.string().url().nullable().optional(),
    portfolioUrl: z.string().url().nullable().optional(),
    isOpenToMsg: z.boolean().optional(),
  })
  .strict()

export const UserListQuerySchema = z.object({
  role: z.enum(['student', 'alumni', 'faculty', 'admin']).optional(),
  department: z.string().trim().min(1).optional(),
  batch_year: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>
export type UserListQuery = z.infer<typeof UserListQuerySchema>
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>

export const UpdatePreferencesSchema = z
  .object({
    themePreference: z.enum(['light', 'dark', 'system']).optional(),
  })
  .strict()

export type UpdatePreferencesInput = z.infer<typeof UpdatePreferencesSchema>

export const ExperienceSchema = z.object({
  title: z.string().min(1).max(200),
  company: z.string().min(1).max(200),
  location: z.string().max(200).nullable().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
})

export const EducationSchema = z.object({
  institution: z.string().min(1).max(300),
  degree: z.string().max(200).nullable().optional(),
  fieldOfStudy: z.string().max(200).nullable().optional(),
  startYear: z.number().int().min(1950).max(2100),
  endYear: z.number().int().min(1950).max(2100).nullable().optional(),
  grade: z.string().max(50).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
})

export const FeaturedSchema = z.object({
  type: z.enum(['post', 'link']),
  postId: z.string().uuid().nullable().optional(),
  linkUrl: z.string().url().nullable().optional(),
  linkTitle: z.string().max(200).nullable().optional(),
  linkDescription: z.string().max(500).nullable().optional(),
})

export const ReorderFeaturedSchema = z.object({
  order: z.array(z.string().uuid()), // array of featured item IDs in desired order
})

export type ExperienceInput = z.infer<typeof ExperienceSchema>
export type EducationInput = z.infer<typeof EducationSchema>
export type FeaturedInput = z.infer<typeof FeaturedSchema>
export type ReorderFeaturedInput = z.infer<typeof ReorderFeaturedSchema>
