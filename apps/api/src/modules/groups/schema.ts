import { z } from 'zod'
import { ALLOWED_UPLOAD_CONTENT_TYPES } from '../../services/upload.service'

export const GroupTypeSchema = z.enum(['department', 'club', 'batch', 'research', 'interest', 'other', 'academic'])
export const GroupRoleSchema = z.enum(['owner', 'admin', 'moderator', 'member'])
export const AllowedRoleSchema = z.enum(['student', 'alumni', 'faculty', 'admin'])

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export const GroupListQuerySchema = PaginationQuerySchema.extend({
  type: GroupTypeSchema.optional(),
  search: z.string().trim().min(1).optional(),
})

export const MembersQuerySchema = PaginationQuerySchema.extend({
  search: z.string().trim().optional(),
  role: GroupRoleSchema.optional(),
})

export const CreateGroupSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().min(1),
  type: GroupTypeSchema,
  avatar_url: z.string().url().nullable().optional(),
  cover_url: z.string().url().nullable().optional(),
  is_private: z.boolean().default(false),
  allowed_role: AllowedRoleSchema.nullable().optional(),
})

export const UpdateGroupSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().min(1).optional(),
    type: GroupTypeSchema.optional(),
    avatar_url: z.string().url().nullable().optional(),
    cover_url: z.string().url().nullable().optional(),
    is_private: z.boolean().optional(),
    allowed_role: AllowedRoleSchema.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  })

export const UpdateMemberSchema = z.object({
  role: GroupRoleSchema,
})

export const InviteToGroupSchema = z.object({
  userId: z.string().uuid(),
})

export type GroupListQuery = z.infer<typeof GroupListQuerySchema>
export type MembersQuery = z.infer<typeof MembersQuerySchema>
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>
export type CreateGroupInput = z.infer<typeof CreateGroupSchema>
export type UpdateGroupInput = z.infer<typeof UpdateGroupSchema>
export type UpdateMemberInput = z.infer<typeof UpdateMemberSchema>
export type InviteToGroupInput = z.infer<typeof InviteToGroupSchema>
export type AllowedRole = z.infer<typeof AllowedRoleSchema>

// ── Join requests ─────────────────────────────────────────────
export const JoinGroupSchema = z.object({
  message: z.string().trim().max(500).optional(),
})

export const JoinRequestActionSchema = z.object({
  action: z.enum(['approve', 'decline']),
})

// ── Group resources ──────────────────────────────────────────
export const ResourceCategorySchema = z.enum(['notes', 'syllabus', 'past_papers', 'assignments', 'other'])

export const CreateResourceSchema = z.object({
  title: z.string().trim().min(1).max(255),
  url: z.string().url(),
  category: ResourceCategorySchema,
  description: z.string().trim().max(1000).optional(),
})

export const ResourceListQuerySchema = PaginationQuerySchema.extend({
  category: ResourceCategorySchema.optional(),
})

// ── Pinned announcement ───────────────────────────────────────
export const SetPinnedSchema = z.object({
  text: z.string().trim().max(1000).nullable(),
})

// ── Group rules / about ────────────────────────────────────────
export const SetRulesSchema = z.object({
  content: z.string().max(5000),
})

// ── Study sessions ────────────────────────────────────────────
export const CreateStudySessionSchema = z
  .object({
    title: z.string().trim().min(1).max(255),
    description: z.string().trim().optional(),
    location: z.string().trim().max(255).optional(),
    is_online: z.boolean().default(false),
    online_link: z.string().url().optional(),
    starts_at: z.string().datetime({ offset: true }),
    ends_at: z.string().datetime({ offset: true }).optional(),
    capacity: z.number().int().positive().optional(),
  })
  .refine((v) => !v.ends_at || new Date(v.ends_at) > new Date(v.starts_at), {
    message: 'ends_at must be after starts_at',
    path: ['ends_at'],
  })

export const RsvpStudySessionSchema = z.object({
  status: z.enum(['going', 'not_going']),
})

export const CreateFlashcardDeckSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).nullable().optional(),
})

export const UpdateFlashcardDeckSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    is_archived: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' })

export const CreateFlashcardSchema = z.object({
  front: z.string().trim().min(1).max(2000),
  back: z.string().trim().min(1).max(2000),
  hint: z.string().trim().max(500).nullable().optional(),
})

export const UpdateFlashcardSchema = z
  .object({
    front: z.string().trim().min(1).max(2000).optional(),
    back: z.string().trim().min(1).max(2000).optional(),
    hint: z.string().trim().max(500).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' })

export const FlashcardReviewSchema = z.object({
  rating: z.enum(['again', 'hard', 'good', 'easy']),
})

export const ALLOWED_NOTE_CONTENT_TYPES = ALLOWED_UPLOAD_CONTENT_TYPES

export const AttachmentSchema = z.object({
  name: z.string().max(255),
  url: z.string().url(),
  contentType: z.enum(ALLOWED_NOTE_CONTENT_TYPES),
  size: z.number().int().max(26214400),
})

export const NoteUploadUrlRequestSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.enum(ALLOWED_NOTE_CONTENT_TYPES),
})

export const CreateSharedNoteSchema = z.object({
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(10000),
  attachments: z.array(AttachmentSchema).max(5).optional().default([]),
})

export const UpdateSharedNoteSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    body: z.string().trim().min(1).max(10000).optional(),
    attachments: z.array(AttachmentSchema).max(5).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' })

export type JoinGroupInput = z.infer<typeof JoinGroupSchema>
export type JoinRequestActionInput = z.infer<typeof JoinRequestActionSchema>
export type ResourceCategory = z.infer<typeof ResourceCategorySchema>
export type CreateResourceInput = z.infer<typeof CreateResourceSchema>
export type ResourceListQuery = z.infer<typeof ResourceListQuerySchema>
export type SetPinnedInput = z.infer<typeof SetPinnedSchema>
export type SetRulesInput = z.infer<typeof SetRulesSchema>
export type CreateStudySessionInput = z.infer<typeof CreateStudySessionSchema>
export type RsvpStudySessionInput = z.infer<typeof RsvpStudySessionSchema>
export type CreateFlashcardDeckInput = z.infer<typeof CreateFlashcardDeckSchema>
export type UpdateFlashcardDeckInput = z.infer<typeof UpdateFlashcardDeckSchema>
export type CreateFlashcardInput = z.infer<typeof CreateFlashcardSchema>
export type UpdateFlashcardInput = z.infer<typeof UpdateFlashcardSchema>
export type FlashcardReviewInput = z.infer<typeof FlashcardReviewSchema>
export type Attachment = z.infer<typeof AttachmentSchema>
export type NoteUploadUrlRequest = z.infer<typeof NoteUploadUrlRequestSchema>
export type CreateSharedNoteInput = z.infer<typeof CreateSharedNoteSchema>
export type UpdateSharedNoteInput = z.infer<typeof UpdateSharedNoteSchema>

// ── AI settings (academic groups) ────────────────────────────
export const AISettingsSchema = z.object({
  ai_flashcards_enabled: z.boolean().default(false),
  ai_quiz_enabled: z.boolean().default(false),
  require_approval: z.boolean().default(false),
  subject: z.string().max(255).optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  question_style: z.enum(['mcq', 'true_false', 'short_answer', 'mixed']).optional(),
  language: z.enum(['en', 'bn']).default('en'),
  custom_instructions: z.string().max(1000).optional(),
  items_per_run: z.number().int().min(1).max(20).default(10),
  frequency: z.enum(['daily', 'weekly']).default('daily'),
  run_hour: z.number().int().min(0).max(23).default(2),
  run_weekday: z.number().int().min(0).max(6).optional(),
})

export const UpdateGroupAISettingsSchema = AISettingsSchema.partial()

export type AISettingsInput = z.infer<typeof AISettingsSchema>
export type UpdateGroupAISettingsInput = z.infer<typeof UpdateGroupAISettingsSchema>

// ── Session notes (creator + per-member private) ─────────────
export const PutSessionCreatorNotesSchema = z.object({
  title: z.string().max(255).optional(),
  body: z.string().optional(),
  attachments: z.array(AttachmentSchema).max(5).optional(),
})

export const PutSessionPrivateNotesSchema = z.object({
  body: z.string().optional(),
  attachments: z.array(AttachmentSchema).max(5).optional(),
})

export const UploadUrlQuerySchema = z.object({
  fileName: z.string().min(1),
  contentType: z.enum(ALLOWED_NOTE_CONTENT_TYPES),
})

export type PutSessionCreatorNotesInput = z.infer<typeof PutSessionCreatorNotesSchema>
export type PutSessionPrivateNotesInput = z.infer<typeof PutSessionPrivateNotesSchema>
export type UploadUrlQuery = z.infer<typeof UploadUrlQuerySchema>
