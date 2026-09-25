/**
 * DEV-ONLY canned data for `/news` and `/lost-found` under `?dev-auth=1` (see
 * devMocks.ts). It reproduces the sample content in News and Lost Found.dc.html — the
 * verification notice, the add/drop and job fair articles, the calculator and keys on
 * the board — so the screenshot harness captures the page the design describes.
 * Never wired into production.
 */

/** Matches AuthLoader's dev user, so the keys below are the viewer's own post. */
const ME = '11111111-1111-4111-8111-111111111111'

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString()
const daysFromNow = (d: number) => new Date(Date.now() + d * 24 * 3600_000).toISOString().slice(0, 10)

const author = (id: string, fullName: string, role: string, department: string | null) => ({
  id,
  fullName,
  avatarUrl: null,
  headline: null,
  department,
  role,
})

const REGISTRAR = author('dev-news-nr', 'Nafisa Rahman', 'admin', null)

const article = (
  id: string,
  category: string,
  title: string,
  summary: string,
  body: string,
  by: ReturnType<typeof author>,
  hours: number,
  extra: { isAnnouncement?: boolean; tags?: string[]; keyDate?: string | null } = {},
) => ({
  id,
  title,
  slug: id,
  body,
  summary,
  tags: extra.tags ?? [],
  keyDate: extra.keyDate ?? null,
  coverUrl: null,
  category,
  isPublished: true,
  isPinned: false,
  isAnnouncement: extra.isAnnouncement ?? false,
  isImported: false,
  authorId: by.id,
  viewCount: 0,
  publishedAt: hoursAgo(hours),
  createdAt: hoursAgo(hours),
  updatedAt: hoursAgo(hours),
  author: by,
  attachments: [],
})

const NEWS = [
  article(
    'dev-news-v1',
    'notice',
    'September trimester verification window is open',
    'Verification for the September trimester is open until 14 September. Upload your admission letter once and wait for the queue: duplicate requests do not move you up.',
    'Verification for the September trimester is open until 14 September. Upload your admission letter once and wait for the queue: duplicate requests do not move you up, they slow everyone behind you.\n\nWhat you need\nA scan or clear photo of your admission letter, your student ID number, and the department you were admitted into. Alumni instead upload the graduation certificate, and faculty are verified by the department, not by this form.\n\nHow long it takes\nTwo working days in the first week, longer in the last three days of the window. Requests submitted after 14 September are held for the next trimester rather than rejected.',
    REGISTRAR,
    30,
    { isAnnouncement: true, tags: ['verification'], keyDate: daysFromNow(14) },
  ),
  article(
    'dev-news-v2',
    'academic',
    'Add and drop closes Thursday for all departments',
    'Section changes after Thursday need the department head’s signature, and the eLMS gradebook locks the same evening.',
    'Section changes after Thursday need the department head’s signature, and the eLMS gradebook locks the same evening.',
    author('dev-news-reg', 'Registrar office', 'faculty', 'Registrar office'),
    54,
    { tags: ['add drop', 'elms'], keyDate: daysFromNow(11) },
  ),
  article(
    'dev-news-v3',
    'events',
    'Twenty two employers confirmed for the autumn job fair',
    'Product companies, service firms and three banks. Mock interviews run in room 214 from noon, first come first served.',
    'Product companies, service firms and three banks. Mock interviews run in room 214 from noon, first come first served.',
    author('dev-news-cs', 'Career services', 'faculty', 'Career services'),
    96,
    { tags: ['job fair'], keyDate: daysFromNow(18) },
  ),
  article(
    'dev-news-v4',
    'campus',
    'Shuttle route 3 moves fifteen minutes earlier',
    'From the first week of September, the Badda pickup leaves at 7:45 am. Route 1 and 2 timings are unchanged.',
    'From the first week of September, the Badda pickup leaves at 7:45 am. Route 1 and 2 timings are unchanged.',
    author('dev-news-to', 'Transport office', 'faculty', 'Transport office'),
    144,
    { tags: ['shuttle route 3'] },
  ),
]

const NEWS_RAIL = {
  sources: [
    { name: 'Registrar office', kind: 'admin', count: 9 },
    { name: 'Career services', kind: 'department', count: 5 },
    { name: 'Transport office', kind: 'department', count: 3 },
    { name: 'Central library', kind: 'department', count: 2 },
  ],
  keyDates: [
    { newsId: 'dev-news-v2', title: 'Add and drop closes for all departments', date: daysFromNow(11) },
    { newsId: 'dev-news-v1', title: 'Trimester verification window ends', date: daysFromNow(14) },
    { newsId: 'dev-news-v3', title: 'Autumn job fair, central auditorium', date: daysFromNow(18) },
  ],
  trendingTags: ['verification', 'job fair', 'add drop', 'shuttle route 3', 'elms'],
}

const lf = (
  id: string,
  type: 'lost' | 'found',
  postedBy: string,
  fullName: string,
  hours: number,
  itemName: string,
  description: string,
  locationDetail: string,
  contactInfo: string,
  isResolved = false,
) => ({
  id,
  universityId: 'dev',
  type,
  itemName,
  description,
  images: [],
  imageUrls: [],
  locationDetail,
  contactInfo,
  isResolved,
  resolvedAt: isResolved ? hoursAgo(hours - 1) : null,
  isPinned: false,
  isSaved: false,
  authorId: postedBy,
  createdAt: hoursAgo(hours),
  updatedAt: hoursAgo(hours),
  author: { fullName, avatarUrl: null, role: 'student', department: null, batchYear: null },
})

const LOST_FOUND = [
  lf('dev-lf-1', 'lost', 'dev-lf-sh', 'Sumaiya Haque', 0.7, 'Black Casio calculator, fx-991EX', 'Left it on the second row desk in room 512 after the algorithms class. My name is scratched on the back of the cover.', 'Room 512, academic building', 'sumaiya.haque@bscse.uiu.ac.bd · 01712 550 118'),
  lf('dev-lf-2', 'found', ME, 'Tanvir Ahmed', 3, 'Set of keys with a blue lanyard', 'Three keys and a small bottle opener, found near the shuttle pickup point. Left with the security desk at gate 2.', 'Gate 2 shuttle stop', 'Ask for it at the gate 2 security desk, or message me here.'),
  lf('dev-lf-3', 'lost', 'dev-lf-iz', 'Ishtiaq Zaman', 26, 'Student ID card, EEE 2025', 'Somewhere between the library and the canteen. The card is in a clear plastic sleeve with a bus pass behind it.', 'Library to canteen walkway', '01911 204 776'),
  lf('dev-lf-4', 'found', 'dev-lf-mr', 'Maliha Rahman', 96, 'Grey umbrella, wooden handle', 'Was in the lift lobby on the sixth floor for two days. Returned to the owner after they posted here.', 'Sixth floor lift lobby', 'maliha.rahman@bba.uiu.ac.bd', true),
]

const LOST_FOUND_STATS = {
  reunitedThisMonth: 23,
  resolvedPct: 78,
  avgResolveDays: 1.4,
  hotspots: [
    { place: 'Central library', count: 34 },
    { place: 'Shuttle pickup, gate 2', count: 21 },
    { place: 'Cafeteria, 2nd floor', count: 17 },
    { place: 'Academic building lifts', count: 12 },
  ],
  desk: { location: 'Gate 2 security office', hours: 'Open 8:00 am to 8:00 pm, Sun to Thu', holdPolicy: 'Unclaimed items are held 30 days' },
}

const page = <T>(items: T[]) => ({ data: { items, total: items.length, page: 1, hasMore: false } })

/** Returns the HTTP body to fake for a GET, or null when the URL is not news / lost & found. */
export function resolveNewsLostFoundMock(url: string, params?: Record<string, unknown>): unknown | null {
  if (url === '/news') {
    const category = typeof params?.category === 'string' ? params.category : null
    const tag = typeof params?.tag === 'string' ? params.tag : null
    const limit = typeof params?.limit === 'number' ? params.limit : undefined
    const items = NEWS.filter((n) => (!category || n.category === category) && (!tag || n.tags.includes(tag)))
    return page(items.slice(0, limit))
  }
  if (url === '/news/rail') return { data: NEWS_RAIL }
  const newsMatch = /^\/news\/([^/]+)$/.exec(url)
  if (newsMatch) {
    const found = NEWS.find((n) => n.id === newsMatch[1])
    return found ? { data: found } : null
  }
  if (url === '/lost-found') {
    const resolved = params?.isResolved === true
    const type = params?.type
    return page(LOST_FOUND.filter((i) => i.isResolved === resolved && (!type || i.type === type)))
  }
  if (url === '/lost-found/saved') return page([])
  if (url === '/lost-found/stats') return { data: LOST_FOUND_STATS }
  return null
}
