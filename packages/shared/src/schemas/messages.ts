import { z } from 'zod'
import { MAX_ATTACHMENTS_PER_ENTITY, MAX_ATTACHMENT_SIZE_BYTES } from '../constants/attachments'

/** Bubble + send-button colour a viewer picks for one thread ("Customize chatbox"). */
export const chatThemeSchema = z.enum(['indigo', 'mint', 'amber', 'cyan', 'rose'])
export type ChatTheme = z.infer<typeof chatThemeSchema>

/** The quick-send emojis offered in "Customize chatbox". */
export const QUICK_EMOJIS = ['👍', '❤️', '😂', '🔥', '🎉', '🙏'] as const
export const quickEmojiSchema = z.enum(QUICK_EMOJIS)

/** One uploaded file on a message. The bytes live in object storage; this is its metadata. */
export const messageAttachmentSchema = z.object({
  url: z.string().url(),
  name: z.string().trim().min(1).max(255),
  size: z.number().int().nonnegative().max(MAX_ATTACHMENT_SIZE_BYTES),
  mimeType: z.string().trim().max(255).default('application/octet-stream'),
})
export type MessageAttachment = z.infer<typeof messageAttachmentSchema>

export const messageAttachmentsSchema = z.array(messageAttachmentSchema).max(MAX_ATTACHMENTS_PER_ENTITY)

/** PATCH /conversations/:convId/preferences — the viewer's own settings for a thread. No defaults: it is a partial write. */
export const conversationPreferencesSchema = z
  .object({
    isPinned: z.boolean().optional(),
    isMuted: z.boolean().optional(),
    chatTheme: chatThemeSchema.optional(),
    quickEmoji: quickEmojiSchema.optional(),
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), {
    message: 'At least one preference is required',
  })
export type ConversationPreferencesInput = z.infer<typeof conversationPreferencesSchema>
