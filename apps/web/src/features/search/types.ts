import type { UserRole } from '@uniconnect/shared'

export interface UserSearchResult {
  id: string
  fullName: string
  headline: string | null
  department: string | null
  batchYear: string | null
  avatarUrl: string | null
  role: UserRole
  connectionStatus: 'none' | 'pending_sent' | 'pending_received' | 'connected'
  connectionId: string | null
}

export interface PostSearchResult {
  id: string
  content: string
  createdAt: string
  reactionCount: number
  commentCount: number
  author: { id: string; fullName: string; avatarUrl: string | null; role: UserRole }
}

export interface JobSearchResult {
  id: string
  title: string
  company: string
  type: string
  location: string
  deadline: string | null
}

export interface EventSearchResult {
  id: string
  title: string
  startsAt: string
  location: string
  coverUrl: string | null
  myRsvp: 'going' | 'maybe' | null
}

export interface GroupSearchResult {
  id: string
  name: string
  type: string
  avatarUrl: string | null
  memberCount: number
  isMember: boolean
  isPrivate: boolean
}

export interface SearchPagedResult<T> {
  items: T[]
  total: number
  page: number
  hasMore: boolean
}

export interface SearchAllResult {
  people: UserSearchResult[]
  posts: PostSearchResult[]
  jobs: JobSearchResult[]
  events: EventSearchResult[]
  groups: GroupSearchResult[]
  /** Per-category totals, used for the tab-strip counts. */
  counts: Record<'people' | 'posts' | 'jobs' | 'events' | 'groups', number>
}
