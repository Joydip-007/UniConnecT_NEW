export type GroupType = 'department' | 'club' | 'batch' | 'research' | 'interest' | 'other'
export type AllowedRole = 'student' | 'alumni' | 'faculty' | 'admin'
export type MemberRole = 'owner' | 'admin' | 'moderator' | 'member'
export type ReviewRating = 'again' | 'hard' | 'good' | 'easy'

export interface GroupUserSummary {
  id: string
  fullName: string | null
  avatarUrl: string | null
}

export interface Group {
  id: string
  name: string
  type: GroupType
  description: string | null
  avatarUrl: string | null
  coverUrl: string | null
  isPrivate: boolean
  memberCount: number
  isMember: boolean
  userRole: MemberRole | null
  allowedRole: AllowedRole | null
  isSystem: boolean
  department: string | null
  createdBy: string
  pinnedText?: string | null
  pinnedAt?: string | null
  pinnedBy?: string | null
  rulesMd?: string | null
}

export interface GroupMember {
  id: string
  fullName: string
  avatarUrl: string | null
  role: MemberRole
  headline: string | null
  department: string | null
  user?: { role?: string | null }
}

export interface GroupEventItem {
  kind: 'event'
  id: string
  title: string
  description: string
  location: string
  startDate: string
  endDate: string | null
  coverUrl: string | null
  type: string
  rsvpCounts: { going: number; maybe: number }
  myRsvp: 'going' | 'maybe' | null
  previewAttendees: { id: string; fullName: string; avatarUrl: string | null }[]
  totalAttendees: number
  capacity: number | null
  organizer: { id: string; fullName: string; avatarUrl?: string | null }
}

export interface GroupEventPost {
  kind: 'post'
  id: string
  content: string
  mediaUrls: string[]
  createdAt: string
  author: { id: string; fullName: string; avatarUrl: string | null }
}

export type GroupEventEntry = GroupEventItem | GroupEventPost

export interface GroupCollabJob {
  kind: 'job'
  id: string
  title: string
  company: string
  location: string
  type: 'full_time' | 'part_time' | 'internship' | 'remote' | 'contract'
  description: string
  deadline: string
  applicationUrl: string | null
  createdAt: string
  postedBy: {
    id: string
    fullName: string
    avatarUrl: string | null
    department: string | null
  }
}

export interface FlashcardDeck {
  id: string
  groupId: string
  createdBy: string | null
  title: string
  description: string | null
  isArchived: boolean
  cardCount: number
  dueCount: number
  createdAt: string
  updatedAt: string
  creator: GroupUserSummary | null
}

export interface FlashcardReview {
  userId: string
  easeFactor: number
  intervalDays: number
  repetitionCount: number
  dueAt: string | null
  lastReviewedAt: string | null
  lastRating: ReviewRating | null
}

export interface Flashcard {
  id: string
  deckId: string
  groupId: string
  createdBy: string | null
  front: string
  back: string
  hint: string | null
  createdAt: string
  updatedAt: string
  creator: GroupUserSummary | null
  review: FlashcardReview | null
}

export type FlashcardReviewItem = Flashcard

export interface FlashcardReviewResult {
  cardId: string
  userId: string
  groupId: string
  easeFactor: number
  intervalDays: number
  repetitionCount: number
  dueAt: string | null
  lastReviewedAt: string | null
  lastRating: ReviewRating | null
  createdAt: string
  updatedAt: string
}

export interface SharedNote {
  id: string
  groupId: string
  createdBy: string | null
  title: string
  body: string
  createdAt: string
  updatedAt: string
  creator: GroupUserSummary | null
}
