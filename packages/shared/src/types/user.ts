export type UserRole = 'student' | 'alumni' | 'faculty' | 'admin' | 'driver'

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
  // Extended profile fields
  location: string | null
  websiteUrl: string | null
  githubUrl: string | null
  portfolioUrl: string | null
  isOpenToMsg: boolean
  /** Owner-only (null for other viewers) — read by the jobs apply flow. */
  cgpa?: number | null
  resumeUrl?: string | null
  resumeName?: string | null
  resumeUpdatedAt?: string | null
}

export interface User {
  id: string
  username: string
  email: string
  role: UserRole
  universityId: string
  // Optional: not populated by the auth/me responses yet (only `universityId` is).
  // Consumers must fall back gracefully rather than assume it is present.
  university?: { name: string }
  isVerified: boolean
  themePreference: ThemePreference
  profile: UserProfile
}
