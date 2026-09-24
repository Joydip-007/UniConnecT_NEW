import { z } from 'zod'
import { conversationPreferencesSchema, messageAttachmentsSchema } from '@uniconnect/shared'

export const MessageTypeSchema = z.enum(['text', 'image', 'file', 'system', 'sticker'])
export const MessageReactionTypeSchema = z.enum(['like', 'love', 'care', 'haha', 'wow', 'angry'])
export const MessageReactionSchema = z.object({ reaction_type: MessageReactionTypeSchema })
export type MessageReactionType = z.infer<typeof MessageReactionTypeSchema>
export type MessageReactionInput = z.infer<typeof MessageReactionSchema>

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
    sticker_url: z.string().url().nullable().optional(),
    stickerUrl: z.string().url().nullable().optional(),
    attachments: messageAttachmentsSchema.optional(),
    view_once: z.boolean().optional(),
    viewOnce: z.boolean().optional(),
  })
  .transform((value) => ({
    content: value.content ?? value.body,
    media_urls: value.media_urls.length > 0 ? value.media_urls : (value.mediaUrls ?? []),
    reply_to_id: value.reply_to_id ?? value.replyToId,
    type: value.type,
    sticker_url: value.sticker_url ?? value.stickerUrl ?? null,
    attachments: value.attachments ?? [],
    view_once: value.view_once ?? value.viewOnce ?? false,
  }))
  .refine(
    (value) =>
      Boolean(value.content) ||
      value.media_urls.length > 0 ||
      value.attachments.length > 0 ||
      value.type === 'system' ||
      (value.type === 'sticker' && Boolean(value.sticker_url)),
    { message: 'Message content or media is required' },
  )
  .refine(
    (value) =>
      !value.view_once ||
      (value.attachments.length === 1 && value.attachments[0]!.mimeType.startsWith('image/')),
    { message: 'View once is only available for a single photo', path: ['view_once'] },
  )

export const UpdateMessageSchema = z
  .object({
    content: z.string().trim().min(1).optional(),
    body: z.string().trim().min(1).optional(),
  })
  .transform((value) => ({ content: value.content ?? value.body }))
  .refine((value) => Boolean(value.content), {
    message: 'content is required',
  })

export const ConversationPreferencesSchema = conversationPreferencesSchema

export const SharedFilesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).default(20),
})

export type ConversationPreferencesInput = z.infer<typeof ConversationPreferencesSchema>
export type SharedFilesQuery = z.infer<typeof SharedFilesQuerySchema>
export type CreateConversationInput = z.infer<typeof CreateConversationSchema>
export type UpdateConversationInput = z.infer<typeof UpdateConversationSchema>
export type MessageListQuery = z.infer<typeof MessageListQuerySchema>
export type CreateMessageInput = z.infer<typeof CreateMessageSchema>
export type UpdateMessageInput = z.infer<typeof UpdateMessageSchema>
