import type { UserRole } from '@uniconnect/shared'

export type LostFoundType = 'lost' | 'found'
/** The board's four tabs. `resolved` lists returned items; the other three list open ones. */
export type FilterTab = 'all' | 'lost' | 'found' | 'resolved'

export interface LFAuthor {
  fullName: string
  role?: UserRole
  avatarUrl: string | null
  department: string | null
  batchYear: string | null
}

export interface LostFoundItem {
  id: string
  type: LostFoundType
  itemName: string
  description: string
  imageUrls: string[]
  locationDetail: string
  contactInfo: string
  isResolved: boolean
  resolvedAt: string | null
  isPinned: boolean
  isSaved: boolean
  authorId: string
  author: LFAuthor
  createdAt: string
}

export interface LFPage {
  items: LostFoundItem[]
  total: number
  page: number
  hasMore: boolean
}

export interface UploadedImage {
  url: string
  preview: string
}

export interface LostFoundDesk {
  location: string
  hours: string
  holdPolicy: string
}

export interface LostFoundStats {
  reunitedThisMonth: number
  /** Share of items posted in the last 90 days that were resolved; null when none were posted. */
  resolvedPct: number | null
  avgResolveDays: number | null
  hotspots: { place: string; count: number }[]
  desk: LostFoundDesk | null
}
