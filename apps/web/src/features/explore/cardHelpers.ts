import { format, formatDistanceToNowStrict, parseISO } from 'date-fns'
import type { UserRole } from '@uniconnect/shared'
import type {
  EventSearchResult,
  GroupSearchResult,
  JobSearchResult,
  PostSearchResult,
  UserSearchResult,
} from '@/features/search'
import type { EventSummary, GroupSummary, UserSuggestion } from './types'

export type SeeAllKey = 'trending' | 'people' | 'groups' | 'events' | 'alumni'

export const SEE_ALL_KEYS: readonly SeeAllKey[] = ['trending', 'people', 'groups', 'events', 'alumni']

const GROUP_KIND_LABEL: Record<string, string> = {
  department: 'Department',
  club: 'Club',
  batch: 'Batch',
  research: 'Research',
  interest: 'Interest',
  academic: 'Section',
  other: 'Group',
}

export function groupKindLabel(type: string): string {
  return GROUP_KIND_LABEL[type] ?? 'Group'
}

/**
 * Why a non-member cannot open a private group, or `null` when they can. Discovery
 * cards carry a Request button beside them; search rows do not, so they get the
 * plainer message.
 */
export function privateGroupNotice(group: {
  isPrivate: boolean
  isMember: boolean
  requestPending?: boolean
  canRequest?: boolean
}): string | null {
  if (!group.isPrivate || group.isMember) return null
  if (group.requestPending) return "Your request to join is pending. You'll be able to open this group once an admin approves it."
  if (group.canRequest) return 'This is a private group. Send a join request to see its posts and members.'
  return 'This is a private group. Only members can see its posts and members.'
}

/** Discovery groups carry their own Request button, so the notice can point at it. */
export function discoveryGroupNotice(group: GroupSummary): string | null {
  return privateGroupNotice({
    isPrivate: group.isPrivate,
    isMember: !!group.joined,
    requestPending: group.requestPending,
    canRequest: true,
  })
}

export function knownLabel(count: number): string {
  if (count === 0) return 'No one you know yet'
  return count === 1 ? '1 person you know' : `${count} people you know`
}

/** "Sat · 10:00 · Auditorium" — a real date and time, so clashes with a class are visible. */
export function eventWhen(event: EventSummary): string {
  const d = parseISO(event.startsAt)
  return [format(d, 'EEE'), format(d, 'HH:mm'), event.location].filter(Boolean).join(' · ')
}

export function alumniMeta(person: UserSuggestion): string {
  return [person.department, person.batchYear ? `Class of ${person.batchYear}` : null].filter(Boolean).join(' · ')
}

// ── Search result rows ───────────────────────────────────────────────────────
// The Explore design renders every search result as a plain two-line row: a title and
// one meta line. These map each result type onto that shape.

export interface ResultRowData {
  id: string
  to: string
  title: string
  meta: string
  /** Role badge before the title — the row *is* a person. */
  titleRole?: UserRole
  /** Role badge before the meta line — it leads with the author's name. */
  metaRole?: UserRole
  /** When set, the row cannot be opened: clicking shows this instead of navigating. */
  locked?: string | null
}

const JOB_TYPE_LABEL: Record<string, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  internship: 'Internship',
  contract: 'Contract',
  remote: 'Remote',
}

const humanize = (v: string) => JOB_TYPE_LABEL[v] ?? v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, ' ')

export function personRow(p: UserSearchResult): ResultRowData {
  const year = p.batchYear ? (p.role === 'alumni' ? `Class of ${p.batchYear}` : p.batchYear) : null
  return {
    id: p.id,
    to: `/profile/${p.id}`,
    title: p.fullName,
    titleRole: p.role,
    meta: [p.headline, p.department, year].filter(Boolean).join(' · '),
  }
}

export function postRow(p: PostSearchResult): ResultRowData {
  return {
    id: p.id,
    to: `/feed/${p.id}`,
    title: p.content,
    meta: `${p.author.fullName} · ${formatDistanceToNowStrict(parseISO(p.createdAt), { addSuffix: true })}`,
    metaRole: p.author.role,
  }
}

export function jobRow(j: JobSearchResult): ResultRowData {
  return {
    id: j.id,
    to: `/jobs/${j.id}`,
    title: j.title,
    meta: [j.company, j.location, j.type ? humanize(j.type) : null].filter(Boolean).join(' · '),
  }
}

export function eventRow(e: EventSearchResult): ResultRowData {
  return {
    id: e.id,
    to: `/events/${e.id}`,
    title: e.title,
    meta: [e.location, format(parseISO(e.startsAt), 'd MMM yyyy')].filter(Boolean).join(' · '),
  }
}

export function groupRow(g: GroupSearchResult): ResultRowData {
  return {
    id: g.id,
    to: `/groups/${g.id}`,
    title: g.name,
    meta: [
      groupKindLabel(g.type),
      g.isPrivate ? 'Private' : null,
      `${g.memberCount.toLocaleString()} members`,
      g.isMember ? 'Joined' : null,
    ]
      .filter(Boolean)
      .join(' · '),
    locked: privateGroupNotice(g),
  }
}
