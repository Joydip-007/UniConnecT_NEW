import type { UserRole } from '@uniconnect/shared'

export type RequestStatus = 'pending' | 'accepted' | 'declined' | 'completed' | 'expired'

export interface AlumniMentor {
  id: string
  universityId: string
  fullName: string
  role?: UserRole
  headline: string | null
  department: string | null
  batchYear: string | null
  skills: string[]
  avatarUrl: string | null
  maxMentees: number
  currentMentees: number
  /** Mentoring topics the alumnus set in Availability — distinct from profile skills. */
  topics: string[]
  availability: string[]
  sessionsCompleted: number
  /** Average hours from request to accept / decline; null for a mentor with no replies yet. */
  avgReplyHours: number | null
  /** The viewer asked to be told when this (full) mentor opens a place. */
  isWaitlisted: boolean
}

export interface PageResult<T> {
  items: T[]
  total: number
  page: number
  hasMore: boolean
}

export interface SessionRequest {
  id: string
  requestId: string
  requestedBy: string
  /** A mentor availability label; null means "no specific time". */
  slotLabel: string | null
  topic: string | null
  status: 'requested' | 'scheduled' | 'withdrawn' | 'done'
  createdAt: string
}

/** Lifecycle + session aggregates the API adds to both request lists. */
export interface RequestLifecycle {
  respondedAt: string | null
  declineReason: string | null
  endedAt: string | null
  endedBy: string | null
  endReason: string | null
  endNote: string | null
  sessionCount: number
  totalMinutes: number
  firstSessionDate: string | null
  lastSessionDate: string | null
  openSessionRequest: SessionRequest | null
}

export interface RequestParty {
  id: string
  fullName: string
  avatarUrl: string | null
  headline: string | null
  department: string | null
  batchYear: string | null
  role?: UserRole | null
}

export interface MyRequest extends RequestLifecycle {
  id: string
  message: string
  status: RequestStatus
  sessionNotes: string | null
  conversationId: string | null
  createdAt: string
  updatedAt: string
  alumni: RequestParty & { availability: string[] }
}

export interface IncomingRequest extends RequestLifecycle {
  id: string
  message: string
  status: RequestStatus
  sessionNotes: string | null
  conversationId: string | null
  createdAt: string
  updatedAt: string
  student: RequestParty
}

export interface MentorshipSession {
  id: string
  requestId: string
  createdBy: string
  sessionDate: string     // 'YYYY-MM-DD'
  durationMinutes: number
  topic: string
  notes: string | null
  /** What logging this session paid the alumnus (0 on sessions logged before per-session points). */
  pointsAwarded: number
  createdAt: string
  updatedAt: string
}

export interface MentorSettings {
  isOpenToMentorship: boolean
  maxMentees: number
  topics: string[]
  availability: string[]
  currentMentees: number
  pendingRequests: number
}

interface HistoryStudent {
  id: string
  fullName: string
  avatarUrl: string | null
}

export type SessionHistoryItem =
  | (MentorshipSession & { kind: 'session'; student: HistoryStudent })
  | { kind: 'canceled'; id: string; requestId: string; sessionDate: string; endReason: string | null; student: HistoryStudent }

export interface SessionHistory {
  items: SessionHistoryItem[]
  totalSessions: number
  pointsEarned: number
}
