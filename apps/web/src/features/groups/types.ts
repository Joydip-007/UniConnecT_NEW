export type GroupType = 'department' | 'club' | 'batch' | 'research' | 'interest' | 'other' | 'academic'
export type AllowedRole = 'student' | 'alumni' | 'faculty' | 'admin'
export type MemberRole = 'owner' | 'admin' | 'moderator' | 'member'
export type ReviewRating = 'again' | 'hard' | 'good' | 'easy'

export interface AISettings {
  ai_flashcards_enabled: boolean
  ai_quiz_enabled: boolean
  require_approval: boolean
  subject?: string
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
  question_style?: 'mcq' | 'true_false' | 'short_answer' | 'mixed'
  language: 'en' | 'bn'
  custom_instructions?: string
  last_ai_post_date?: string
  pending_deck_id?: string | null
  pending_quiz_content?: unknown | null
}

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
  aiSettings?: AISettings
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

export interface Attachment {
  name: string
  url: string
  contentType: string
  size: number
}

export interface SharedNote {
  id: string
  groupId: string
  createdBy: string | null
  title: string
  body: string
  attachments: Attachment[]
  createdAt: string
  updatedAt: string
  creator: GroupUserSummary | null
}

export interface CourseOutlineAssessment {
  id?: string
  categoryName: string
  fullMarks: number
  weightPercent: number
  totalGiven: number
  bestNCounted: number
  displayOrder: number
}

export interface CourseOutlineTopic {
  id?: string
  weekNumber: number
  title: string
  description?: string | null
}

export interface CourseOutline {
  id: string
  groupId: string
  courseCode?: string | null
  courseTitle: string
  creditHours?: number | null
  trimester?: string | null
  description?: string | null
  gradingScale: 'uiu' | 'ugc' | 'custom'
  customScaleJson?: unknown
  assessments: CourseOutlineAssessment[]
  topics: CourseOutlineTopic[]
}

export interface GradebookColumn {
  assessmentId?: string
  categoryName: string
  fullMarks: number
  bestNCounted: number
  totalGiven: number
  label: string
}

export interface GradebookCell {
  marksObtained: number | null
  graded: boolean
}

export interface GradebookRow {
  student: { id: string; fullName: string; avatarUrl?: string; department?: string }
  cells: Record<string, GradebookCell>
  calculated: Record<string, number | string | null>
}

export interface Gradebook {
  outline: CourseOutline
  columns: GradebookColumn[]
  rows: GradebookRow[]
}

export interface GradebookEntryInput {
  studentId: string
  assessmentId: string
  instanceNumber: number
  marksObtained: number | null
}

export interface MyGradeCard {
  calculated: Record<string, number | string | null>
}

export interface CourseOutlineInput {
  courseCode?: string
  courseTitle: string
  creditHours?: number | null
  trimester?: string
  description?: string
  gradingScale: 'uiu' | 'ugc' | 'custom'
  customScaleJson?: unknown
  assessments: CourseOutlineAssessment[]
  topics: CourseOutlineTopic[]
}

export interface FileUrlEntry {
  name: string
  url: string
  contentType: string
  size: number
}

export interface AcademicModule {
  id: string
  groupId: string
  title: string
  description?: string | null
  weekNumber?: number | null
  displayOrder: number
  isPublished: boolean
  createdAt: string
  updatedAt: string
}

export interface Assignment {
  id: string
  groupId: string
  moduleId?: string | null
  title: string
  description?: string | null
  fileUrls: FileUrlEntry[]
  deadline?: string | null
  maxScore: number
  isPublished: boolean
  createdAt: string
  updatedAt: string
}

export interface SessionNotes {
  id: string
  title?: string | null
  body?: string | null
  attachments: Attachment[]
  createdBy?: string | null
  updatedAt: string
}

export interface Submission {
  id: string
  assignmentId: string
  userId: string
  fileUrls: FileUrlEntry[]
  textContent?: string | null
  score?: number | null
  feedback?: string | null
  submittedAt: string
  gradedAt?: string | null
  isLate: boolean
}
