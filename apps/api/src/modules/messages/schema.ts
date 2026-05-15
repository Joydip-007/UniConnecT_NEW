import { z } from 'zod'

export const MessageTypeSchema = z.enum(['text', 'image', 'file', 'system'])

export const CreateConversationSchema = z
  .object({
    participantId: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(255).optional(),
    is_group: z.boolean().default(false),
    isGroup: z.boolean().optional(),
    participantIds: z.array(z.string().uuid()).optional(),
  })
  .transform((value) => ({
    participantId: value.participantId,
    name: value.name,
    is_group: value.is_group ?? value.isGroup ?? false,
    participantIds: value.participantIds,
  }))
  .refine((value) => (value.is_group ? Boolean(value.name) : Boolean(value.participantId)), {
    message: 'Group conversations require name; direct conversations require participantId',
  })

export const UpdateConversationSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    avatar_url: z.string().url().nullable().optional(),
    avatarUrl: z.string().url().nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  })
  .transform((value) => ({
    name: value.name,
    avatar_url: value.avatar_url ?? value.avatarUrl,
  }))

export const MessageListQuerySchema = z.object({
  before: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export const CreateMessageSchema = z
  .object({
    content: z.string().trim().min(1).nullable().optional(),
    body: z.string().trim().min(1).nullable().optional(),
    media_urls: z.array(z.string().url()).default([]),
    mediaUrls: z.array(z.string().url()).optional(),
    reply_to_id: z.string().uuid().nullable().optional(),
    replyToId: z.string().uuid().nullable().optional(),
    type: MessageTypeSchema.default('text'),
  })
  .transform((value) => ({
    content: value.content ?? value.body,
    media_urls: value.media_urls.length > 0 ? value.media_urls : (value.mediaUrls ?? []),
    reply_to_id: value.reply_to_id ?? value.replyToId,
    type: value.type,
  }))
  .refine((value) => Boolean(value.content) || value.media_urls.length > 0 || value.type === 'system', {
    message: 'Message content or media is required',
  })

export const UpdateMessageSchema = z
  .object({
    content: z.string().trim().min(1).optional(),
    body: z.string().trim().min(1).optional(),
  })
  .transform((value) => ({ content: value.content ?? value.body }))
  .refine((value) => Boolean(value.content), {
    message: 'content is required',
  })

export type CreateConversationInput = z.infer<typeof CreateConversationSchema>
export type UpdateConversationInput = z.infer<typeof UpdateConversationSchema>
export type MessageListQuery = z.infer<typeof MessageListQuerySchema>
export type CreateMessageInput = z.infer<typeof CreateMessageSchema>
export type UpdateMessageInput = z.infer<typeof UpdateMessageSchema>
