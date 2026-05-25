export interface TrendingPost {
  id: string
  content: string
  createdAt: string
  authorId: string
  authorName: string
  authorAvatarUrl: string | null
  authorRole: string
  reactionCount: number
  commentCount: number
}

export interface UserSuggestion {
  id: string
  role: string
  fullName: string
  headline: string | null
  department: string | null
  batchYear: string | null
  avatarUrl: string | null
  followerCount: number
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
  authorRole: string
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
