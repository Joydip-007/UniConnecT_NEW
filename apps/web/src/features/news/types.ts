import type { AttachmentInput, ContentAttachment, UserRole } from '@uniconnect/shared'

/** The four categories the board is filtered by and an article is filed under. */
export const NEWS_CATEGORIES = ['notice', 'academic', 'events', 'campus'] as const
export type NewsCategory = (typeof NEWS_CATEGORIES)[number]

export interface NewsAuthor {
  id: string
  fullName: string | null
  avatarUrl: string | null
  headline: string | null
  department: string | null
  role: UserRole
}

export interface NewsItem {
  id: string
  title: string
  slug: string
  body: string
  summary: string | null
  tags: string[]
  /** YYYY-MM-DD — surfaces the article in the rail's "Key dates". */
  keyDate: string | null
  coverUrl: string | null
  /** Raw enum from the API; rendered as-is (lowercase suits sentence case). */
  category: string
  isPublished: boolean
  isPinned: boolean
  isAnnouncement: boolean
  isImported: boolean
  authorId: string
  viewCount: number
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  author: NewsAuthor
  attachments?: ContentAttachment[]
}

export interface NewsListPage {
  items: NewsItem[]
  total: number
  page: number
  hasMore: boolean
}

export type NewsSourceKind = 'website' | 'admin' | 'department'

export interface NewsRail {
  sources: { name: string; kind: NewsSourceKind; count: number }[]
  keyDates: { newsId: string; title: string; date: string }[]
  trendingTags: string[]
}

export interface NewsWritePayload {
  title: string
  body: string
  category: string
  summary: string | null
  tags: string[]
  key_date: string | null
  cover_url: string | null
  is_published?: boolean
  attachments?: AttachmentInput[]
  removedAttachmentIds?: string[]
}
