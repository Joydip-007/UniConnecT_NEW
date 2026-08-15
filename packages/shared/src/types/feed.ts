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
  type: 'post' | 'announcement' | 'lost_found' | 'news' | 'event_promo' | 'job_promo'
  content: string
  mediaUrls: string[]
  author: FeedPostAuthor
  isPinned: boolean
  isPublished: boolean
  publishAt: string | null
  archivedAt: string | null
  expiresAt: string | null
  viewCount: number
  reactionCounts: { like: number; love: number; care: number; haha: number; wow: number; sad: number; angry: number }
  myReaction: 'like' | 'love' | 'care' | 'haha' | 'wow' | 'sad' | 'angry' | null
  commentCount: number
  shareCount: number
  isSaved: boolean
  /** True when the author has hidden reaction counts from everyone but themselves. */
  reactionCountsHidden: boolean
  commentsDisabled: boolean
  sharesDisabled: boolean
  /** Non-null when this post is a share/repost of another post. */
  originalPost: Omit<FeedPost, 'originalPost' | 'poll' | 'jobEmbed' | 'eventEmbed' | 'lostFoundEmbed' | 'attachments'> | null
  /** ID of the viewer's own share post for the root post, or null if not shared. */
  myShare: string | null
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
  mediaUrls: string[]
  createdAt: string
  updatedAt: string
  author: {
    id: string
    fullName: string
    avatarUrl: string | null
    headline: string | null
    role: UserRole
  }
  reactionCounts: { like: number; love: number; care: number; haha: number; wow: number; sad: number; angry: number }
  ownReaction: 'like' | 'love' | 'care' | 'haha' | 'wow' | 'sad' | 'angry' | null
  replies: FeedComment[]
}
