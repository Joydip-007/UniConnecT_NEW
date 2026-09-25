import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import type { PublicUserProfile } from '@uniconnect/shared'
import { api } from '@/lib/axios'
import { resolveMessagesMock } from '@/lib/devMessagesMocks'
import { resolveNewsLostFoundMock } from '@/lib/devNewsLostFoundMocks'
import { resolveEventsMock } from '@/lib/devEventsMocks'
import { resolveJobsMock } from '@/lib/devJobsMocks'
import { resolveMentorshipMock } from '@/lib/devMentorshipMocks'

/**
 * DEV-ONLY backend stub for the `?dev-auth=1` design-verification flow.
 *
 * The screenshot harness runs the real app with no API server, so data-driven
 * pages (e.g. the profile) would otherwise render their error state. This
 * installs a tiny axios adapter that answers the handful of read endpoints the
 * profile page hits with canned data, so captures show real UI (incl. the
 * @username header). It is gated on `import.meta.env.DEV` + `dev-auth=1` and is
 * never wired up in production builds.
 */

const DEV_PROFILE: PublicUserProfile & { visibility?: Record<string, unknown> } = {
  // Must match AuthLoader's DEV_MOCK_USER.id (and screenshot.cjs's DEV_USER_ID)
  // so `isOwnProfile` (authUser.id === user.id) is true on the profile screenshot —
  // otherwise the page renders as if viewing a stranger (Connect button, gated sections).
  // Kept as a real UUID because publicUserProfileSchema.id is `z.string().uuid()`.
  id: '11111111-1111-4111-8111-111111111111',
  username: 'devuser',
  email: 'dev@uiu.ac.bd',
  role: 'student',
  universityId: '22222222-2222-4222-8222-222222222222',
  isVerified: true,
  themePreference: 'dark',
  isActive: true,
  lastActiveAt: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  profile: {
    fullName: 'Dev User',
    bio: 'Final-year CSE student at UIU. Building UniConnecT. Into distributed systems, design systems, and good coffee.',
    avatarUrl: null,
    coverUrl: null,
    headline: 'CSE @ UIU · Frontend & systems',
    department: 'CSE',
    batchYear: '2024',
    linkedinUrl: 'https://linkedin.com/in/devuser',
    phone: null,
    skills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'Design systems'],
    isOpenToWork: true,
    isOpenToMentorship: false,
    mentorshipPoints: 0,
    location: 'Dhaka, Bangladesh',
    websiteUrl: null,
    githubUrl: 'https://github.com/devuser',
    portfolioUrl: null,
    isOpenToMsg: true,
  },
  connectionStatus: 'none',
  connectionId: null,
  mutualConnections: 0,
  stats: { connections: 0, pendingReceived: 0, posts: 0 },
}

const DEV_GROUP = {
  id: 'dev-study-group',
  name: 'CSE Study Circle',
  type: 'department',
  description: 'Peer-led study group for core CSE courses.',
  avatarUrl: null,
  coverUrl: null,
  isPrivate: false,
  memberCount: 48,
  isMember: true,
  userRole: 'member',
  allowedRole: 'student',
  isSystem: false,
  department: 'CSE',
  createdBy: DEV_PROFILE.id,
  pinnedText: null,
  pinnedAt: null,
  pinnedBy: null,
  rulesMd: 'Keep decks accurate and cite course material when possible.',
  // The list endpoint fills these for every card (`loadGroupSocialProof`), and the card
  // footer's "+N others" pill counts the members these faces leave out — so a fixture
  // without them would screenshot a fallback the real app never shows.
  previewMembers: [
    { id: 'dev-face-1', fullName: 'Kabir Uddin', avatarUrl: null },
    { id: 'dev-face-2', fullName: 'Sara Rahman', avatarUrl: null },
    { id: 'dev-face-3', fullName: 'Tanvir Fahim', avatarUrl: null },
    { id: 'dev-face-4', fullName: 'Nusrat Ahmed', avatarUrl: null },
    { id: 'dev-face-5', fullName: 'Rafi Ahsan', avatarUrl: null },
  ],
  knownMemberCount: 0,
}

// `dev-role=faculty` (the `group-detail-admin` screenshot route) also promotes the caller
// to the group's owner, so GroupDetailPage renders the admin "Manage this group" shell
// instead of the plain member view. Read per-request rather than cached at module init
// since `resolveMockBody` runs on every mocked call.
function currentDevGroup() {
  const devRole = new URLSearchParams(window.location.search).get('dev-role')
  return devRole === 'faculty' ? { ...DEV_GROUP, userRole: 'owner' as const } : DEV_GROUP
}

const DEV_DECK = {
  id: 'dev-deck-1',
  groupId: DEV_GROUP.id,
  createdBy: DEV_PROFILE.id,
  title: 'Algorithms midterm',
  description: 'Greedy proofs, graph traversal, and complexity checks.',
  isArchived: false,
  cardCount: 2,
  dueCount: 1,
  masteredCount: 1,
  createdAt: '2026-07-01T08:00:00.000Z',
  updatedAt: '2026-07-05T08:00:00.000Z',
  creator: { id: DEV_PROFILE.id, fullName: DEV_PROFILE.profile.fullName, avatarUrl: null },
}

const DEV_CARD = {
  id: 'dev-card-1',
  deckId: DEV_DECK.id,
  groupId: DEV_GROUP.id,
  createdBy: DEV_PROFILE.id,
  front: 'When does Dijkstra require non-negative edges?',
  back: 'Always; negative edges can invalidate the greedy shortest-path choice.',
  hint: 'Think about relaxing a path after a node is finalized.',
  createdAt: '2026-07-01T08:10:00.000Z',
  updatedAt: '2026-07-05T08:10:00.000Z',
  creator: { id: DEV_PROFILE.id, fullName: DEV_PROFILE.profile.fullName, avatarUrl: null },
  review: null,
}

const DEV_NOTE = {
  id: 'dev-note-1',
  groupId: DEV_GROUP.id,
  createdBy: DEV_PROFILE.id,
  title: 'Greedy proof checklist',
  body: 'State the greedy choice, prove exchange safety, then show optimal substructure before writing complexity.',
  createdAt: '2026-07-02T08:00:00.000Z',
  updatedAt: '2026-07-05T09:00:00.000Z',
  creator: { id: DEV_PROFILE.id, fullName: DEV_PROFILE.profile.fullName, avatarUrl: null },
}

const DEV_GROUP_MEMBER = {
  id: DEV_PROFILE.id,
  fullName: DEV_PROFILE.profile.fullName,
  avatarUrl: null,
  role: 'member' as const,
  headline: DEV_PROFILE.profile.headline,
  department: DEV_PROFILE.profile.department,
}

const DEV_REVIEW_SUMMARY = { pendingPosts: 1, pendingEvents: 1, pendingJoinRequests: 2, reportsOpen: 0 }

const DEV_GROUP_STATS = {
  newMembersThisWeek: 4,
  postsThisWeek: 9,
  activeContributors: 21,
  pendingJoinRequests: 2,
  upcomingStudySessions: 1,
  members: 48,
  active30d: 33,
  resources: 6,
  upcomingEvents: 2,
}

/** Returns the HTTP body to fake for a GET, or null to defer to the real adapter. */
function resolveMockBody(url: string, params?: Record<string, unknown>): unknown | null {
  const messaging = resolveMessagesMock(url)
  if (messaging !== null) return messaging
  const newsLostFound = resolveNewsLostFoundMock(url, params)
  if (newsLostFound !== null) return newsLostFound
  const events = resolveEventsMock(url, params)
  if (events !== null) return events
  const jobs = resolveJobsMock(url, params)
  if (jobs !== null) return jobs
  const mentorship = resolveMentorshipMock(url, params)
  if (mentorship !== null) return mentorship
  const DEV_GROUP = currentDevGroup()
  if (url === '/groups') return { data: { items: [DEV_GROUP], total: 1, page: 1, hasMore: false } }
  if (url.startsWith('/groups/my')) return { data: { items: [DEV_GROUP], total: 1, page: 1, hasMore: false } }
  if (url === `/groups/${DEV_GROUP.id}`) return { data: DEV_GROUP }
  if (url === `/groups/${DEV_GROUP.id}/join-requests`) {
    return { data: { items: [], total: 0, page: 1, hasMore: false } }
  }
  if (url.startsWith(`/groups/${DEV_GROUP.id}/study-sessions`)) {
    return { data: { items: [], total: 0, page: 1, hasMore: false } }
  }
  if (url === `/groups/${DEV_GROUP.id}/flashcard-decks`) return { data: [DEV_DECK] }
  if (url === `/groups/${DEV_GROUP.id}/flashcard-decks/${DEV_DECK.id}/cards`) return { data: [DEV_CARD] }
  if (url.startsWith(`/groups/${DEV_GROUP.id}/flashcard-decks/${DEV_DECK.id}/review`)) {
    return { data: { items: [DEV_CARD], total: 1, page: 1, hasMore: false } }
  }
  if (url.startsWith(`/groups/${DEV_GROUP.id}/shared-notes`)) {
    return { data: { items: [DEV_NOTE], total: 1, page: 1, hasMore: false } }
  }
  if (url === `/groups/${DEV_GROUP.id}/posts`) return { data: { items: [], hasMore: false, page: 1 } }
  if (url === `/groups/${DEV_GROUP.id}/events`) return { data: { items: [], hasMore: false, page: 1 } }
  if (url.startsWith(`/groups/${DEV_GROUP.id}/resources?`)) {
    return { data: { items: [], total: 0, page: 1, hasMore: false } }
  }
  if (url === `/groups/${DEV_GROUP.id}/stats`) return { data: DEV_GROUP_STATS }
  if (url === `/groups/${DEV_GROUP.id}/review/summary`) return { data: DEV_REVIEW_SUMMARY }
  if (url === `/groups/${DEV_GROUP.id}/review/posts`) return { data: { items: [] } }
  if (url === `/groups/${DEV_GROUP.id}/review/events`) return { data: { items: [] } }
  if (url === `/groups/${DEV_GROUP.id}/members`) {
    return { data: { items: [DEV_GROUP_MEMBER], total: 1, page: 1, hasMore: false } }
  }
  if (url === `/groups/${DEV_GROUP.id}/announcements`) return { data: { items: [] } }
  if (url === `/groups/${DEV_GROUP.id}/course-outline`) return { data: null }
  if (url === `/groups/${DEV_GROUP.id}/modules`) return { data: [] }
  if (url === `/groups/${DEV_GROUP.id}/assignments`) return { data: [] }
  if (url === `/groups/${DEV_GROUP.id}/gradebook`) return { data: { rows: [], assignments: [] } }
  if (url === `/groups/${DEV_GROUP.id}/gradebook/me`) return { data: { assignments: [] } }
  if (url === `/groups/${DEV_GROUP.id}/consultation-slots`) return { data: { items: [], total: 0, page: 1, hasMore: false } }
  if (url === `/groups/${DEV_GROUP.id}/ask-teacher/queue`) return { data: { items: [], total: 0, page: 1, hasMore: false } }
  if (/\/users\/by-username\/[^/]+$/.test(url)) return { data: DEV_PROFILE }
  if (/\/users\/me\/analytics$/.test(url))
    return {
      data: {
        profileViews: { last7d: 18, last30d: 64, last90d: 142 },
        postReach: { reactions: 23, comments: 7, shares: 4, total: 34 },
      },
    }
  if (/\/users\/me\/viewers$/.test(url)) return { data: { items: [], total: 0, page: 1 } }
  if (/\/users\/me\/progress$/.test(url))
    return {
      data: {
        profileScore: 70,
        hasMadePost: false,
        connectionCount: 0,
        isVerified: true,
        hasAddedExperience: false,
        hasAddedEducation: false,
        hasAvatar: false,
        hasBio: true,
        hasHeadline: true,
      },
    }
  if (/\/users\/[^/]+\/experience$/.test(url)) return { data: [] }
  if (/\/users\/[^/]+\/education$/.test(url)) return { data: [] }
  if (/\/users\/[^/]+\/featured$/.test(url)) return { data: [] }
  if (/\/presence$/.test(url)) return { data: [] }
  if (/\/users\/suggestions$/.test(url)) return { data: [] }
  // Bare `/users/:id` (e.g. the left-sidebar mini profile) — keep last so the
  // more specific routes above win.
  if (/\/users\/[^/]+$/.test(url)) return { data: DEV_PROFILE }
  // Daily quiz
  if (url === '/quiz/today') {
    return {
      data: {
        id: 'dev-slot-1',
        department: 'Computer Science',
        date: new Date().toLocaleDateString('en-CA'),
        questions: [
          { q: 'What does CPU stand for?', options: ['Central Processing Unit', 'Computer Personal Unit', 'Core Processing Utility', 'Central Program Unit'] },
          { q: 'Which language is used for web styling?', options: ['Java', 'Python', 'CSS', 'Swift'] },
          { q: 'What is a compiler?', options: ['A text editor', 'A program that translates source code', 'A database system', 'An operating system'] },
        ],
        myAttempt: null,
      },
    }
  }
  if (/\/quiz\/today\/[^/]+\/attempt$/.test(url)) {
    return {
      data: {
        score: 100, correctCount: 3, totalQuestions: 3, passed: true,
        review: [
          { question: 'What does CPU stand for?', options: ['Central Processing Unit', 'Computer Personal Unit', 'Core Processing Utility', 'Central Program Unit'], selectedIndex: 0, correctIndex: 0, isCorrect: true },
          { question: 'Which language is used for web styling?', options: ['Java', 'Python', 'CSS', 'Swift'], selectedIndex: 2, correctIndex: 2, isCorrect: true },
          { question: 'What is a compiler?', options: ['A text editor', 'A program that translates source code', 'A database system', 'An operating system'], selectedIndex: 1, correctIndex: 1, isCorrect: true },
        ],
      },
    }
  }
  if (url === '/quiz/today/leaderboard') {
    return {
      data: [
        { rank: 1, userId: 'dev-user-1', fullName: 'Dev User', avatarUrl: null, score: 100, correctCount: 3 },
      ],
    }
  }

  // Admin → Learning (`/admin?tab=learning&dev-role=admin`). Rows mirror the design's sample data.
  if (url === '/admin/learning/paths') return { data: DEV_ADMIN_PATHS }
  if (url === '/admin/learning/quizzes') return { data: DEV_ADMIN_QUIZZES }
  if (/\/admin\/learning\/quizzes\/[^/]+\/[^/]+$/.test(url)) {
    return { data: { questions: [{ q: 'Which sort is stable?', options: ['Quick sort', 'Merge sort', 'Heap sort', 'Selection sort'], answer: 1 }] } }
  }
  if (url === '/admin/learning/pending-paths' || url === '/admin/learning/pending-quiz') return { data: [] }
  if (url === '/admin/learning/upcoming-quizzes') return { data: { today: [], queuedByDepartment: [] } }
  if (url === '/admin/learning/config') {
    return {
      data: {
        enabled: false, topics: [], difficulty: 'beginner', language: 'en', estimatedDays: 7, customInstructions: null,
        genHour: 2, countPerRun: 1, quizEnabled: false, quizRequireApproval: false, quizDifficulty: 'beginner',
        quizLanguage: 'en', quizCount: 5, quizCustomInstructions: null, lastAiError: null, lastAiErrorAt: null,
      },
    }
  }
  if (/\/admin\/learning\/analytics/.test(url)) return { data: { windowDays: 14, paths: [], quizzes: [] } }
  if (url === '/admin/stats') return { data: DEV_ADMIN_STATS }
  if (url === '/explore/discovery') return { data: DEV_DISCOVERY }
  if (url === '/search') return { data: DEV_SEARCH_ALL }

  return null
}

const ago = (days: number, hours = 0) => new Date(Date.now() - (days * 24 + hours) * 3600_000).toISOString()

const adminPath = (
  id: string, title: string, department: string, category: string, difficulty: 'beginner' | 'intermediate' | 'advanced',
  unitCount: number, enrolledCount: number, completionRate: number, isPublished: boolean, updatedAt: string,
) => ({
  id, title, description: null, department, category, difficulty, estimatedDays: 7, isPublished, source: 'manual' as const,
  unitCount, enrolledCount, completedCount: Math.round(unitCount * enrolledCount * completionRate), completionRate, updatedAt,
})

const DEV_ADMIN_PATHS = [
  adminPath('a1', 'Algorithms, properly', 'CSE', 'career', 'intermediate', 11, 214, 0.46, true, ago(2)),
  adminPath('a2', 'Interview readiness', 'Career services', 'career', 'beginner', 8, 342, 0.61, true, ago(5)),
  adminPath('a3', 'Git for group projects', 'CSE', 'technical', 'beginner', 6, 188, 0.73, true, ago(7)),
  adminPath('a4', 'Applied machine learning', 'CSE', 'technical', 'advanced', 14, 96, 0.12, false, ago(1)),
  adminPath('a5', 'Technical writing', 'English', 'communication', 'beginner', 7, 54, 0, false, ago(3)),
  adminPath('a6', 'Public speaking on campus', 'English', 'communication', 'beginner', 5, 121, 0.38, true, ago(4)),
]

const adminQuiz = (
  id: string, title: string, pathId: string | null, pathTitle: string, questionCount: number, attempts: number,
  avgScore: number | null, passMark: number, status: 'published' | 'draft' | 'needs_review' | 'scheduled',
  source: 'ai' | 'staff', updatedAt: string,
) => ({ id, kind: pathId ? ('path_unit' as const) : ('ai_batch' as const), title, pathId, pathTitle, questionCount, passMark, attempts, avgScore, status, source, updatedAt })

const DEV_ADMIN_QUIZZES = [
  adminQuiz('q1', 'Sorting and complexity checkpoint', 'a1', 'Algorithms, properly', 12, 186, 74, 60, 'published', 'ai', ago(2)),
  adminQuiz('q2', 'Behavioural round self-check', 'a2', 'Interview readiness', 8, 241, 81, 50, 'published', 'staff', ago(4)),
  adminQuiz('q3', 'Branching and merges', 'a3', 'Git for group projects', 10, 132, 68, 60, 'published', 'ai', ago(7)),
  adminQuiz('q4', 'Gradient descent basics', 'a4', 'Applied machine learning', 14, 0, null, 65, 'draft', 'ai', ago(1)),
  adminQuiz('q5', 'Citations and referencing', null, 'Daily quiz pool', 9, 0, null, 60, 'needs_review', 'ai', ago(3)),
  adminQuiz('q6', 'Slide structure quiz', null, 'Daily quiz pool', 6, 0, null, 50, 'scheduled', 'ai', ago(0, 6)),
]

const DEV_ADMIN_STATS = {
  totalUsers: 1240, activeUsers: 812, pendingReports: 3, totalPosts: 5210, totalJobs: 48, totalEvents: 22,
  // Shape of GET /admin/stats as `useAdminRail` reads it — the rail's default branch
  // (any admin route outside /admin) needs `postsByDay`, or it throws.
  users: 1240,
  postsByDay: [{ date: new Date().toISOString().slice(0, 10), count: 14 }],
  usersByRole: [{ role: 'student', count: 1100 }, { role: 'alumni', count: 90 }, { role: 'faculty', count: 40 }, { role: 'admin', count: 10 }],
  escalatedReports: 1, deletionRequests: 0, resolvedPct7d: 80, pendingInviteBatches: 0,
  moderationHealth: { reportsOpen: 3, resolvedPct7d: 80, medianResponseHours: 6, repeatOffenders: 0 },
}

const inDays = (days: number, hour: number, minute = 0) => {
  const d = new Date(Date.now() + days * 24 * 3600_000)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

const devPerson = (
  id: string, fullName: string, role: string, headline: string | null, department: string, batchYear: string,
  mutualCount: number, connectionStatus: 'none' | 'pending_sent' | 'pending_received' | 'connected' = 'none',
) => ({
  id, role, fullName, headline, department, batchYear, avatarUrl: null, followerCount: 40 + mutualCount * 7, mutualCount,
  connectionStatus, connectionId: connectionStatus === 'none' ? null : `conn-${id}`,
})

const devFace = (id: string, fullName: string) => ({ id, fullName, avatarUrl: null })

const devGroupSummary = (
  id: string, name: string, type: string, memberCount: number, recentPostCount: number, isPrivate: boolean,
  faces: { id: string; fullName: string; avatarUrl: null }[], knownCount = faces.length,
) => ({ id, name, type, avatarUrl: null, memberCount, recentPostCount, isPrivate, requestPending: false, knownCount, knownFaces: faces })

const FACE_SR = devFace('dev-u1', 'Sadia Rahman')
const FACE_IH = devFace('dev-u2', 'Imran Hossain')
const FACE_SA = devFace('dev-u3', 'Shamsul Alam')
const FACE_FA = devFace('dev-u4', 'Farhana Akter')

/** Explore discovery payload, mirroring the Explore design reference. */
const DEV_DISCOVERY = {
  trendingPosts: [
    ['dev-p1', 'Anyone else notice the CSE lab machines got new GPUs? Ran a full ResNet fine-tune in twenty minutes.', 'Tanvir Ahmed', 3, 48, 12],
    ['dev-p2', 'Registration for the Fall trimester opens Sunday 9am. Last time the portal crawled, so log in early.', 'Nusrat Jahan', 5, 132, 41],
    ['dev-p3', "Sharing my notes from Dr. Alam's algorithms midterm review session. Link in the comments.", 'Sadia Rahman', 8, 76, 19],
    ['dev-p4', 'IUT beat us by four runs. Still proud of the team. That last over was brutal.', 'Imran Hossain', 26, 210, 63],
  ].map(([id, content, authorName, hours, reactionCount, commentCount]) => ({
    id, content, authorName, createdAt: ago(0, hours as number), authorId: `${id}-author`, authorAvatarUrl: null,
    authorRole: 'student', reactionCount, commentCount,
  })),
  peopleSuggestions: [
    devPerson('dev-u1', 'Sadia Rahman', 'alumni', 'Junior SWE at Optimizely', 'CSE', '2026', 3),
    devPerson('dev-u2', 'Imran Hossain', 'student', null, 'CSE', '2026', 11),
    devPerson('dev-u3', 'Dr. Shamsul Alam', 'faculty', 'Assistant Professor, CSE', 'CSE', '2012', 0, 'pending_sent'),
    devPerson('dev-u4', 'Farhana Akter', 'student', null, 'EEE', '2027', 2, 'connected'),
    devPerson('dev-u5', 'Rakib Chowdhury', 'student', 'ML research assistant', 'CSE', '2025', 4),
    devPerson('dev-u6', 'Nusrat Jahan', 'alumni', 'Analyst at BRAC Bank', 'BBA', '2021', 1),
  ],
  activeGroups: [
    devGroupSummary('dev-g1', 'CSE Study Circle', 'department', 1204, 38, false, [FACE_IH, FACE_SA, FACE_FA]),
    devGroupSummary('dev-g2', 'UIU Robotics Club', 'club', 486, 12, false, [FACE_SR, FACE_IH]),
    devGroupSummary('dev-g3', 'Photography Society', 'club', 932, 21, false, [FACE_FA]),
    devGroupSummary('dev-g4', 'Competitive Programming', 'club', 674, 55, true, [FACE_IH, FACE_SR]),
    devGroupSummary('dev-g5', 'Debate Club', 'club', 312, 7, false, []),
    devGroupSummary('dev-g6', 'CSE 2026 batch', 'batch', 318, 9, false, [FACE_SR, FACE_IH, FACE_FA], 4),
  ],
  upcomingEvents: [
    { id: 'dev-e1', title: 'Career Fair 2026', startsAt: inDays(3, 10), location: 'Auditorium', rsvpCount: 412, myRsvp: null },
    { id: 'dev-e2', title: 'Robotics workshop: ROS2 basics', startsAt: inDays(6, 14, 30), location: 'Lab 602', rsvpCount: 88, myRsvp: 'going' },
    { id: 'dev-e3', title: 'Alumni meetup, Dhaka', startsAt: inDays(15, 18), location: 'Gulshan', rsvpCount: 156, myRsvp: null },
    { id: 'dev-e4', title: 'Intra-university hackathon: 24 hour build sprint', startsAt: inDays(23, 9), location: 'Multipurpose hall', rsvpCount: 240, myRsvp: null },
  ].map((e) => ({ ...e, coverUrl: null })),
  featuredAlumni: [
    devPerson('dev-a1', 'Rafiul Karim', 'alumni', 'Senior Engineer at Grameenphone', 'CSE', '2019', 5),
    devPerson('dev-a2', 'Mahbub Hasan', 'alumni', 'Product Manager at bKash', 'BBA', '2017', 1),
    devPerson('dev-a3', 'Ayesha Siddika', 'alumni', 'Data Scientist at Pathao', 'CSE', '2020', 2),
  ],
}

/** Explore "All" search payload — note the empty Groups count, so that tab renders dimmed. */
const DEV_SEARCH_ALL = {
  people: [
    { ...devPerson('dev-a3', 'Ayesha Siddika', 'alumni', 'Data Scientist at Pathao', 'CSE', '2020', 2) },
    { ...devPerson('dev-u3', 'Dr. Shamsul Alam', 'faculty', 'Assistant Professor, CSE', 'CSE', '2012', 0) },
    { ...devPerson('dev-u5', 'Rakib Chowdhury', 'student', 'ML research assistant', 'CSE', '2025', 4) },
  ],
  posts: [
    { id: 'dev-sp1', content: 'Machine learning reading group, week 4 notes', createdAt: ago(0, 8), reactionCount: 24, commentCount: 6, author: { id: 'dev-u2', fullName: 'Imran Hossain', avatarUrl: null, role: 'student' } },
    { id: 'dev-sp2', content: 'Free GPU credits for final-year machine learning projects', createdAt: ago(2), reactionCount: 88, commentCount: 17, author: { id: 'dev-u6', fullName: 'Nusrat Jahan', avatarUrl: null, role: 'alumni' } },
  ],
  jobs: [
    { id: 'dev-j1', title: 'Machine Learning Intern', company: 'Pathao', type: 'internship', location: 'Dhaka', deadline: null },
    { id: 'dev-j2', title: 'Junior Data Scientist', company: 'bKash', type: 'full_time', location: 'Dhaka', deadline: null },
  ],
  events: [
    { id: 'dev-se1', title: 'Applied machine learning bootcamp', startsAt: inDays(9, 10), location: 'Room 401', coverUrl: null, myRsvp: null },
  ],
  groups: [],
  counts: { people: 8, posts: 11, jobs: 3, events: 2, groups: 0 },
}

let installed = false

export function installDevMocks(): void {
  if (installed) return
  installed = true

  api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    const method = (config.method ?? 'get').toLowerCase()
    const url = config.url ?? ''
    if (method === 'get' || method === 'post') {
      const body = resolveMockBody(url, config.params as Record<string, unknown> | undefined)
      if (body !== null) {
        return {
          data: body,
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as AxiosResponse
      }
    }
    // Never reach a real API from the design-verification flow: a live server would
    // 401 the `dev-bypass-token`, the interceptor would fail its refresh, and the mock
    // session would be cleared — the very login bounce the flag exists to avoid.
    // Unmatched endpoints get a 404 so components render their empty/error states.
    return Promise.reject(
      new axios.AxiosError('Not mocked in dev-auth mode', '404', config, undefined, {
        data: { error: 'Not mocked', code: 'NOT_FOUND' },
        status: 404,
        statusText: 'Not Found',
        headers: {},
        config,
      } as AxiosResponse),
    )
  }
}
