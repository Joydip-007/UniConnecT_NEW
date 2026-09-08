import { z } from 'zod'

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const UpdateUserRoleSchema = z.object({
  role: z.enum(['student', 'alumni', 'faculty', 'admin']),
})

export const UpdateUserStatusSchema = z.object({
  is_active: z.boolean(),
})

export const ResolveReportSchema = z.object({
  status: z.enum(['reviewed', 'resolved', 'dismissed']),
})

export const ResolveReportGroupSchema = z.object({
  action: z.enum(['remove', 'dismiss']),
})

export const CreateInvitationSchema = z.object({
  email: z.string().email(),
  role: z.enum(['student', 'alumni', 'faculty', 'admin']).default('student'),
  expires_in_days: z.number().int().min(1).max(30).default(7),
})

export const CreateDriverSchema = z.object({
  full_name: z.string().trim().min(1).max(255),
  email: z.string().email(),
  password: z.string().min(8).max(128),
})

export const UpdateAllowedDomainsSchema = z.object({
  allowed_email_domains: z
    .array(z.string().trim().min(1).toLowerCase())
    .max(20, 'Maximum 20 allowed domains'),
})

export const CreateBulkInvitationsSchema = z.object({
  emails: z.array(z.string().email()).min(1).max(50),
  role: z.enum(['student', 'alumni', 'faculty', 'admin']).default('student'),
  expires_in_days: z.number().int().min(1).max(30).default(7),
  batch_label: z.string().trim().min(1).max(120),
})

export const ContentKindSchema = z.enum(['posts', 'events', 'jobs', 'news'])

export const ContentListQuerySchema = PaginationQuerySchema.extend({
  filter: z.enum(['all', 'pinned', 'published', 'unpublished', 'active', 'closed', 'announcement']).default('all'),
})

export const TogglePinSchema = z.object({
  is_pinned: z.boolean(),
})

export const TogglePublishSchema = z.object({
  is_published: z.boolean(),
})

export const ToggleActiveSchema = z.object({
  is_active: z.boolean(),
})

export const AdminRedemptionListSchema = PaginationQuerySchema.extend({
  status: z.enum(['pending', 'fulfilled', 'rejected']).optional(),
})

export const ListUsersQuerySchema = PaginationQuerySchema.extend({
  verified: z.enum(['unverified']).optional(),
})

export const AdminFulfillRedemptionSchema = z
  .object({
    status: z.enum(['fulfilled', 'rejected']),
    codeText: z.string().trim().min(1).max(200).optional(),
    adminNote: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.status !== 'fulfilled' || (v.codeText !== undefined && v.codeText.length > 0), {
    message: 'codeText is required when fulfilling a redemption',
    path: ['codeText'],
  })

export const ShuttleOpsSettingsSchema = z.object({
  liveGpsEnabled: z.boolean().optional(),
  riderEtaEnabled: z.boolean().optional(),
  autoAssignEnabled: z.boolean().optional(),
  serviceAlertsEnabled: z.boolean().optional(),
})

export type ShuttleOpsSettingsInput = z.infer<typeof ShuttleOpsSettingsSchema>

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>
export type UpdateUserRoleInput = z.infer<typeof UpdateUserRoleSchema>
export type UpdateUserStatusInput = z.infer<typeof UpdateUserStatusSchema>
export type ResolveReportInput = z.infer<typeof ResolveReportSchema>
export type ResolveReportGroupInput = z.infer<typeof ResolveReportGroupSchema>
export type CreateInvitationInput = z.infer<typeof CreateInvitationSchema>
export type CreateDriverInput = z.infer<typeof CreateDriverSchema>
export type UpdateAllowedDomainsInput = z.infer<typeof UpdateAllowedDomainsSchema>
export type CreateBulkInvitationsInput = z.infer<typeof CreateBulkInvitationsSchema>
export type ContentKind = z.infer<typeof ContentKindSchema>
export type ContentListQuery = z.infer<typeof ContentListQuerySchema>
export type TogglePinInput = z.infer<typeof TogglePinSchema>
export type TogglePublishInput = z.infer<typeof TogglePublishSchema>
export type ToggleActiveInput = z.infer<typeof ToggleActiveSchema>
export type AdminRedemptionListQuery = z.infer<typeof AdminRedemptionListSchema>
export type ListUsersQuery = z.infer<typeof ListUsersQuerySchema>
export type AdminFulfillRedemptionInput = z.infer<typeof AdminFulfillRedemptionSchema>
