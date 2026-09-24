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
}

export interface PageResult<T> {
  items: T[]
  total: number
  page: number
  hasMore: boolean
}

export interface MyRequest {
  id: string
  message: string
  status: RequestStatus
  sessionNotes: string | null
  conversationId: string | null
  createdAt: string
  alumni: {
    id: string
    fullName: string
    avatarUrl: string | null
    headline: string | null
    department: string | null
    batchYear: string | null
    role?: UserRole | null
  }
}

export interface IncomingRequest {
  id: string
  message: string
  status: RequestStatus
  sessionNotes: string | null
  conversationId: string | null
  createdAt: string
  student: {
    id: string
    fullName: string
    avatarUrl: string | null
    headline: string | null
    department: string | null
    batchYear: string | null
    role?: UserRole | null
  }
}

export interface MentorshipSession {
  id: string
  requestId: string
  createdBy: string
  sessionDate: string     // 'YYYY-MM-DD'
  durationMinutes: number
  topic: string
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type AddToast = (message: string, type?: 'success' | 'error' | 'info') => void
