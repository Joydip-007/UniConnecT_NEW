export type UserRole = 'student' | 'alumni' | 'faculty' | 'admin'

export type ThemePreference = 'light' | 'dark' | 'system'

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
  isOpenToMentorship: boolean
  mentorshipPoints: number
  maxMentees: number
}

export interface User {
  id: string
  email: string
  role: UserRole
  universityId: string
  isVerified: boolean
  themePreference: ThemePreference
  profile: UserProfile
}
