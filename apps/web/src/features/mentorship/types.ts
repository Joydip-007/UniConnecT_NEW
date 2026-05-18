export type RequestStatus = 'pending' | 'accepted' | 'declined' | 'completed'

export interface AlumniMentor {
  id: string
  universityId: string
  fullName: string
  headline: string | null
  department: string | null
  batchYear: string | null
  skills: string[]
  avatarUrl: string | null
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
  createdAt: string
  alumni: {
    id: string
    fullName: string
    avatarUrl: string | null
    headline: string | null
    department: string | null
    batchYear: string | null
  }
}

export interface IncomingRequest {
  id: string
  message: string
  status: RequestStatus
  sessionNotes: string | null
  createdAt: string
  student: {
    id: string
    fullName: string
    avatarUrl: string | null
    headline: string | null
    department: string | null
    batchYear: string | null
  }
}

export interface ToastItem {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

export type AddToast = (message: string, type?: ToastItem['type']) => void
