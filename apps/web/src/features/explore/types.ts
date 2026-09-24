import type { UserRole } from '@uniconnect/shared'

export interface TrendingPost {
  id: string
  content: string
  createdAt: string
  authorId: string
  authorName: string
  authorAvatarUrl: string | null
  authorRole: UserRole
  reactionCount: number
  commentCount: number
}

export interface UserSuggestion {
  id: string
  role: UserRole
  fullName: string
  headline: string | null
  department: string | null
  batchYear: string | null
  avatarUrl: string | null
  followerCount: number
  /** Accepted connections the viewer and this person share. */
  mutualCount: number
  connectionStatus: 'none' | 'pending_sent' | 'pending_received' | 'connected'
  connectionId: string | null
}

export interface GroupSummary {
  id: string
  name: string
  type: string
  avatarUrl: string | null
  memberCount: number
  recentPostCount: number
  isPrivate: boolean
  /** The viewer already has a pending join request (private groups only). */
  requestPending: boolean
  /** How many of the viewer's connections are members. */
  knownCount: number
  /** Up to three of those connections, for the avatar stack. */
  knownFaces: { id: string; fullName: string; avatarUrl: string | null }[]
  /**
   * Client-only: set optimistically after a join from Explore. Discovery never
   * returns groups the viewer belongs to, so the server never sends this.
   */
  joined?: boolean
}

export interface EventSummary {
  id: string
  title: string
  startsAt: string
  location: string
  coverUrl: string | null
  rsvpCount: number
  myRsvp: 'going' | 'maybe' | null
}

export interface DiscoveryResult {
  trendingPosts: TrendingPost[]
  peopleSuggestions: UserSuggestion[]
  activeGroups: GroupSummary[]
  upcomingEvents: EventSummary[]
  featuredAlumni: UserSuggestion[]
}

export interface TagPost {
  id: string
  content: string
  createdAt: string
  authorId: string
  authorName: string
  authorAvatarUrl: string | null
  authorRole: UserRole
  reactionCount: number
  commentCount: number
}

export interface TagPostsResponse {
  items: TagPost[]
  total: number
  page: number
  hasMore: boolean
  relatedTags: string[]
}
