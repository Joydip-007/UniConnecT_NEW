import { useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { LucideIcon } from 'lucide-react'
import {
  Bus,
  Calendar,
  CalendarClock,
  FileText,
  Flag,
  Gift,
  GraduationCap,
  Handshake,
  Medal,
  Newspaper,
  Pin,
  ShieldCheck,
  Trash2,
  UsersRound,
} from 'lucide-react'
import type { AdminContentSummary, ContentSyncConfig, ContentSyncRun } from '@uniconnect/shared'
import { api } from '@/lib/axios'
import { PATHS } from '@/router/paths'
import { CONTENT_SUMMARY_KEY } from '@/pages/admin/useContentSummary'

/**
 * The admin rail is route-aware: the queue and the stats card change payload with the
 * admin tab you are on, so the rail answers "what needs me *here*" rather than repeating
 * the same four campus numbers on every screen. Every figure comes from an endpoint the
 * matching tab already reads, under that tab's own query key, so switching tabs never
 * double-fetches and a mutation on the tab invalidates the rail for free.
 *
 * Nothing here is hardcoded. A route whose data is not loaded yet renders no card —
 * the widgets self-hide like every other right-rail widget.
 */

export type AdminRoute =
  | 'insights'
  | 'moderation'
  | 'groups'
  | 'members'
  | 'announcements'
  | 'content'
  | 'content-sync'
  | 'learning'
  | 'shuttle'
  | 'mentorship'

export type Tone = 'red' | 'amber' | 'indigo' | 'cyan' | 'mint' | 'neutral'

export const TONE: Record<Tone, { color: string; bg: string; bdr: string }> = {
  red: { color: 'var(--uc-red)', bg: 'var(--uc-red-bg)', bdr: 'var(--uc-red-bdr)' },
  amber: { color: 'var(--uc-amber-l)', bg: 'var(--uc-amber-bg)', bdr: 'var(--uc-amber-bdr)' },
  indigo: { color: 'var(--uc-indigo-l)', bg: 'var(--uc-indigo-bg)', bdr: 'var(--uc-indigo-bdr)' },
  cyan: { color: 'var(--uc-cyan)', bg: 'var(--uc-cyan-bg)', bdr: 'var(--uc-cyan-bdr)' },
  mint: { color: 'var(--uc-mint)', bg: 'var(--uc-mint-bg)', bdr: 'var(--uc-mint-bdr)' },
  neutral: { color: 'var(--text-secondary)', bg: 'var(--surface-raised)', bdr: 'var(--border-default)' },
}

export interface QueueRow {
  key: string
  label: string
  meta: string
  icon: LucideIcon
  tone: Tone
  /** Absent when the row is informational — it renders without a hover affordance. */
  to?: string
}

export interface QueueSpec {
  title: string
  badge: string
  badgeTone: Tone
  rows: QueueRow[]
  emptyLabel: string
  /** Omitted when the destination is the screen the reader is already on. */
  cta?: { label: string; to: string }
}

export interface StatRow {
  label: string
  value: string
  delta: string
  tone?: Tone
}

export interface StatsSpec {
  title: string
  rows: StatRow[]
}

export interface AdminRail {
  route: AdminRoute
  queue: QueueSpec | null
  stats: StatsSpec | null
  /** Insights leads with numbers since nothing on that screen is itself actionable. */
  statsFirst: boolean
}

const STALE = 60_000

const ADMIN_ROUTES: AdminRoute[] = [
  'insights', 'moderation', 'groups', 'members', 'announcements', 'content', 'content-sync', 'learning', 'shuttle',
]

/** Deep link into an admin tab — the same `?tab=` contract the left rail uses. */
export function adminTab(tab: Exclude<AdminRoute, 'mentorship'>): string {
  return `${PATHS.ADMIN}?tab=${tab}`
}

/**
 * Which admin surface the reader is looking at. `/mentorship` is an admin screen too
 * (the page swaps in `MentorshipTab` for admins), so it gets its own payload; any other
 * page — profile, settings, messages — falls back to the campus-wide Insights set.
 */
export function useAdminRoute(): AdminRoute {
  const { pathname, search } = useLocation()
  if (pathname === PATHS.MENTORSHIP) return 'mentorship'
  if (pathname !== PATHS.ADMIN) return 'insights'
  const tab = new URLSearchParams(search).get('tab')
  return ADMIN_ROUTES.includes(tab as AdminRoute) ? (tab as AdminRoute) : 'insights'
}

// ── Shapes, kept identical to what the owning tab already caches ──────────────

interface Paginated<T> {
  items: T[]
  total: number
  page: number
}

interface AdminStats {
  users: number
  activeUsers: number
  postsByDay: { date: string; count: number }[]
  verificationsByRole: { role: string; count: number }[]
  escalatedReports: number
  verificationRequests: number
  deletionRequests: number
  resolvedPct7d: number
  pendingInviteBatches: number
  moderationHealth: { reportsOpen: number; resolvedPct7d: number; medianResponseHours: number; repeatOffenders: number }
}

interface PendingImported {
  news: { id: string }[]
  events: { id: string }[]
}

interface AdminGroupItem {
  id: string
  name: string
  pendingRequestCount: number
}

interface GroupsPage extends Paginated<AdminGroupItem> {
  summary: { totalGroups: number; privateGroups: number; totalMembers: number; pendingRequests: number; createdThisWeek: number }
}

interface AnnouncementItem {
  id: string
  content: string
  isPinned: boolean
  isPublished: boolean
  publishAt: string | null
  viewCount: number
}

interface PendingPath {
  id: string
  title: string
}

interface AdminLearningPath {
  id: string
  title: string
  isPublished: boolean
  enrolledCount: number
  completionRate: number
}

interface ShuttleRoute {
  id: string
  name: string
}

interface ShuttleStats {
  busesLive: number
  activeRoutes: number
  onDutyDrivers: number
  onTimeRatePct: number | null
  routes: { routeId: string; isLive: boolean }[]
}

interface MentorSummary {
  id: string
  maxMentees: number
  currentMentees: number
  completedCount: number
  totalSessions: number
}

interface Redemption {
  id: string
}

const ROLE_LABELS: Record<string, string> = {
  student: 'Student IDs',
  alumni: 'Alumni proofs',
  faculty: 'Faculty accounts',
  admin: 'Admin accounts',
}

const ROLE_ICONS: Record<string, LucideIcon> = {
  student: GraduationCap,
  alumni: Medal,
  faculty: ShieldCheck,
  admin: ShieldCheck,
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function truncate(s: string, max = 40): string {
  const line = s.split('\n')[0].trim()
  return line.length > max ? `${line.slice(0, max - 1)}…` : line
}

/** Builds the queue + stats pair for the current admin route. */
export function useAdminRail(): AdminRail {
  const route = useAdminRoute()
  const needs = (...routes: AdminRoute[]) => routes.includes(route)

  const { data: stats } = useQuery<AdminStats>({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.get<{ data: AdminStats }>('/admin/stats').then((r) => r.data.data),
    enabled: needs('insights', 'moderation', 'members', 'announcements'),
    staleTime: STALE,
  })

  const { data: pending } = useQuery<PendingImported>({
    queryKey: ['content-sync', 'pending'],
    queryFn: () => api.get<{ data: PendingImported }>('/admin/content-sync/pending').then((r) => r.data.data),
    enabled: needs('insights', 'content', 'content-sync'),
    staleTime: STALE,
  })

  const { data: summary } = useQuery<AdminContentSummary>({
    queryKey: CONTENT_SUMMARY_KEY,
    queryFn: () => api.get<{ data: AdminContentSummary }>('/admin/content/summary').then((r) => r.data.data),
    enabled: needs('content'),
    staleTime: STALE,
  })

  const { data: groups } = useQuery<GroupsPage>({
    queryKey: ['admin', 'groups', 1],
    queryFn: () =>
      api.get<{ data: GroupsPage }>('/admin/groups', { params: { page: 1, limit: 20 } })
        .then((r) => ({ ...r.data.data, limit: 20 })),
    enabled: needs('groups'),
    staleTime: STALE,
  })

  const { data: announcements } = useQuery<Paginated<AnnouncementItem>>({
    queryKey: ['admin', 'content', 'posts', 'announcement', 1],
    queryFn: () =>
      api.get<{ data: Paginated<AnnouncementItem> }>('/admin/content/posts', {
        params: { page: 1, limit: 20, filter: 'announcement' },
      }).then((r) => ({ ...r.data.data, limit: 20 })),
    enabled: needs('announcements'),
    staleTime: STALE,
  })

  const { data: pendingPaths } = useQuery<PendingPath[]>({
    queryKey: ['learning-admin', 'pending-paths'],
    queryFn: () => api.get<{ data: PendingPath[] }>('/admin/learning/pending-paths').then((r) => r.data.data),
    enabled: needs('learning'),
    staleTime: STALE,
  })

  const { data: paths } = useQuery<AdminLearningPath[]>({
    queryKey: ['learning-admin', 'paths', { status: 'all' }],
    queryFn: () =>
      api.get<{ data: AdminLearningPath[] }>('/admin/learning/paths', { params: { status: 'all' } })
        .then((r) => r.data.data),
    enabled: needs('learning'),
    staleTime: STALE,
  })

  const { data: syncConfig } = useQuery<ContentSyncConfig>({
    queryKey: ['content-sync', 'config'],
    queryFn: () => api.get<{ data: ContentSyncConfig }>('/admin/content-sync/config').then((r) => r.data.data),
    enabled: needs('content-sync'),
    staleTime: STALE,
  })

  const { data: syncRuns } = useQuery<ContentSyncRun[]>({
    queryKey: ['content-sync', 'runs'],
    queryFn: () =>
      api.get<{ data: { items: ContentSyncRun[] } }>('/admin/content-sync/runs', { params: { limit: 10 } })
        .then((r) => r.data.data.items),
    enabled: needs('content-sync'),
    staleTime: STALE,
  })

  const { data: shuttleRoutes } = useQuery<ShuttleRoute[]>({
    queryKey: ['admin', 'shuttle', 'routes'],
    queryFn: () => api.get<{ data: ShuttleRoute[] }>('/shuttle/routes?includeInactive=true').then((r) => r.data.data),
    enabled: needs('shuttle'),
    staleTime: STALE,
  })

  const { data: shuttleStats } = useQuery<ShuttleStats>({
    queryKey: ['admin', 'shuttle', 'stats'],
    queryFn: () => api.get<{ data: ShuttleStats }>('/admin/shuttle/stats').then((r) => r.data.data),
    enabled: needs('shuttle'),
    staleTime: STALE,
  })

  const { data: mentors } = useQuery<Paginated<MentorSummary>>({
    queryKey: ['admin', 'mentorship', 'mentors', 1],
    queryFn: () =>
      api.get<{ data: Paginated<MentorSummary> }>('/admin/mentorship/mentors', { params: { page: 1, limit: 20 } })
        .then((r) => r.data.data),
    enabled: needs('mentorship'),
    staleTime: STALE,
  })

  const { data: redemptions } = useQuery<Paginated<Redemption>>({
    queryKey: ['admin', 'mentorship', 'redemptions', { status: 'pending' }],
    queryFn: () =>
      api.get<{ data: Paginated<Redemption> }>('/admin/mentorship/redemptions', {
        params: { status: 'pending', page: 1, limit: 30 },
      }).then((r) => r.data.data),
    enabled: needs('mentorship'),
    staleTime: STALE,
  })

  const importedDrafts = pending ? pending.news.length + pending.events.length : 0

  const modRows = (s: AdminStats): QueueRow[] => [
    { key: 'escalated', label: 'Escalated reports', meta: String(s.escalatedReports), icon: Flag, tone: 'red', to: adminTab('moderation') },
    { key: 'deletions', label: 'Deletion requests', meta: String(s.deletionRequests), icon: Trash2, tone: 'amber', to: adminTab('moderation') },
  ]

  const empty: AdminRail = { route, queue: null, stats: null, statsFirst: false }

  switch (route) {
    case 'moderation': {
      if (!stats) return empty
      const h = stats.moderationHealth
      return {
        route,
        statsFirst: false,
        queue: {
          title: 'Moderation queue',
          badge: `${h.reportsOpen} open`,
          badgeTone: h.reportsOpen > 0 ? 'red' : 'mint',
          rows: modRows(stats),
          emptyLabel: 'Nothing waiting.',
        },
        stats: {
          title: 'Moderation health',
          rows: [
            { label: 'Reports open', value: String(h.reportsOpen), delta: 'awaiting action', tone: h.reportsOpen > 0 ? 'red' : 'mint' },
            { label: 'Resolved', value: `${h.resolvedPct7d}%`, delta: 'last 7 days', tone: 'mint' },
            { label: 'Median response', value: `${h.medianResponseHours}h`, delta: 'last 7 days', tone: h.medianResponseHours > 6 ? 'amber' : 'mint' },
            { label: 'Repeat targets', value: String(h.repeatOffenders), delta: 'reported twice+', tone: h.repeatOffenders > 0 ? 'amber' : undefined },
          ],
        },
      }
    }

    case 'content': {
      if (!summary || !pending) return empty
      const decisions = summary.reportsOpen + importedDrafts
      return {
        route,
        statsFirst: false,
        queue: {
          title: 'Needs a decision',
          badge: plural(decisions, 'item'),
          badgeTone: decisions > 0 ? 'amber' : 'mint',
          rows: [
            { key: 'reported', label: 'Reported posts', meta: String(summary.reportsOpen), icon: Flag, tone: 'red', to: adminTab('moderation') },
            { key: 'imported', label: 'Imported drafts', meta: String(importedDrafts), icon: FileText, tone: 'indigo', to: adminTab('content-sync') },
            { key: 'pinned', label: 'Pinned', meta: String(summary.pinned), icon: Pin, tone: 'neutral' },
          ],
          emptyLabel: 'Nothing waiting.',
          cta: { label: 'Open moderation', to: adminTab('moderation') },
        },
        stats: {
          title: 'Content mix',
          rows: [
            { label: 'Posts', value: summary.byType.post.toLocaleString(), delta: 'member posts' },
            { label: 'News items', value: summary.byType.news.toLocaleString(), delta: 'in the feed' },
            { label: 'Events', value: summary.byType.event_promo.toLocaleString(), delta: 'promoted' },
            { label: 'Jobs', value: summary.byType.job_promo.toLocaleString(), delta: 'promoted' },
          ],
        },
      }
    }

    case 'groups': {
      if (!groups) return empty
      const g = groups.summary
      return {
        route,
        statsFirst: false,
        queue: {
          title: 'Join requests',
          badge: `${g.pendingRequests} pending`,
          badgeTone: g.pendingRequests > 0 ? 'amber' : 'mint',
          rows: groups.items
            .filter((x) => x.pendingRequestCount > 0)
            .slice(0, 3)
            .map((x) => ({ key: x.id, label: x.name, meta: String(x.pendingRequestCount), icon: UsersRound, tone: 'amber' as Tone })),
          emptyLabel: 'No join requests waiting.',
        },
        stats: {
          title: 'Group activity',
          rows: [
            { label: 'Groups', value: g.totalGroups.toLocaleString(), delta: `${g.privateGroups} private` },
            { label: 'Members', value: g.totalMembers.toLocaleString(), delta: 'across all groups' },
            { label: 'Pending', value: String(g.pendingRequests), delta: 'join requests', tone: g.pendingRequests > 0 ? 'amber' : undefined },
            { label: 'New this week', value: String(g.createdThisWeek), delta: 'groups created', tone: 'mint' },
          ],
        },
      }
    }

    case 'members': {
      if (!stats) return empty
      const waiting = stats.verificationsByRole.reduce((sum, r) => sum + r.count, 0)
      return {
        route,
        statsFirst: false,
        queue: {
          title: 'Verification queue',
          badge: `${waiting} waiting`,
          badgeTone: waiting > 0 ? 'red' : 'mint',
          rows: stats.verificationsByRole
            .filter((r) => r.count > 0)
            .map((r, i) => ({
              key: r.role,
              label: ROLE_LABELS[r.role] ?? r.role,
              meta: String(r.count),
              icon: ROLE_ICONS[r.role] ?? ShieldCheck,
              tone: (i === 0 ? 'red' : 'amber') as Tone,
            })),
          emptyLabel: 'Every account is verified.',
        },
        stats: {
          title: 'Membership',
          rows: [
            { label: 'Active members', value: stats.activeUsers.toLocaleString(), delta: 'last 30 days', tone: 'mint' },
            { label: 'All members', value: stats.users.toLocaleString(), delta: 'on the platform' },
            { label: 'Invite batches', value: String(stats.pendingInviteBatches), delta: 'still open', tone: stats.pendingInviteBatches > 0 ? 'amber' : undefined },
            { label: 'Unverified', value: String(stats.verificationRequests), delta: 'awaiting review', tone: stats.verificationRequests > 0 ? 'red' : undefined },
          ],
        },
      }
    }

    case 'announcements': {
      if (!announcements) return empty
      const now = Date.now()
      const items = announcements.items
      const scheduled = items.filter((a) => !a.isPublished && a.publishAt && Date.parse(a.publishAt) > now)
      const drafts = items.filter((a) => !a.isPublished && !a.publishAt)
      const live = items.filter((a) => a.isPublished)
      const views = live.reduce((sum, a) => sum + a.viewCount, 0)
      return {
        route,
        statsFirst: false,
        queue: {
          title: 'Scheduled',
          badge: `${scheduled.length} queued`,
          badgeTone: 'indigo',
          rows: [
            ...scheduled.slice(0, 2).map((a) => ({
              key: a.id, label: truncate(a.content), meta: shortDate(a.publishAt as string), icon: CalendarClock, tone: 'indigo' as Tone,
            })),
            ...drafts.slice(0, 1).map((a) => ({
              key: a.id, label: `Draft: ${truncate(a.content, 30)}`, meta: 'Not scheduled', icon: FileText, tone: 'neutral' as Tone,
            })),
          ],
          emptyLabel: 'Nothing scheduled.',
        },
        stats: {
          title: 'Reach',
          rows: [
            { label: 'Pinned', value: String(live.filter((a) => a.isPinned).length), delta: 'campus-wide' },
            { label: 'Published', value: String(live.length), delta: 'on this page' },
            { label: 'Views', value: views.toLocaleString(), delta: 'across published', tone: 'mint' },
            { label: 'Reach', value: (stats?.activeUsers ?? 0).toLocaleString(), delta: 'active members' },
          ],
        },
      }
    }

    case 'learning': {
      if (!paths || !pendingPaths) return empty
      // Same definitions as LearningAdminPanel's stat strip, so the two never disagree:
      // a draft is an unpublished path, and completionRate is a 0–1 fraction.
      const drafts = paths.filter((p) => !p.isPublished)
      const published = paths.length - drafts.length
      const enrolled = paths.reduce((sum, p) => sum + p.enrolledCount, 0)
      const avg = paths.length ? Math.round((paths.reduce((sum, p) => sum + p.completionRate, 0) / paths.length) * 100) : 0
      const rows: QueueRow[] = drafts.slice(0, 2).map((p) => ({
        key: p.id, label: p.title, meta: 'Draft', icon: GraduationCap, tone: 'amber' as Tone,
      }))
      if (pendingPaths.length) {
        rows.push({ key: 'ai', label: 'AI-generated paths', meta: String(pendingPaths.length), icon: FileText, tone: 'indigo' })
      }
      const waiting = drafts.length + pendingPaths.length
      return {
        route,
        statsFirst: false,
        queue: {
          title: 'Awaiting review',
          badge: plural(waiting, 'draft'),
          badgeTone: waiting > 0 ? 'amber' : 'mint',
          rows,
          emptyLabel: 'Every path is published.',
        },
        stats: {
          title: 'Learning',
          rows: [
            { label: 'Paths', value: String(paths.length), delta: `${published} published` },
            { label: 'Enrolled', value: enrolled.toLocaleString(), delta: 'total learners' },
            { label: 'Avg completion', value: `${avg}%`, delta: 'of enrolled units', tone: 'mint' },
            { label: 'Drafts', value: String(drafts.length), delta: 'need review', tone: drafts.length > 0 ? 'amber' : undefined },
          ],
        },
      }
    }

    case 'content-sync': {
      if (!pending || !syncConfig || !syncRuns) return empty
      const lastRun = syncRuns[0]
      const sources = [syncConfig.newsUrl, syncConfig.noticeUrl, syncConfig.eventUrl].filter(Boolean).length
      const imported = syncRuns.filter((r) => r.status === 'success').reduce((sum, r) => sum + r.itemsNew, 0)
      const rows: QueueRow[] = []
      if (pending.news.length) rows.push({ key: 'news', label: 'News drafts', meta: String(pending.news.length), icon: Newspaper, tone: 'indigo' })
      if (pending.events.length) rows.push({ key: 'events', label: 'Event drafts', meta: String(pending.events.length), icon: Calendar, tone: 'indigo' })
      const lastValue = !lastRun ? '—'
        : lastRun.status === 'success' ? `${lastRun.itemsNew} new`
        : lastRun.status === 'running' ? 'Running'
        : 'Failed'
      return {
        route,
        statsFirst: false,
        queue: {
          title: 'Pending review',
          badge: plural(importedDrafts, 'draft'),
          badgeTone: importedDrafts > 0 ? 'amber' : 'mint',
          rows,
          emptyLabel: 'Nothing imported since the last publish.',
        },
        stats: {
          title: 'Sync status',
          rows: [
            { label: 'Sources', value: `${sources}/3`, delta: syncConfig.enabled ? 'sync enabled' : 'sync paused', tone: syncConfig.enabled ? 'mint' : 'amber' },
            { label: 'Last sync', value: lastValue, delta: lastRun ? shortDate(lastRun.startedAt) : 'no runs yet', tone: lastRun?.status === 'failed' ? 'red' : lastRun ? 'mint' : undefined },
            { label: 'Imported', value: imported.toLocaleString(), delta: 'recent runs' },
            { label: 'Cap', value: String(syncConfig.entriesPerSource), delta: 'entries per source' },
          ],
        },
      }
    }

    case 'shuttle': {
      if (!shuttleRoutes || !shuttleStats) return empty
      const liveIds = new Set(shuttleStats.routes.filter((r) => r.isLive).map((r) => r.routeId))
      const idle = shuttleRoutes.filter((r) => !liveIds.has(r.id))
      return {
        route,
        statsFirst: false,
        queue: {
          title: 'Route alerts',
          badge: idle.length ? `${idle.length} idle` : 'All live',
          badgeTone: idle.length ? 'amber' : 'mint',
          rows: idle.slice(0, 3).map((r) => ({ key: r.id, label: r.name, meta: 'Idle', icon: Bus, tone: 'amber' as Tone })),
          emptyLabel: 'Every route is broadcasting.',
        },
        stats: {
          title: 'Fleet',
          rows: [
            { label: 'Buses live', value: String(shuttleStats.busesLive), delta: 'broadcasting now', tone: 'cyan' },
            { label: 'Routes', value: String(shuttleStats.activeRoutes), delta: 'in service today' },
            { label: 'Drivers', value: String(shuttleStats.onDutyDrivers), delta: 'on duty' },
            { label: 'On-time', value: shuttleStats.onTimeRatePct === null ? '—' : `${shuttleStats.onTimeRatePct}%`, delta: 'last 7 days', tone: shuttleStats.onTimeRatePct === null ? undefined : 'mint' },
          ],
        },
      }
    }

    case 'mentorship': {
      if (!mentors || !redemptions) return empty
      const m = mentors.items
      const openSlots = m.filter((x) => x.currentMentees < x.maxMentees).length
      const sessions = m.reduce((sum, x) => sum + x.totalSessions, 0)
      const rows: QueueRow[] = []
      if (redemptions.total > 0) rows.push({ key: 'rewards', label: 'Reward requests', meta: String(redemptions.total), icon: Gift, tone: 'indigo' })
      m.filter((x) => x.currentMentees >= x.maxMentees).slice(0, 2).forEach((x) =>
        rows.push({ key: x.id, label: 'Mentor at capacity', meta: `${x.currentMentees}/${x.maxMentees}`, icon: Handshake, tone: 'amber' }),
      )
      return {
        route,
        statsFirst: false,
        queue: {
          title: 'Needs attention',
          badge: plural(redemptions.total, 'reward request'),
          badgeTone: redemptions.total > 0 ? 'amber' : 'mint',
          rows,
          emptyLabel: 'No requests waiting on you.',
        },
        stats: {
          title: 'Mentorship',
          rows: [
            { label: 'Mentors', value: String(mentors.total), delta: `${openSlots} with open slots`, tone: 'mint' },
            { label: 'Active pairs', value: m.reduce((sum, x) => sum + x.currentMentees, 0).toString(), delta: 'accepted requests' },
            { label: 'Completed', value: String(m.reduce((sum, x) => sum + x.completedCount, 0)), delta: 'all-time' },
            { label: 'Sessions', value: String(sessions), delta: `${sessions * 10} pts awarded`, tone: 'mint' },
          ],
        },
      }
    }

    case 'insights':
    default: {
      if (!stats) return empty
      const today = new Date().toISOString().slice(0, 10)
      const postsToday = stats.postsByDay.find((d) => d.date === today)?.count ?? 0
      const weekTotal = stats.postsByDay.reduce((sum, d) => sum + d.count, 0)
      const open = stats.escalatedReports + stats.deletionRequests + importedDrafts
      return {
        route,
        statsFirst: true,
        stats: {
          title: 'Campus insights',
          rows: [
            { label: 'Active members', value: stats.activeUsers.toLocaleString(), delta: `of ${stats.users.toLocaleString()} total`, tone: 'mint' },
            { label: 'Posts today', value: String(postsToday), delta: `${weekTotal} this week`, tone: 'mint' },
            { label: 'Reports resolved', value: `${stats.resolvedPct7d}%`, delta: 'last 7 days', tone: 'mint' },
            { label: 'Invite batches', value: String(stats.pendingInviteBatches), delta: 'still open', tone: stats.pendingInviteBatches > 0 ? 'amber' : undefined },
          ],
        },
        queue: {
          title: 'Needs attention',
          badge: `${open} open`,
          badgeTone: open > 0 ? 'red' : 'mint',
          rows: [
            ...modRows(stats).filter((r) => r.key === 'escalated'),
            { key: 'imported', label: 'Imported drafts', meta: String(importedDrafts), icon: FileText, tone: 'indigo', to: adminTab('content-sync') },
            { key: 'deletions', label: 'Deletion requests', meta: String(stats.deletionRequests), icon: Trash2, tone: 'amber', to: adminTab('moderation') },
          ],
          emptyLabel: 'Nothing waiting.',
          cta: { label: 'Open moderation', to: adminTab('moderation') },
        },
      }
    }
  }
}
