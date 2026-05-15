"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateMessageSchema = exports.CreateMessageSchema = exports.MessageListQuerySchema = exports.UpdateConversationSchema = exports.CreateConversationSchema = exports.MessageTypeSchema = void 0;
const zod_1 = require("zod");
exports.MessageTypeSchema = zod_1.z.enum(['text', 'image', 'file', 'system']);
exports.CreateConversationSchema = zod_1.z
    .object({
    participantId: zod_1.z.string().uuid().optional(),
    name: zod_1.z.string().trim().min(1).max(255).optional(),
    is_group: zod_1.z.boolean().default(false),
    isGroup: zod_1.z.boolean().optional(),
    participantIds: zod_1.z.array(zod_1.z.string().uuid()).optional(),
})
    .transform((value) => ({
    participantId: value.participantId,
    name: value.name,
    is_group: value.is_group ?? value.isGroup ?? false,
    participantIds: value.participantIds,
}))
    .refine((value) => (value.is_group ? Boolean(value.name) : Boolean(value.participantId)), {
    message: 'Group conversations require name; direct conversations require participantId',
});
exports.UpdateConversationSchema = zod_1.z
    .object({
    name: zod_1.z.string().trim().min(1).max(255).optional(),
    avatar_url: zod_1.z.string().url().nullable().optional(),
    avatarUrl: zod_1.z.string().url().nullable().optional(),
})
    .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
})
    .transform((value) => ({
    name: value.name,
    avatar_url: value.avatar_url ?? value.avatarUrl,
}));
exports.MessageListQuerySchema = zod_1.z.object({
    before: zod_1.z.string().uuid().optional(),
    limit: zod_1.z.coerce.number().int().positive().max(100).default(20),
});
exports.CreateMessageSchema = zod_1.z
    .object({
    content: zod_1.z.string().trim().min(1).nullable().optional(),
    body: zod_1.z.string().trim().min(1).nullable().optional(),
    media_urls: zod_1.z.array(zod_1.z.string().url()).default([]),
    mediaUrls: zod_1.z.array(zod_1.z.string().url()).optional(),
    reply_to_id: zod_1.z.string().uuid().nullable().optional(),
    replyToId: zod_1.z.string().uuid().nullable().optional(),
    type: exports.MessageTypeSchema.default('text'),
})
    .transform((value) => ({
    content: value.content ?? value.body,
    media_urls: value.media_urls.length > 0 ? value.media_urls : (value.mediaUrls ?? []),
    reply_to_id: value.reply_to_id ?? value.replyToId,
    type: value.type,
}))
    .refine((value) => Boolean(value.content) || value.media_urls.length > 0 || value.type === 'system', {
    message: 'Message content or media is required',
});
exports.UpdateMessageSchema = zod_1.z
    .object({
    content: zod_1.z.string().trim().min(1).optional(),
    body: zod_1.z.string().trim().min(1).optional(),
})
    .transform((value) => ({ content: value.content ?? value.body }))
    .refine((value) => Boolean(value.content), {
    message: 'content is required',
});
