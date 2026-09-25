// Sample content from Mentorship Page.dc.html for the dev-auth / screenshot flow — dated
// relative to today so "Since", "requested 2 days ago" and "Expires in" stay true.
import { useAuthStore } from '@/stores/authStore'

const DAY = 86_400_000
const HOUR = 3_600_000
const ago = (ms: number) => new Date(Date.now() - ms).toISOString()
const dateAgo = (days: number) => ago(days * DAY).slice(0, 10)

function page<T>(items: T[]) {
  return { data: { items, total: items.length, page: 1, hasMore: false } }
}

function party(id: string, fullName: string, headline: string | null, batchYear: string, role: 'alumni' | 'student') {
  return { id, fullName, avatarUrl: null, headline, department: 'CSE', batchYear, role }
}

const lifecycle = {
  respondedAt: null,
  declineReason: null,
  endedAt: null,
  endedBy: null,
  endReason: null,
  endNote: null,
  sessionCount: 0,
  totalMinutes: 0,
  firstSessionDate: null,
  lastSessionDate: null,
  openSessionRequest: null,
}

function session(id: string, requestId: string, daysAgo: number, topic: string, minutes: number, notes: string) {
  return {
    id,
    requestId,
    createdBy: 'dev-alumni-nusrat',
    sessionDate: dateAgo(daysAgo),
    durationMinutes: minutes,
    topic,
    notes,
    pointsAwarded: 10,
    createdAt: ago(daysAgo * DAY),
    updatedAt: ago(daysAgo * DAY),
  }
}

const SESSIONS: Record<string, ReturnType<typeof session>[]> = {
  'dev-req-nusrat': [
    session('s1', 'dev-req-nusrat', 7, 'CV review for internship season', 45, 'Trim projects to three, lead with the thesis work.'),
    session('s2', 'dev-req-nusrat', 23, 'System design basics', 60, 'Read chapters 1 to 3 before next call.'),
    session('s3', 'dev-req-nusrat', 44, 'Kickoff: goals for the trimester', 30, 'Three goals: an internship offer by January, one open-source pull request, a mock interview every month.'),
  ],
  'dev-req-farhan': [
    session('f1', 'dev-req-farhan', 156, 'Final review: SQL portfolio', 50, 'Portfolio is ready to share. Add a short write-up to the churn dashboard explaining the metric choice.'),
    session('f2', 'dev-req-farhan', 195, 'Intro to dashboards', 40, 'Rebuild the sales sheet in Metabase. Keep one question per chart.'),
    session('f3', 'dev-req-farhan', 217, 'From Excel to SQL', 60, 'Finish the joins and window functions exercises before next session.'),
    session('f4', 'dev-req-farhan', 258, 'Kickoff', 40, 'Goal for the trimester: one public analysis project and a data internship application.'),
  ],
  'dev-req-mahmud': [
    session('m1', 'dev-req-mahmud', 297, 'Mock interview: data structures', 60, 'Solid on arrays and hashing. Practise explaining trade-offs aloud before coding.'),
    session('m2', 'dev-req-mahmud', 332, 'Choosing a thesis topic', 30, 'Shortlist two topics with a supervisor who publishes in the area.'),
  ],
}

function sessionAgg(requestId: string) {
  const s = SESSIONS[requestId] ?? []
  const dates = s.map((x) => x.sessionDate).sort()
  return {
    sessionCount: s.length,
    totalMinutes: s.reduce((n, x) => n + x.durationMinutes, 0),
    firstSessionDate: dates[0] ?? null,
    lastSessionDate: dates[dates.length - 1] ?? null,
  }
}

const MY_REQUESTS = [
  {
    ...lifecycle,
    ...sessionAgg('dev-req-nusrat'),
    id: 'dev-req-nusrat',
    message: 'Backend interviews and career direction.',
    status: 'accepted',
    sessionNotes: null,
    conversationId: 'dev-conv-nusrat',
    createdAt: ago(52 * DAY),
    updatedAt: ago(50 * DAY),
    respondedAt: ago(50 * DAY),
    alumni: {
      ...party('dev-alumni-nusrat', 'Nusrat Jahan', 'Senior engineer at Brain Station 23', '2019', 'alumni'),
      availability: ['Tue, 6:00 to 8:00 pm', 'Thu, 6:00 to 8:00 pm', 'Sat, 10:00 am to 12:00 pm'],
    },
  },
  {
    ...lifecycle,
    ...sessionAgg('dev-req-farhan'),
    id: 'dev-req-farhan',
    message: 'Data analytics.',
    status: 'completed',
    sessionNotes: null,
    conversationId: null,
    createdAt: ago(262 * DAY),
    updatedAt: ago(156 * DAY),
    endedAt: ago(156 * DAY),
    endReason: 'Goals met',
    alumni: { ...party('dev-alumni-farhan', 'Farhan Kabir', 'Data analyst at bKash', '2016', 'alumni'), availability: [] },
  },
  {
    ...lifecycle,
    ...sessionAgg('dev-req-mahmud'),
    id: 'dev-req-mahmud',
    message: 'Thesis and interviews.',
    status: 'completed',
    sessionNotes: null,
    conversationId: null,
    createdAt: ago(335 * DAY),
    updatedAt: ago(297 * DAY),
    endedAt: ago(297 * DAY),
    alumni: { ...party('dev-alumni-mahmud', 'Mahmud Hasan', 'Software engineer at Pathao', '2015', 'alumni'), availability: [] },
  },
  {
    ...lifecycle,
    id: 'dev-req-imran',
    message: 'Frontend career advice.',
    status: 'declined',
    sessionNotes: null,
    conversationId: null,
    createdAt: ago(16 * DAY),
    updatedAt: ago(14 * DAY),
    respondedAt: ago(14 * DAY),
    declineReason: 'At mentee capacity this trimester',
    alumni: { ...party('dev-alumni-imran', 'Imran Hossain', 'Frontend lead at Shohoz', '2014', 'alumni'), availability: [] },
  },
]

function mentor(
  id: string,
  fullName: string,
  headline: string,
  batchYear: string,
  topics: string[],
  current: number,
  max: number,
  sessionsCompleted: number,
  avgReplyHours: number,
) {
  return {
    id,
    universityId: 'dev-uni',
    fullName,
    role: 'alumni',
    headline,
    department: 'CSE',
    batchYear,
    skills: [],
    avatarUrl: null,
    maxMentees: max,
    currentMentees: current,
    topics,
    availability: [],
    sessionsCompleted,
    avgReplyHours,
    isWaitlisted: false,
  }
}

const MENTORS = [
  mentor('dev-alumni-rafiq', 'Rafiq Karim', 'Design lead at Sheba.xyz', '2017', ['Product design', 'Portfolio review', 'Interviews'], 2, 5, 14, 46),
  mentor('dev-alumni-samiha', 'Samiha Akter', 'PhD candidate, TU Delft', '2020', ['Higher studies', 'Scholarships', 'Research'], 3, 3, 31, 30),
  mentor('dev-alumni-nadia', 'Nadia Islam', 'Backend engineer at Optimizely', '2018', ['Backend', 'System design', 'Interviews'], 1, 4, 9, 10),
]

// ── Alumni view ─────────────────────────────────────────────────────────────

function incoming(
  id: string,
  student: ReturnType<typeof party>,
  message: string,
  createdAgoMs: number,
  status: 'pending' | 'accepted',
  extra: Record<string, unknown> = {},
) {
  return {
    ...lifecycle,
    id,
    message,
    status,
    sessionNotes: null,
    conversationId: status === 'accepted' ? `dev-conv-${id}` : null,
    createdAt: ago(createdAgoMs),
    updatedAt: ago(createdAgoMs),
    student,
    ...extra,
  }
}

const PENDING = [
  incoming(
    'dev-in-tanvir',
    party('dev-student-tanvir', 'Tanvir Rahman', null, '2026', 'student'),
    'Looking for guidance on backend interviews and whether to target product companies or services firms after graduation.',
    2 * DAY,
    'pending',
  ),
  incoming(
    'dev-in-maliha',
    party('dev-student-maliha', 'Maliha Khan', null, '2027', 'student'),
    'Would love help preparing a portfolio for backend-heavy internships this winter.',
    5 * HOUR,
    'pending',
  ),
]

const MENTEES = [
  incoming('dev-in-farhana', party('dev-student-farhana', 'Farhana Ahmed', null, '2025', 'student'), 'CV help', 60 * DAY, 'accepted', {
    sessionCount: 2,
    totalMinutes: 90,
    openSessionRequest: {
      id: 'sr-farhana',
      requestId: 'dev-in-farhana',
      requestedBy: 'dev-student-farhana',
      slotLabel: 'Thu, 6:30 pm',
      topic: 'Cover letter review',
      status: 'requested',
      createdAt: ago(DAY),
    },
  }),
  incoming('dev-in-rakib', party('dev-student-rakib', 'Rakib Hasan', null, '2027', 'student'), 'Interviews', 70 * DAY, 'accepted', {
    sessionCount: 2,
    totalMinutes: 105,
    openSessionRequest: {
      id: 'sr-rakib',
      requestId: 'dev-in-rakib',
      requestedBy: '11111111-1111-4111-8111-111111111111',
      slotLabel: 'Sat, 10:00 am',
      topic: 'Mock interview',
      status: 'scheduled',
      createdAt: ago(2 * DAY),
    },
  }),
  incoming('dev-in-priya', party('dev-student-priya', 'Priya Sen', null, '2026', 'student'), 'Career paths', 80 * DAY, 'accepted', {
    sessionCount: 2,
    totalMinutes: 60,
  }),
]

const HISTORY = [
  ['Farhana Ahmed', 'dev-student-farhana', 'CV and portfolio review', 12, 45, 'Reviewed resume formatting and tailored two cover letters.'],
  ['Rakib Hasan', 'dev-student-rakib', 'Mock backend interview', 18, 60, 'Ran a systems-design mock and gave feedback on trade-offs.'],
  ['Priya Sen', 'dev-student-priya', 'Career path discussion', 24, 30, 'Compared grad school vs industry paths for her interests.'],
  ['Farhana Ahmed', 'dev-student-farhana', 'Resume walkthrough', 31, 45, 'Line-by-line pass on the resume, flagged weak bullet points.'],
  ['Rakib Hasan', 'dev-student-rakib', 'Portfolio review', 37, 45, 'Went through his GitHub projects and suggested a README rewrite.'],
  ['Priya Sen', 'dev-student-priya', 'Intro call', 45, 30, 'Introductions and set expectations for the trimester.'],
] as const

const SETTINGS = {
  isOpenToMentorship: true,
  maxMentees: 5,
  topics: ['Backend', 'Interviews', 'Portfolio review'],
  availability: ['Tue, 6:00 to 8:00 pm', 'Thu, 6:00 to 8:00 pm', 'Sat, 10:00 am to 12:00 pm'],
  currentMentees: 2,
  pendingRequests: 2,
}

/** Returns the HTTP body to fake for a mentorship GET, or null when the URL is not a mentorship route. */
export function resolveMentorshipMock(url: string, params?: Record<string, unknown>): unknown | null {
  if (!url.startsWith('/mentorship')) return null
  const role = useAuthStore.getState().user?.role
  if (url === '/mentorship/alumni') return page(MENTORS)
  if (url === '/mentorship/requests/mine') return page(role === 'student' ? MY_REQUESTS : [])
  if (url === '/mentorship/requests/incoming') {
    return page(params?.status === 'accepted' ? MENTEES : params?.status === 'pending' ? PENDING : [])
  }
  const sessions = url.match(/^\/mentorship\/requests\/([^/]+)\/sessions$/)
  if (sessions) return { data: SESSIONS[sessions[1]] ?? [] }
  if (url === '/mentorship/settings') return { data: SETTINGS }
  if (url === '/mentorship/rewards/me') return { data: { points: 60, pointsPerSession: 10, pointsPerUsd: 100, history: [] } }
  if (url === '/mentorship/gift-cards') {
    return {
      data: [
        { id: 'gc1', vendor: 'Google', title: 'Google Play gift card', description: null, imageUrl: null, valueUsdCents: 100, thresholdPoints: 100 },
        { id: 'gc2', vendor: 'Steam', title: 'Steam wallet code', description: null, imageUrl: null, valueUsdCents: 500, thresholdPoints: 500 },
      ],
    }
  }
  if (url === '/mentorship/sessions/mine') {
    return {
      data: {
        items: HISTORY.map(([name, sid, topic, days, minutes, notes], i) => ({
          kind: 'session',
          ...session(`h${i}`, 'x', days, topic, minutes, notes),
          student: { id: sid, fullName: name, avatarUrl: null },
        })),
        totalSessions: HISTORY.length,
        pointsEarned: HISTORY.length * 10,
      },
    }
  }
  return null
}
