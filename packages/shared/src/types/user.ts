export type UserRole = 'student' | 'alumni' | 'staff' | 'admin'

export interface UserProfile {
  fullName: string
  bio: string | null
  avatarUrl: string | null
  coverUrl: string | null
  headline: string | null
  department: string | null
  batchYear: string | null
  linkedinUrl: string | null
  phone: string | null
  skills: string[]
  isOpenToWork: boolean
}

export interface User {
  id: string
  email: string
  role: UserRole
  universityId: string
  profile: UserProfile
}
