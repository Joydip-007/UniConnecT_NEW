import { z } from 'zod'

/** A nullable URL field that also treats an empty string as "cleared". */
const nullableUrl = z
  .union([z.string().url(), z.literal(''), z.null()])
  .transform((value) => (value ? value : null))
  .optional()

/** Per-tenant content-sync configuration, edited from the admin panel (admin-only). */
export const contentSyncConfigSchema = z.object({
  newsUrl: nullableUrl,
  noticeUrl: nullableUrl,
  eventUrl: nullableUrl,
  enabled: z.boolean().optional(),
})

export type ContentSyncConfigInput = z.infer<typeof contentSyncConfigSchema>

export interface ContentSyncConfig {
  newsUrl: string | null
  noticeUrl: string | null
  eventUrl: string | null
  enabled: boolean
}

export const CONTENT_SYNC_SOURCES = ['news', 'notice', 'event'] as const
export type ContentSyncSource = (typeof CONTENT_SYNC_SOURCES)[number]

/** Allowed event types — must mirror the events_type_check DB constraint. */
export const EVENT_SUB_CATEGORIES = [
  'general',
  'career_fair',
  'seminar',
  'alumni_meetup',
  'workshop',
  'club',
] as const

/**
 * Single source of truth for what the Skyvern extraction returns per detail page.
 * The worker validates Skyvern's output against this before touching the DB.
 */
export const skyvernAttachmentSchema = z.object({
  url: z.string().url(),
  fileName: z.string().trim().min(1).optional(),
})

export const skyvernItemSchema = z.object({
  sourceUrl: z.string().url(),
  title: z.string().trim().min(1),
  body: z.string().trim().min(1),
  publishedDate: z.string().trim().optional(),
  subCategory: z.string().trim().optional(),
  /** Event-only fields (ignored for news/notice). startsAt is required to create an event. */
  startsAt: z.string().trim().optional(),
  endsAt: z.string().trim().optional(),
  location: z.string().trim().optional(),
  coverUrl: z.string().url().optional(),
  attachments: z.array(skyvernAttachmentSchema).default([]),
})

export const skyvernListItemSchema = z.object({
  sourceUrl: z.string().url(),
  title: z.string().trim().min(1).optional(),
  publishedDate: z.string().trim().optional(),
})

export type SkyvernAttachment = z.infer<typeof skyvernAttachmentSchema>
export type SkyvernItem = z.infer<typeof skyvernItemSchema>
export type SkyvernListItem = z.infer<typeof skyvernListItemSchema>

export type ContentSyncRunStatus = 'running' | 'success' | 'failed'

export interface ContentSyncRun {
  id: string
  status: ContentSyncRunStatus
  itemsFound: number
  itemsNew: number
  error: string | null
  startedAt: string
  finishedAt: string | null
}

export type ContentAttachmentStatus = 'pending' | 'done' | 'failed'

export interface ContentAttachment {
  id: string
  entityType: 'news' | 'event'
  entityId: string
  fileUrl: string | null
  fileName: string
  mimeType: string | null
  sizeBytes: number | null
  downloadStatus: ContentAttachmentStatus
}
