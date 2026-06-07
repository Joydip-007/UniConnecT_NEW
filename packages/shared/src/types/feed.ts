import type { UserRole } from './user'
import type { ContentAttachment } from '../schemas/content-sync'

export interface FeedPollOption {
  id: string
  text: string
  displayOrder: number
  voteCount: number
}

export interface FeedPoll {
  id: string
  question: string
  expiresAt: string | null
  options: FeedPollOption[]
  myVote: string | null
  totalVotes: number
}

export interface FeedPostAuthor {
  id: string
  fullName: string
  role: UserRole
  profile: {
    avatarUrl: string | null
    headline: string | null
    department: string | null
    batchYear: string | null
  }
}

export interface FeedPost {
  id: string
  type: 'post' | 'announcement' | 'lost_found' | 'news' | 'event_promo'
  content: string
  mediaUrls: string[]
  author: FeedPostAuthor
  isPinned: boolean
  isPublished: boolean
  publishAt: string | null
  archivedAt: string | null
  expiresAt: string | null
  viewCount: number
  reactionCounts: { like: number; love: number; insightful: number; celebrate: number }
  myReaction: 'like' | 'love' | 'insightful' | 'celebrate' | null
  commentCount: number
  isSaved: boolean
  poll: FeedPoll | null
  jobEmbed: null
  eventEmbed: null
  lostFoundEmbed: null
  /** Present on the post-detail response; absent in feed-list items. */
  attachments?: ContentAttachment[]
  createdAt: string
}

export interface FeedComment {
  id: string
  postId: string
  authorId: string
  parentId: string | null
  content: string
  createdAt: string
  updatedAt: string
  author: {
    id: string
    fullName: string
    avatarUrl: string | null
    headline: string | null
  }
  reactionCounts: { like: number; love: number; insightful: number; celebrate: number }
  ownReaction: 'like' | 'love' | 'insightful' | 'celebrate' | null
  replies: FeedComment[]
}
