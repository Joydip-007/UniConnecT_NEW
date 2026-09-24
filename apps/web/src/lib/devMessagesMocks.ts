/**
 * DEV-ONLY canned data for `/messages` under `?dev-auth=1` (see devMocks.ts). It
 * reproduces the sample threads in Messages Page.dc.html — Nusrat Jahan's mentor
 * thread, the CSE batch group, Maliha's lab-sheet thread — so the screenshot
 * harness captures the page the design describes. Never wired into production.
 */

const ME = '11111111-1111-4111-8111-111111111111'

const minsAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()
const daysAgoAt = (days: number, hour: number, minute = 0) => {
  const d = new Date(Date.now() - days * 24 * 3600_000)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

type Role = 'student' | 'alumni' | 'faculty' | 'admin'

interface MockUser {
  id: string
  fullName: string
  role: Role
  headline: string | null
}

const U = {
  nusrat: { id: 'dev-msg-nusrat', fullName: 'Nusrat Jahan', role: 'alumni', headline: 'Senior engineer at Brain Station 23' },
  maliha: { id: 'dev-msg-maliha', fullName: 'Maliha Rahman', role: 'student', headline: 'CSE · 2022' },
  nasrin: { id: 'dev-msg-nasrin', fullName: 'Dr. Nasrin Sultana', role: 'faculty', headline: 'Faculty · CSE' },
  arif: { id: 'dev-msg-arif', fullName: 'Arif Chowdhury', role: 'alumni', headline: 'Alumni · CSE 2018' },
  farhan: { id: 'dev-msg-farhan', fullName: 'Farhan Kabir', role: 'student', headline: 'EEE · 2023' },
  tahsin: { id: 'dev-msg-tahsin', fullName: 'Tahsin Alam', role: 'student', headline: 'Class rep, CSE 2022' },
  rumana: { id: 'dev-msg-rumana', fullName: 'Rumana Haque', role: 'student', headline: 'CSE · 2022' },
  tahmid: { id: 'dev-msg-tahmid', fullName: 'Tahmid Hasan', role: 'student', headline: 'CSE · 2022' },
  me: { id: ME, fullName: 'Dev User', role: 'student', headline: null },
} satisfies Record<string, MockUser>

const member = (u: MockUser, lastReadAt: string | null = minsAgo(0)) => ({
  userId: u.id,
  lastReadAt,
  isMuted: false,
  joinedAt: daysAgoAt(60, 9),
  user: { id: u.id, role: u.role, fullName: u.fullName, avatarUrl: null, headline: u.headline },
})

const other = (u: MockUser) => ({
  id: u.id,
  fullName: u.fullName,
  role: u.role,
  profile: { avatarUrl: null, headline: u.headline },
})

interface ConvSeed {
  id: string
  type: 'direct' | 'group' | 'mentorship'
  name?: string
  with?: MockUser
  members?: MockUser[]
  group?: { id: string; name: string; type: string; memberCount: number }
  last: { body: string; mins: number; sender: MockUser; contentType?: string }
  unread: number
  pinned?: boolean
}

const SEEDS: ConvSeed[] = [
  { id: 'dev-conv-nusrat', type: 'mentorship', with: U.nusrat, last: { body: 'Sending the updated CV template now.', mins: 0, sender: U.nusrat }, unread: 1, pinned: true },
  { id: 'dev-conv-cse3213', type: 'group', name: 'CSE 3213 · Section B', members: [U.tahmid, U.maliha, U.rumana], group: { id: 'dev-grp-cse3213', name: 'CSE 3213 · Section B', type: 'academic', memberCount: 42 }, last: { body: 'lab 4 trace uploaded', mins: 8, sender: U.tahmid }, unread: 4, pinned: true },
  { id: 'dev-conv-batch', type: 'group', name: 'CSE 2022 · batch group', members: [U.tahsin, U.rumana, U.maliha], group: { id: 'dev-grp-batch', name: 'CSE 2022 · batch group', type: 'batch', memberCount: 148 }, last: { body: 'registration closes Sunday night', mins: 2, sender: U.tahsin }, unread: 3, pinned: true },
  { id: 'dev-conv-robotics', type: 'group', name: 'Robotics club core', members: [U.farhan, U.tahmid], group: { id: 'dev-grp-robotics', name: 'Robotics club core', type: 'club', memberCount: 9 }, last: { body: 'lab keys are with the front desk', mins: 60, sender: U.me }, unread: 0, pinned: true },
  { id: 'dev-conv-maliha', type: 'direct', with: U.maliha, last: { body: 'Sending the corrected sheet now.', mins: 4, sender: U.maliha }, unread: 2 },
  { id: 'dev-conv-nasrin', type: 'direct', with: U.nasrin, last: { body: 'Office hours moved to Thursday, 2 pm', mins: 14, sender: U.nasrin }, unread: 1 },
  { id: 'dev-conv-arif', type: 'direct', with: U.arif, last: { body: 'Shared a job: frontend engineer, Dhaka', mins: 180, sender: U.arif }, unread: 0 },
  { id: 'dev-conv-farhan', type: 'direct', with: U.farhan, last: { body: '', mins: 60 * 26, sender: U.farhan, contentType: 'image' }, unread: 0 },
]

function toConversation(s: ConvSeed) {
  const people = s.with ? [s.with] : (s.members ?? [])
  return {
    id: s.id,
    type: s.type,
    name: s.name ?? null,
    createdAt: daysAgoAt(60, 9),
    otherParticipant: s.with ? other(s.with) : null,
    participants: [member(U.me), ...people.map((p) => member(p, minsAgo(1)))],
    participantCount: people.length + 1,
    lastMessage: {
      body: s.last.body,
      sentAt: minsAgo(s.last.mins),
      senderId: s.last.sender.id,
      contentType: s.last.contentType ?? 'text',
      viewOnce: false,
      isDeleted: false,
    },
    unreadCount: s.unread,
    isPinned: !!s.pinned,
    isMuted: false,
    chatTheme: 'indigo',
    quickEmoji: '👍',
    isRequest: false,
    group: s.group ?? null,
  }
}

const CONVERSATIONS = SEEDS.map(toConversation)

let seq = 0
function msg(
  convId: string,
  sender: MockUser,
  sentAt: string,
  body: string,
  extra: Record<string, unknown> = {},
) {
  seq += 1
  return {
    id: `dev-msg-${convId}-${seq}`,
    conversationId: convId,
    senderId: sender.id,
    sender: { id: sender.id, fullName: sender.fullName, role: sender.role, profile: { avatarUrl: null } },
    body,
    sentAt,
    isDeleted: false,
    replyTo: null,
    contentType: 'text',
    attachments: [],
    mediaUrls: [],
    viewOnce: null,
    editedAt: null,
    reactions: {},
    ...extra,
  }
}

const file = (name: string, size: number, mimeType: string) => ({ url: `https://example.invalid/${name}`, name, size, mimeType })
const likes = (n: number) => ({ like: Array.from({ length: n }, (_, i) => ({ userId: `dev-r-${i}`, fullName: `Member ${i + 1}` })) })

const THREADS: Record<string, ReturnType<typeof msg>[]> = {
  'dev-conv-nusrat': [
    msg('nusrat', U.nusrat, daysAgoAt(40, 15, 10), 'Happy to take you on. Let us start with a CV review before we talk backend interviews.'),
    msg('nusrat', U.me, daysAgoAt(40, 15, 14), 'Sounds good, thank you for accepting.'),
    msg('nusrat', U.nusrat, daysAgoAt(32, 18, 48), 'Good session today. Trim the projects section to your three strongest and quantify impact.'),
    msg('nusrat', U.me, daysAgoAt(32, 18, 52), '', { contentType: 'file', attachments: [file('CV-draft-v2.pdf', 317_440, 'application/pdf')] }),
    msg('nusrat', U.nusrat, daysAgoAt(32, 19, 3), 'This is much tighter. Next session let us do a mock backend interview.'),
    msg('nusrat', U.nusrat, minsAgo(1), 'Booked Aug 24, 6 pm for the CV review follow up and interview prep.'),
    msg('nusrat', U.nusrat, minsAgo(0), 'Sending the updated CV template now.'),
  ],
  'dev-conv-maliha': [
    msg('maliha', U.maliha, daysAgoAt(1, 21, 4), 'Did you get the lab sheet for week 9? The version on eLMS looks wrong.'),
    msg('maliha', U.me, daysAgoAt(1, 21, 7), 'Yes, question 3 has the old dataset. I asked the TA.'),
    msg('maliha', U.maliha, minsAgo(14), 'She reuploaded it. Look at the last page, the values changed.'),
    msg('maliha', U.me, minsAgo(8), 'That matches what I ran. I will redo the plots tonight.'),
    msg('maliha', U.me, minsAgo(7), '', { contentType: 'file', attachments: [file('week9-plots.ipynb', 245_760, 'application/octet-stream')], reactions: likes(2) }),
    msg('maliha', U.maliha, minsAgo(4), 'Sending the corrected sheet now.'),
  ],
  'dev-conv-batch': [
    msg('batch', U.tahsin, minsAgo(90), 'Course registration closes Sunday 11:59 pm. Clear dues first or the portal blocks you.'),
    msg('batch', U.tahsin, minsAgo(89), '', { contentType: 'file', attachments: [file('registration-steps.pdf', 1_153_434, 'application/pdf')], reactions: likes(24) }),
    msg('batch', U.me, minsAgo(58), 'Are the CSE 4th year electives listed there too?'),
    msg('batch', U.rumana, minsAgo(50), 'Electives open a day later, Monday morning.'),
    msg('batch', U.tahsin, minsAgo(2), 'Registration closes Sunday night. Ping me if the portal errors out.'),
  ],
  'dev-conv-nasrin': [
    msg('nasrin', U.nasrin, minsAgo(40), 'Your thesis outline reads well. Tighten the scope in section 2.'),
    msg('nasrin', U.me, minsAgo(28), 'Thank you. Should I drop the second dataset entirely?'),
    msg('nasrin', U.nasrin, minsAgo(14), 'Keep it as future work. Office hours moved to Thursday, 2 pm.'),
  ],
}

const SHARED_FILES = [
  { messageId: 'dev-f1', senderId: U.me.id, sentAt: minsAgo(7), ...file('week9-plots.ipynb', 245_760, 'application/octet-stream') },
  { messageId: 'dev-f2', senderId: U.maliha.id, sentAt: minsAgo(30), ...file('lab-sheet-week9.pdf', 839_680, 'application/pdf') },
  { messageId: 'dev-f3', senderId: U.maliha.id, sentAt: minsAgo(60), ...file('dataset-corrected.csv', 98_304, 'text/csv') },
]

const COMMON_GROUPS = [
  { id: 'dev-grp-batch', name: 'CSE 2022 · batch group', type: 'batch', avatarUrl: null, memberCount: 148 },
  { id: 'dev-grp-robotics', name: 'Robotics club core', type: 'club', avatarUrl: null, memberCount: 9 },
]

const ONLINE = new Set([U.nusrat.id, U.maliha.id, U.nasrin.id, U.farhan.id, U.tahsin.id])

/** Returns the body for a messaging GET/POST, or null when the URL is not a messaging route. */
export function resolveMessagesMock(url: string): unknown | null {
  if (url === '/presence') {
    return {
      data: Object.values(U).map((u) => ({
        userId: u.id,
        status: ONLINE.has(u.id) ? 'online' : 'offline',
        lastSeenAt: ONLINE.has(u.id) ? null : minsAgo(180),
      })),
    }
  }
  if (url === '/conversations') return { data: CONVERSATIONS }
  const m = url.match(/^\/conversations\/([^/]+)(\/.*)?$/)
  if (!m) return null
  const [, convId, rest = ''] = m
  const conv = CONVERSATIONS.find((c) => c.id === convId)
  if (!conv) return null
  if (rest === '') return { data: conv }
  if (rest === '/messages') {
    const fallback = [msg(convId!, conv.otherParticipant ? U.nusrat : U.tahsin, conv.lastMessage.sentAt, conv.lastMessage.body || 'Sent a photo')]
    return { data: { items: THREADS[convId!] ?? fallback } }
  }
  if (rest === '/files') return { data: SHARED_FILES }
  if (rest === '/common-groups') return { data: COMMON_GROUPS }
  if (rest === '/read') return { data: {} }
  return null
}
