// Sample content from Jobs Page.dc.html for the dev-auth / screenshot flow — dated
// relative to today so deadline tones ("2 days left") stay true whenever it is captured.
import { useAuthStore } from '@/stores/authStore'

const DAY = 86_400_000
const inDays = (n: number) => new Date(Date.now() + n * DAY).toISOString()

function poster(id: string, fullName: string, role: 'alumni' | 'faculty') {
  return { id, fullName, role, profile: { avatarUrl: null, headline: null, department: 'CSE' } }
}

const NUSRAT = poster('dev-alum-nusrat', 'Nusrat Jahan', 'alumni')
const SHAMSUL = poster('dev-fac-shamsul', 'Dr. Shamsul Alam', 'faculty')

interface MockJob {
  id: string
  title: string
  company: string
  location: string
  type: string
  description: string
  requirements: string[]
  eligibleDepartments: string[] | null
  eligibleBatches: string[] | null
  minCgpa: number | null
  deadline: string
  applicationCount: number
  isSaved: boolean
  studentStatus: string | null
  postedBy: ReturnType<typeof poster>
}

const JOBS: MockJob[] = [
  {
    id: 'dev-job-1',
    title: 'Junior backend engineer, Node and PostgreSQL',
    company: 'Brain Station 23',
    location: 'Mohakhali, Dhaka',
    type: 'full_time',
    description: 'Build and maintain REST services for a fintech client on Node.js and PostgreSQL. You will pair with a senior engineer, own small features end to end and join code review from week one.',
    requirements: ['Node.js', 'PostgreSQL', 'Docker'],
    eligibleDepartments: ['CSE'],
    eligibleBatches: ['2024', '2025', '2026'],
    minCgpa: 3,
    deadline: inDays(2),
    applicationCount: 17,
    isSaved: false,
    studentStatus: 'shortlisted',
    postedBy: NUSRAT,
  },
  {
    id: 'dev-job-2',
    title: 'Product design intern, six months',
    company: 'Sheba.xyz',
    location: 'Remote, Bangladesh',
    type: 'internship',
    description: "Work with the design lead on Sheba.xyz's service booking flows. Research with real customers, prototype in Figma and hand off specs to engineering. Six months, with a stipend.",
    requirements: ['Figma', 'User research'],
    eligibleDepartments: ['CSE', 'EEE'],
    eligibleBatches: null,
    minCgpa: null,
    deadline: inDays(24),
    applicationCount: 34,
    isSaved: false,
    studentStatus: null,
    postedBy: NUSRAT,
  },
  {
    id: 'dev-job-3',
    title: 'Data analyst, campus hiring drive',
    company: 'Therap BD',
    location: 'Banani, Dhaka',
    type: 'full_time',
    description: "Join Therap's analytics team for the campus hiring drive. Clean and model care-provider data, build Power BI dashboards and present findings to product owners each sprint.",
    requirements: ['SQL', 'Power BI', 'Statistics'],
    eligibleDepartments: ['CSE', 'EEE'],
    eligibleBatches: ['2024', '2025'],
    minCgpa: 3.5,
    deadline: inDays(5),
    applicationCount: 8,
    isSaved: true,
    studentStatus: null,
    postedBy: NUSRAT,
  },
  {
    id: 'dev-job-4',
    title: 'Research assistant, NLP lab',
    company: 'UIU CSE',
    location: 'United City, Dhaka',
    type: 'part_time',
    description: 'Part-time role in the CSE NLP lab. Annotate Bangla text corpora, run baseline experiments in PyTorch and help prepare a workshop paper. Around 12 hours a week.',
    requirements: ['Python', 'PyTorch'],
    eligibleDepartments: ['CSE'],
    eligibleBatches: null,
    minCgpa: 3.25,
    deadline: inDays(16),
    applicationCount: 5,
    isSaved: false,
    studentStatus: 'pending',
    postedBy: SHAMSUL,
  },
  {
    id: 'dev-job-5',
    title: 'Embedded firmware intern',
    company: 'Walton Hi-Tech',
    location: 'Gazipur',
    type: 'internship',
    description: "Write and test firmware for Walton's smart-home controllers. Bring-up of new boards, RTOS drivers and hardware-in-the-loop testing alongside the electronics team.",
    requirements: ['C', 'RTOS', 'Embedded C'],
    eligibleDepartments: ['EEE', 'ECE'],
    eligibleBatches: null,
    minCgpa: 3,
    deadline: inDays(20),
    applicationCount: 11,
    isSaved: false,
    studentStatus: null,
    postedBy: NUSRAT,
  },
]

const isStudent = () => useAuthStore.getState().user?.role === 'student'

function toJob(j: MockJob, extra: Record<string, unknown> = {}) {
  const { studentStatus, ...rest } = j
  return {
    ...rest,
    salaryRange: null,
    applicationUrl: null,
    viewCount: 0,
    isPublished: true,
    isScheduled: false,
    publishAt: null,
    myApplication: isStudent() && studentStatus ? { status: studentStatus } : null,
    ...extra,
  }
}

const POSTINGS: Record<string, ReturnType<typeof toJob>[]> = {
  alumni: [
    toJob(JOBS[0], { viewCount: 142 }),
    toJob({ ...JOBS[1], id: 'dev-post-2', title: 'Frontend engineer, React', company: 'Brain Station 23', deadline: inDays(26), applicationCount: 0 }, {
      viewCount: 0,
      isScheduled: true,
      publishAt: new Date(Date.now() + DAY).toISOString(),
    }),
    toJob({ ...JOBS[2], id: 'dev-post-3', title: 'QA engineer, contract, three months', company: 'Brain Station 23', deadline: inDays(-56), applicationCount: 6 }, { viewCount: 203 }),
  ],
  faculty: [toJob(JOBS[3], { viewCount: 91 })],
  admin: [],
}

function app(id: string, fullName: string, headline: string, daysAgo: number, status: string, notes: string | null = null) {
  return {
    id,
    applicant: { id: `${id}-u`, fullName, profile: { avatarUrl: null, headline, department: 'CSE' } },
    resumeUrl: 'https://example.com/cv.pdf',
    coverLetter: null,
    status,
    notes,
    appliedAt: inDays(-daysAgo),
  }
}

const APPS: Record<string, unknown[]> = {
  'dev-job-1': [
    app('a1', 'Tanvir Ahmed', 'CSE final year · backend and databases', 2, 'pending'),
    app('a2', 'Ishrat Binte Kabir', 'CSE · 2025 · Node, Go', 4, 'shortlisted', 'Strong take-home. Schedule a technical round.'),
    app('a3', 'Ayesha Siddika', 'CSE · 2026 · ACM ICPC regional', 5, 'interviewed'),
    app('a4', 'Mahin Chowdhury', 'EEE · 2024 · embedded systems', 8, 'withdrawn'),
  ],
  'dev-post-3': [app('a5', 'Samiha Akter', 'CSE · 2024 · test automation', 70, 'offered', 'Accepted the offer.')],
  'dev-job-4': [app('a7', 'Ayesha Siddika', 'CSE · 2026 · ACM ICPC regional', 1, 'pending')],
}

function page<T>(items: T[]) {
  return { data: { items, total: items.length, page: 1, hasMore: false } }
}

/** Returns the HTTP body to fake for a jobs GET, or null when the URL is not a jobs route. */
export function resolveJobsMock(url: string, params?: Record<string, unknown>): unknown | null {
  if (!url.startsWith('/jobs')) return null
  if (url === '/jobs') {
    const type = params?.type as string | undefined
    const search = (params?.search as string | undefined)?.toLowerCase()
    const items = JOBS.filter((j) => !type || j.type === type)
      .filter((j) => !search || `${j.title} ${j.company} ${j.requirements.join(' ')}`.toLowerCase().includes(search))
      .sort((a, b) => a.deadline.localeCompare(b.deadline))
      .map((j) => toJob(j))
    return page(items)
  }
  if (url === '/jobs/my') return page(POSTINGS[useAuthStore.getState().user?.role ?? ''] ?? [])
  if (url === '/jobs/saved') return page(JOBS.filter((j) => j.isSaved).map((j) => toJob(j)))
  if (url === '/jobs/applications/my') {
    const mine = JOBS.filter((j) => j.studentStatus).map((j, i) => ({
      id: `dev-myapp-${j.id}`,
      jobId: j.id,
      status: j.studentStatus,
      createdAt: inDays(-(3 + i * 4)),
      updatedAt: inDays(-1),
      job: { id: j.id, title: j.title, company: j.company, deadline: j.deadline, isActive: true },
    }))
    return page(mine)
  }
  const apps = url.match(/^\/jobs\/([^/]+)\/applications$/)
  if (apps) return page(APPS[apps[1]] ?? [])
  const detail = url.match(/^\/jobs\/([^/]+)$/)
  if (detail) {
    const all = [...JOBS.map((j) => toJob(j)), ...Object.values(POSTINGS).flat()]
    const job = all.find((j) => j.id === detail[1])
    return job ? { data: { ...job, attachments: [] } } : null
  }
  return null
}
