"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PollVoteSchema = exports.CreateCommentSchema = exports.ReactionSchema = exports.UpdatePostSchema = exports.CreatePostSchema = exports.PostListQuerySchema = exports.PaginationQuerySchema = exports.ReactionTypeSchema = exports.CreatePostTypeSchema = exports.PostTypeSchema = void 0;
const zod_1 = require("zod");
exports.PostTypeSchema = zod_1.z.enum(['post', 'announcement', 'lost_found', 'news', 'event_promo']);
exports.CreatePostTypeSchema = zod_1.z.enum(['post', 'announcement', 'lost_found', 'event_promo']);
exports.ReactionTypeSchema = zod_1.z.enum(['like', 'love', 'insightful', 'celebrate']);
exports.PaginationQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).default(20),
});
exports.PostListQuerySchema = exports.PaginationQuerySchema.extend({
    type: exports.PostTypeSchema.optional(),
});
exports.CreatePostSchema = zod_1.z.object({
    content: zod_1.z.string().trim().min(1),
    media_urls: zod_1.z.array(zod_1.z.string().url()).default([]),
    type: exports.CreatePostTypeSchema.default('post'),
    group_id: zod_1.z.string().uuid().nullable().optional(),
    poll: zod_1.z
        .object({
        question: zod_1.z.string().trim().min(1).max(500),
        options: zod_1.z.array(zod_1.z.string().trim().min(1).max(255)).min(2).max(10),
        expires_at: zod_1.z.string().datetime({ offset: true }).nullable().optional(),
    })
        .optional(),
});
exports.UpdatePostSchema = zod_1.z
    .object({
    content: zod_1.z.string().trim().min(1).optional(),
    media_urls: zod_1.z.array(zod_1.z.string().url()).optional(),
    type: exports.CreatePostTypeSchema.optional(),
    group_id: zod_1.z.string().uuid().nullable().optional(),
    is_pinned: zod_1.z.boolean().optional(),
})
    .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
});
exports.ReactionSchema = zod_1.z.object({
    reaction_type: exports.ReactionTypeSchema.optional(),
    reactionType: exports.ReactionTypeSchema.optional(),
}).transform((value) => ({ reaction_type: value.reaction_type ?? value.reactionType })).refine((value) => Boolean(value.reaction_type), {
    message: 'reaction_type is required',
});
exports.CreateCommentSchema = zod_1.z.object({
    content: zod_1.z.string().trim().min(1),
    parent_id: zod_1.z.string().uuid().nullable().optional(),
});
exports.PollVoteSchema = zod_1.z.object({
    poll_option_id: zod_1.z.string().uuid().optional(),
    pollOptionId: zod_1.z.string().uuid().optional(),
    optionId: zod_1.z.string().uuid().optional(),
}).transform((value) => ({ poll_option_id: value.poll_option_id ?? value.pollOptionId ?? value.optionId })).refine((value) => Boolean(value.poll_option_id), {
    message: 'poll_option_id is required',
});
