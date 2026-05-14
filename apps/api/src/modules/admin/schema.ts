import { z } from 'zod'

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const UpdateUserRoleSchema = z.object({
  role: z.enum(['student', 'alumni', 'staff', 'admin']),
})

export const UpdateUserStatusSchema = z.object({
  is_active: z.boolean(),
})

export const ResolveReportSchema = z.object({
  status: z.enum(['reviewed', 'resolved', 'dismissed']),
})

export const CreateInvitationSchema = z.object({
  email: z.string().email(),
  role: z.enum(['student', 'alumni', 'staff', 'admin']).default('student'),
  expires_in_days: z.number().int().min(1).max(30).default(7),
})

export const UpdateAllowedDomainsSchema = z.object({
  allowed_email_domains: z
    .array(z.string().trim().min(1).toLowerCase())
    .max(20, 'Maximum 20 allowed domains'),
})

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>
export type UpdateUserRoleInput = z.infer<typeof UpdateUserRoleSchema>
export type UpdateUserStatusInput = z.infer<typeof UpdateUserStatusSchema>
export type ResolveReportInput = z.infer<typeof ResolveReportSchema>
export type CreateInvitationInput = z.infer<typeof CreateInvitationSchema>
export type UpdateAllowedDomainsInput = z.infer<typeof UpdateAllowedDomainsSchema>
