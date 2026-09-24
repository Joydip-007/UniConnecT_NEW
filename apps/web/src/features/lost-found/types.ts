import type { UserRole } from '@uniconnect/shared'

export type LostFoundType = 'lost' | 'found'
export type FilterTab = 'all' | 'lost' | 'found'

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
