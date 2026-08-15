import { z } from 'zod'
import { attachmentInputSchema, FEED_SORTS, MAX_ATTACHMENTS_PER_ENTITY } from '@uniconnect/shared'

const attachmentsField = z.array(attachmentInputSchema).max(MAX_ATTACHMENTS_PER_ENTITY).optional()
const removedAttachmentIdsField = z.array(z.string().uuid()).optional()

export const PostTypeSchema = z.enum(['post', 'announcement', 'lost_found', 'news', 'event_promo', 'job_promo'])
export const CreatePostTypeSchema = z.enum(['post', 'announcement', 'lost_found', 'event_promo', 'job_promo'])
export const ReactionTypeSchema = z.enum(['like', 'love', 'care', 'haha', 'wow', 'sad', 'angry'])

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

/**
 * `scope` narrows *which* posts are in play, independently of their `type`.
 * `my_groups` restricts the feed to groups the caller belongs to — group membership is
 * a relationship, not a post type, so it cannot be folded into `type`.
 */
export const PostScopeSchema = z.enum(['my_groups'])

export const PostListQuerySchema = PaginationQuerySchema.extend({
  type: PostTypeSchema.optional(),
  scope: PostScopeSchema.optional(),
  authorId: z.string().uuid().optional(),
  sort: z.enum(FEED_SORTS).default('recent'),
})

export const CreatePostSchema = z.object({
  content: z.string().trim().min(1),
  media_urls: z.array(z.string().url()).default([]),
  attachments: attachmentsField,
  type: CreatePostTypeSchema.default('post'),
  group_id: z.string().uuid().nullable().optional(),
  /** false → save as a private draft (author-only, not broadcast to the feed). */
  is_published: z.boolean().default(true),
  /** Future ISO timestamp → schedule the post; it stays unpublished until then. */
  publish_at: z.string().datetime({ offset: true }).nullable().optional(),
  poll: z
    .object({
      question: z.string().trim().min(1).max(500),
      options: z.array(z.string().trim().min(1).max(255)).min(2).max(10),
      expires_at: z.string().datetime({ offset: true }).nullable().optional(),
    })
    .optional(),
  hide_reaction_counts: z.boolean().optional(),
  comments_disabled: z.boolean().optional(),
  shares_disabled: z.boolean().optional(),
})

export const SharePostSchema = z.object({
  caption: z.string().trim().max(500).optional(),
})

export const UpdatePostSchema = z
  .object({
    content: z.string().trim().min(1).optional(),
    media_urls: z.array(z.string().url()).optional(),
    attachments: attachmentsField,
    removedAttachmentIds: removedAttachmentIdsField,
    type: CreatePostTypeSchema.optional(),
    group_id: z.string().uuid().nullable().optional(),
    is_pinned: z.boolean().optional(),
    is_published: z.boolean().optional(),
    /** Set a future time to (re)schedule; null to cancel scheduling (back to draft). */
    publish_at: z.string().datetime({ offset: true }).nullable().optional(),
    /** Set a future time to auto-archive; null to clear the auto-expiry. */
    expires_at: z.string().datetime({ offset: true }).nullable().optional(),
    hide_reaction_counts: z.boolean().optional(),
    comments_disabled: z.boolean().optional(),
    shares_disabled: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  })

export const ReactionSchema = z.object({
  reaction_type: ReactionTypeSchema.optional(),
  reactionType: ReactionTypeSchema.optional(),
}).transform((value) => ({ reaction_type: value.reaction_type ?? value.reactionType })).refine((value) => Boolean(value.reaction_type), {
  message: 'reaction_type is required',
})

export const CreateCommentSchema = z
  .object({
    content: z.string().trim().optional().default(''),
    parent_id: z.string().uuid().nullable().optional(),
    media_urls: z.array(z.string().url()).default([]),
  })
  .superRefine((val, ctx) => {
    if (!val.content && val.media_urls.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Comment must have text or media', path: ['content'] })
    }
  })

export const PollVoteSchema = z.object({
  poll_option_id: z.string().uuid().optional(),
  pollOptionId: z.string().uuid().optional(),
  optionId: z.string().uuid().optional(),
}).transform((value) => ({ poll_option_id: value.poll_option_id ?? value.pollOptionId ?? value.optionId })).refine((value) => Boolean(value.poll_option_id), {
  message: 'poll_option_id is required',
})

export const ReactionsQuerySchema = z.object({
  type: z.enum(['like', 'love', 'care', 'haha', 'wow', 'sad', 'angry']).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(50).default(20),
})

export type PostListQuery = z.infer<typeof PostListQuerySchema>
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>
export type CreatePostInput = z.infer<typeof CreatePostSchema>
export type UpdatePostInput = z.infer<typeof UpdatePostSchema>
export type ReactionInput = z.infer<typeof ReactionSchema>
export type CreateCommentInput = z.infer<typeof CreateCommentSchema>

export type PollVoteInput = z.infer<typeof PollVoteSchema>
export type SharePostInput = z.infer<typeof SharePostSchema>
export type ReactionsQuery = z.infer<typeof ReactionsQuerySchema>
