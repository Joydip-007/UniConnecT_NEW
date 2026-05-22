export type GroupType = 'department' | 'club' | 'batch' | 'research' | 'interest' | 'other'
export type AllowedRole = 'student' | 'alumni' | 'faculty' | 'admin'
export type MemberRole = 'owner' | 'admin' | 'moderator' | 'member'

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
