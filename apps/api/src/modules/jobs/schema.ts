import { z } from 'zod'
import { attachmentInputSchema, MAX_ATTACHMENTS_PER_ENTITY } from '@uniconnect/shared'

const attachmentsField = z.array(attachmentInputSchema).max(MAX_ATTACHMENTS_PER_ENTITY).optional()
const removedAttachmentIdsField = z.array(z.string().uuid()).optional()

export const JobTypeSchema = z.enum(['full_time', 'part_time', 'internship', 'remote', 'contract'])
export const ApplicationStatusSchema = z.enum([
  'pending',
  'reviewed',
  'shortlisted',
  'interviewed',
  'offered',
  'rejected',
])

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export const JobListQuerySchema = PaginationQuerySchema.extend({
  type: JobTypeSchema.optional(),
  search: z.string().trim().min(1).optional(),
  location: z.string().trim().min(1).optional(),
})

export const CreateJobSchema = z
  .object({
    title: z.string().trim().min(1).max(255),
    company: z.string().trim().min(1).max(255),
    location: z.string().trim().min(1).max(255),
    type: JobTypeSchema,
    description: z.string().trim().min(1),
    requirements: z.array(z.string().trim().min(1)).default([]),
    salary_range: z.string().trim().max(100).nullable().optional(),
    salaryRange: z.string().trim().max(100).nullable().optional(),
    application_url: z.string().url().nullable().optional(),
    applicationUrl: z.string().url().nullable().optional(),
    deadline: z.string().datetime({ offset: true }),
    is_published: z.boolean().optional(),
    isPublished: z.boolean().optional(),
    attachments: attachmentsField,
  })
  .transform((value) => ({
    title: value.title,
    company: value.company,
    location: value.location,
    type: value.type,
    description: value.description,
    requirements: value.requirements,
    salary_range: value.salary_range ?? value.salaryRange,
    application_url: value.application_url ?? value.applicationUrl,
    deadline: value.deadline,
    is_published: value.is_published ?? value.isPublished ?? true,
    attachments: value.attachments,
  }))

export const UpdateJobSchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    company: z.string().trim().min(1).max(255).optional(),
    location: z.string().trim().min(1).max(255).optional(),
    type: JobTypeSchema.optional(),
    description: z.string().trim().min(1).optional(),
    requirements: z.array(z.string().trim().min(1)).optional(),
    salary_range: z.string().trim().max(100).nullable().optional(),
    salaryRange: z.string().trim().max(100).nullable().optional(),
    application_url: z.string().url().nullable().optional(),
    applicationUrl: z.string().url().nullable().optional(),
    deadline: z.string().datetime({ offset: true }).optional(),
    is_active: z.boolean().optional(),
    isActive: z.boolean().optional(),
    is_published: z.boolean().optional(),
    isPublished: z.boolean().optional(),
    attachments: attachmentsField,
    removedAttachmentIds: removedAttachmentIdsField,
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  })
  .transform((value) => ({
    title: value.title,
    company: value.company,
    location: value.location,
    type: value.type,
    description: value.description,
    requirements: value.requirements,
    salary_range: value.salary_range ?? value.salaryRange,
    application_url: value.application_url ?? value.applicationUrl,
    deadline: value.deadline,
    is_active: value.is_active ?? value.isActive,
    is_published: value.is_published ?? value.isPublished,
    attachments: value.attachments,
    removedAttachmentIds: value.removedAttachmentIds,
  }))

export const ApplyJobSchema = z
  .object({
    resume_url: z.string().url().nullable().optional(),
    resumeUrl: z.string().url().nullable().optional(),
    cover_letter: z.string().trim().nullable().optional(),
    coverLetter: z.string().trim().nullable().optional(),
  })
  .transform((value) => ({
    resume_url: value.resume_url ?? value.resumeUrl,
    cover_letter: value.cover_letter ?? value.coverLetter,
  }))

export const UpdateApplicationSchema = z
  .object({
    status: ApplicationStatusSchema.optional(),
    notes: z.string().trim().nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  })

export type JobListQuery = z.infer<typeof JobListQuerySchema>
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>
export type CreateJobInput = z.infer<typeof CreateJobSchema>
export type UpdateJobInput = z.infer<typeof UpdateJobSchema>
export type ApplyJobInput = z.infer<typeof ApplyJobSchema>
export type UpdateApplicationInput = z.infer<typeof UpdateApplicationSchema>
