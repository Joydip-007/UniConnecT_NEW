import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import type { PublicUserProfile } from '@uniconnect/shared'
import { api } from '@/lib/axios'

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

/** Returns the HTTP body to fake for a GET, or null to defer to the real adapter. */
function resolveMockBody(url: string): unknown | null {
  if (url === '/groups') return { data: { items: [DEV_GROUP], total: 1, page: 1, hasMore: false } }
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
  usersByRole: { student: 1100, alumni: 90, faculty: 40, admin: 10 }, moderationHealth: { openReports: 3, resolvedLast7d: 12, avgResolutionHours: 6 },
}

let installed = false

export function installDevMocks(): void {
  if (installed) return
  installed = true

  api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    const method = (config.method ?? 'get').toLowerCase()
    const url = config.url ?? ''
    if (method === 'get' || method === 'post') {
      const body = resolveMockBody(url)
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
