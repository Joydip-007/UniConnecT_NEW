import { z } from 'zod'

export const PostTypeSchema = z.enum(['post', 'announcement', 'lost_found', 'news', 'event_promo'])
export const CreatePostTypeSchema = z.enum(['post', 'announcement', 'lost_found', 'event_promo'])
export const ReactionTypeSchema = z.enum(['like', 'love', 'insightful', 'celebrate'])

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export const PostListQuerySchema = PaginationQuerySchema.extend({
  type: PostTypeSchema.optional(),
  authorId: z.string().uuid().optional(),
})

export const CreatePostSchema = z.object({
  content: z.string().trim().min(1),
  media_urls: z.array(z.string().url()).default([]),
  type: CreatePostTypeSchema.default('post'),
  group_id: z.string().uuid().nullable().optional(),
  /** false → save as a private draft (author-only, not broadcast to the feed). */
  is_published: z.boolean().default(true),
  poll: z
    .object({
      question: z.string().trim().min(1).max(500),
      options: z.array(z.string().trim().min(1).max(255)).min(2).max(10),
      expires_at: z.string().datetime({ offset: true }).nullable().optional(),
    })
    .optional(),
})

export const UpdatePostSchema = z
  .object({
    content: z.string().trim().min(1).optional(),
    media_urls: z.array(z.string().url()).optional(),
    type: CreatePostTypeSchema.optional(),
    group_id: z.string().uuid().nullable().optional(),
    is_pinned: z.boolean().optional(),
    is_published: z.boolean().optional(),
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

export const CreateCommentSchema = z.object({
  content: z.string().trim().min(1),
  parent_id: z.string().uuid().nullable().optional(),
})

export const PollVoteSchema = z.object({
  poll_option_id: z.string().uuid().optional(),
  pollOptionId: z.string().uuid().optional(),
  optionId: z.string().uuid().optional(),
}).transform((value) => ({ poll_option_id: value.poll_option_id ?? value.pollOptionId ?? value.optionId })).refine((value) => Boolean(value.poll_option_id), {
  message: 'poll_option_id is required',
})

export type PostListQuery = z.infer<typeof PostListQuerySchema>
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>
export type CreatePostInput = z.infer<typeof CreatePostSchema>
export type UpdatePostInput = z.infer<typeof UpdatePostSchema>
export type ReactionInput = z.infer<typeof ReactionSchema>
export type CreateCommentInput = z.infer<typeof CreateCommentSchema>
export type PollVoteInput = z.infer<typeof PollVoteSchema>
