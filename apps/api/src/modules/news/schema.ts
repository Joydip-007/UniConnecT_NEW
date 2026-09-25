import { z } from 'zod'
import { attachmentInputSchema, MAX_ATTACHMENTS_PER_ENTITY } from '@uniconnect/shared'

const attachmentsField = z.array(attachmentInputSchema).max(MAX_ATTACHMENTS_PER_ENTITY).optional()
const removedAttachmentIdsField = z.array(z.string().uuid()).optional()
const summaryField = z.string().trim().max(400).nullable().optional()
// Lowercased, de-duplicated and capped so the rail's "trending now" counts group cleanly.
const tagsField = z
  .array(z.string().trim().min(1).max(40))
  .max(8)
  .transform((tags) => [...new Set(tags.map((tag) => tag.toLowerCase().replace(/^#/, '')))])
  .optional()
const keyDateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .nullable()
  .optional()

export const NewsListQuerySchema = z.object({
  category: z.string().trim().min(1).optional(),
  tag: z.string().trim().min(1).max(40).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export const CreateNewsSchema = z.object({
  title: z.string().trim().min(1).max(500),
  body: z.string().trim().min(1),
  cover_url: z.string().url().nullable().optional(),
  category: z.string().trim().min(1).max(100),
  summary: summaryField,
  tags: tagsField,
  key_date: keyDateField,
  is_published: z.boolean().default(false),
  is_pinned: z.boolean().default(false),
  attachments: attachmentsField,
})

export const UpdateNewsSchema = z
  .object({
    title: z.string().trim().min(1).max(500).optional(),
    body: z.string().trim().min(1).optional(),
    cover_url: z.string().url().nullable().optional(),
    category: z.string().trim().min(1).max(100).optional(),
    summary: summaryField,
    tags: tagsField,
    key_date: keyDateField,
    is_published: z.boolean().optional(),
    is_pinned: z.boolean().optional(),
    attachments: attachmentsField,
    removedAttachmentIds: removedAttachmentIdsField,
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  })

export type NewsListQuery = z.infer<typeof NewsListQuerySchema>
export type CreateNewsInput = z.infer<typeof CreateNewsSchema>
export type UpdateNewsInput = z.infer<typeof UpdateNewsSchema>
