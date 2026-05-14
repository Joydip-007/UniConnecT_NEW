import { z } from 'zod'

export const GroupTypeSchema = z.enum(['department', 'club', 'batch', 'research', 'interest', 'other'])
export const GroupRoleSchema = z.enum(['owner', 'admin', 'moderator', 'member'])

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export const GroupListQuerySchema = PaginationQuerySchema.extend({
  type: GroupTypeSchema.optional(),
  search: z.string().trim().min(1).optional(),
})

export const CreateGroupSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().min(1),
  type: GroupTypeSchema,
  avatar_url: z.string().url().nullable().optional(),
  cover_url: z.string().url().nullable().optional(),
  is_private: z.boolean().default(false),
})

export const UpdateGroupSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().min(1).optional(),
    type: GroupTypeSchema.optional(),
    avatar_url: z.string().url().nullable().optional(),
    cover_url: z.string().url().nullable().optional(),
    is_private: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  })

export const UpdateMemberSchema = z.object({
  role: GroupRoleSchema,
})

export type GroupListQuery = z.infer<typeof GroupListQuerySchema>
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>
export type CreateGroupInput = z.infer<typeof CreateGroupSchema>
export type UpdateGroupInput = z.infer<typeof UpdateGroupSchema>
export type UpdateMemberInput = z.infer<typeof UpdateMemberSchema>
