import { z } from 'zod'

const optionalString = z.string().trim().nullable().optional()

export const UpdateProfileSchema = z.object({
  full_name: z.string().trim().min(1).optional(),
  bio: optionalString,
  headline: optionalString,
  department: optionalString,
  batch_year: optionalString,
  linkedin_url: optionalString,
  phone: optionalString,
  skills: z.array(z.string().trim().min(1)).optional(),
  avatar_url: optionalString,
  cover_url: optionalString,
  is_open_to_work: z.boolean().optional(),
})

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
