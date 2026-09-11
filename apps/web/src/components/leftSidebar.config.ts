import type { UserRole } from '@uniconnect/shared'
import {
  Home,
  Users,
  Calendar,
  Briefcase,
  Handshake,
  Newspaper,
  ShieldCheck,
  Bus,
  BookOpen,
  BarChart2,
  FileText,
  Map,
  RefreshCw,
  MessageSquare,
  GraduationCap,
  Compass,
  UsersRound,
  LayoutGrid,
  Bell,
  Bookmark,
  Flag,
  Mail,
  Radio,
  type LucideIcon,
} from 'lucide-react'
import { PATHS } from '@/router/paths'

export interface RailRow {
  key: string
  label: string
  icon: LucideIcon
  to: string
}

/**
 * Cheaply-derived signals the contextual zone reacts to. Every key is filled by
 * `useRailContext`, which gates each source query to the roles whose API answers it —
 * so a key a role cannot see stays at its empty value rather than 403-ing.
 * A `null`/`0` here means "no row", and every rule must return false on it.
 */
export interface RailContext {
  draftCount: number
  /** Student: minutes until the nearest live bus reaches its next stop. */
  shuttleEtaMinutes: number | null
  /** Student: own job applications whose status moved off pending recently. */
  applicationUpdates: number
  /** Student: minutes until an event they RSVP'd "going" to starts. */
  eventStartsInMinutes: number | null
  /** Alumni: applicants across their own postings. */
  newApplicants: number
  /** Alumni: pending incoming mentorship requests. */
  menteeRequests: number
  /** Admin: days left on the soonest-to-lapse unused invite. */
  inviteExpiryDays: number | null
  /** Admin: unresolved content reports. */
  pendingReports: number
  /** Driver: their own GPS beacon is currently fresh. */
  onDuty: boolean
}

export type ContextualTone = 'self' | 'network' | 'live' | 'deadline' | 'action'

export interface CtxRule {
  key: string
  label: string
  icon: LucideIcon
  to: string
  tone: ContextualTone
  /**
   * A pinned row outlives a glance — it stays for the whole time its condition holds
   * rather than being read once and dismissed. Pinned rows sort above every unpinned
   * row regardless of rank and are never pushed into the `+n more` overflow, which
   * would defeat their only purpose.
   */
  pinned?: boolean
  /** Returns false when the row should not render, or its live meta text + sort rank. */
  when: (ctx: RailContext) => false | { meta: string; rank: number }
}

export interface ToolTile {
  key: string
  label: string
  icon: LucideIcon
  iconColor: string
  iconBg: string
  to?: string
  externalUrl?: string
}

export interface RoleRail {
  fixed: RailRow[]
  contextual: CtxRule[]
  tools: ToolTile[]
  /**
   * Destinations the rail demoted but that must stay one click away. The fixed rows are
   * capped at 5, so everything else this role can act on lands here and is rendered by
   * the top-nav avatar menu (desktop) and the mobile More sheet. `roleShell.reachability`
   * asserts these two zones together cover every navigable route — nothing is orphaned.
   */
  secondary: RailRow[]
}

/**
 * Destinations the top bar already gives a dedicated, badged icon and a peek popover.
 * The avatar menu filters these out: a menu row inches from its own icon is a second
 * control for one feature, and the weaker of the two — the icon carries the unread count.
 *
 * They stay in `secondary` rather than being deleted from it, because the mobile More
 * sheet renders the same list and mobile hides both icons (`.topnav-mobile-hidden`) —
 * dropping them outright would strand Messages and Notifications on a phone.
 */
export const TOPNAV_ICON_ROUTES: readonly string[] = [PATHS.MESSAGES, PATHS.NOTIFICATIONS]

/**
 * Shared by every member role; drivers deliberately get none of it.
 *
 * Deliberately absent: "Lost & found" and "My network". Both pages were absorbed into
 * another page as a section tab (`/explore?section=lost-found`, `/groups?section=people`)
 * and each renders the very same component the standalone route does. Keeping a row here
 * as well gave one feature two homes in one zone — the thing the shell rule forbids — and
 * the row was the weaker control, since the section sits next to the content it belongs
 * with. The old routes stay registered for deep links and old links; they are simply not
 * advertised twice. `reachability.test.ts` treats them as sub-navigation and asserts no
 * rail row points at them again.
 */
const MEMBER_SECONDARY: RailRow[] = [
  { key: 'explore', label: 'Explore', icon: Compass, to: PATHS.EXPLORE },
  { key: 'messages', label: 'Messages', icon: MessageSquare, to: PATHS.MESSAGES },
  { key: 'notifications', label: 'Notifications', icon: Bell, to: PATHS.NOTIFICATIONS },
  { key: 'learn', label: 'Learn', icon: GraduationCap, to: PATHS.LEARN },
  { key: 'drafts', label: 'Drafts', icon: FileText, to: PATHS.DRAFTS },
  { key: 'saved', label: 'Saved', icon: Bookmark, to: PATHS.SAVED },
]

/**
 * Rows that are fixed for some roles and secondary for others. Which roles get them is
 * decided by what the API lets that role do, not by the mockups:
 *  - jobs        POST/PATCH/DELETE is `requireRole('alumni','faculty','admin')`
 *  - mentorship  is `requireRole('student')` and `requireRole('alumni','admin')` —
 *                faculty has no write access anywhere in the module, so it gets no row
 *  - news        is a fixed "Announcements"/"Notices" row for faculty, admin and driver
 */
/**
 * Admin's secondary is deliberately the shortest of any role. An admin's shell is the
 * admin panel: the six fixed rows and three campus tools are all administrative
 * surfaces, and the account menu is not a second place to offer the member app. So
 * Explore, Groups, Events, Jobs, News, Learn, Saved and the rider Shuttle map are not
 * advertised to admin at all — their admin-side equivalents already live in the rail,
 * and the member pages stay reachable by URL and by search.
 *
 * Messages and Notifications are the exception, and they are here for the phone rather
 * than for this menu: `TOPNAV_ICON_ROUTES` filters both out of the avatar menu, and
 * mobile hides their top-bar icons, so the More sheet is the only home they have on a
 * small screen. Dropping them from this list would strand them there.
 *
 * This narrows what `reachability.test.ts` asks of admin — see the member-feature check
 * there, which now exempts the surfaces listed above for this role only.
 */
const ADMIN_SECONDARY_KEYS = new Set(['messages', 'notifications'])

const NEWS_ROW: RailRow = { key: 'news', label: 'News', icon: Newspaper, to: PATHS.NEWS }
const JOBS_ROW: RailRow = { key: 'jobs', label: 'Jobs', icon: Briefcase, to: PATHS.JOBS }

/**
 * True when `to` is the row the current URL is on. Rows can share a base path and differ
 * only by a tab or section query (the three admin rows all live at /admin), so the path
 * is matched first and then every param the row pins must agree — a param the URL omits
 * counts as a match, so a bare path lands on the first row rather than none.
 *
 * The desktop rail and the mobile bar must never disagree about which row is lit, so this
 * lives here and both call it rather than each keeping its own copy.
 */
export function isRailRowActive(to: string, pathname: string, search: string): boolean {
  const [rawPath, rawQuery] = to.split('?')
  const base = rawPath.split(':')[0].replace(/\/$/, '')
  const pathMatches = base === PATHS.FEED
    ? pathname === base
    : pathname === base || pathname.startsWith(base + '/')
  if (!pathMatches) return false
  if (!rawQuery) return true

  const current = new URLSearchParams(search)
  return [...new URLSearchParams(rawQuery)].every(
    ([key, value]) => !current.has(key) || current.get(key) === value,
  )
}

/** live > action > deadline > network > self, per the rank-order rule. */
export const TONE_RANK: Record<ContextualTone, number> = {
  live: 4,
  action: 3,
  deadline: 2,
  network: 1,
  self: 0,
}

export const TONE_TOKENS: Record<ContextualTone, { bg: string; fg: string }> = {
  self: { bg: 'var(--uc-orange-bg)', fg: 'var(--uc-orange-l)' },
  network: { bg: 'var(--uc-indigo-bg)', fg: 'var(--uc-indigo-l)' },
  live: { bg: 'var(--uc-cyan-bg)', fg: 'var(--uc-cyan)' },
  deadline: { bg: 'var(--uc-amber-bg)', fg: 'var(--uc-amber-l)' },
  // Follows the `live` precedent for accents with no `-l` variant. Deliberately not the
  // `--role-admin-*` pair: those are the admin *badge's* colours, and a tone that borrows
  // them reads as "admin" rather than "needs action".
  action: { bg: 'var(--uc-red-bg)', fg: 'var(--uc-red)' },
}

/** Every unpublished item across posts/jobs/news/events — real for any authoring role. */
function draftsRule(label: string): CtxRule {
  return {
    key: 'drafts',
    label,
    icon: FileText,
    to: PATHS.DRAFTS,
    tone: 'self',
    when: (ctx) => (ctx.draftCount > 0 ? { meta: String(ctx.draftCount), rank: TONE_RANK.self } : false),
  }
}

/**
 * Rules below cover only signals this API actually serves today. Several rules the
 * shell spec listed have no data behind them and are deliberately absent rather than
 * approximated: faculty has no timetable, no unanswered-query concept, no
 * grade-submission window and no cross-group join-request aggregate, so its zone is
 * drafts-only; student "Registration open", alumni "Reunion RSVP" and driver
 * "Log fuel" / "Passenger alert" have no endpoint at all. An empty zone is the
 * correct resting state — a hardcoded row would not be.
 */

/** Student — a live beacon puts a bus within ten minutes of its next stop. */
const shuttleArrivingRule: CtxRule = {
  key: 'shuttle-arriving',
  label: 'Shuttle arriving',
  icon: Bus,
  to: PATHS.SHUTTLE,
  tone: 'live',
  when: (ctx) =>
    ctx.shuttleEtaMinutes !== null ? { meta: `${ctx.shuttleEtaMinutes} min`, rank: TONE_RANK.live } : false,
}

/** Student — one of their applications moved off pending. */
const applicationUpdateRule: CtxRule = {
  key: 'application-update',
  label: 'Application update',
  icon: Briefcase,
  to: PATHS.JOBS,
  tone: 'network',
  when: (ctx) =>
    ctx.applicationUpdates > 0 ? { meta: String(ctx.applicationUpdates), rank: TONE_RANK.network } : false,
}

/** Student — an event they said they were going to is about to start. */
const eventStartingRule: CtxRule = {
  key: 'event-starting',
  label: 'Event starting',
  icon: Calendar,
  to: PATHS.EVENTS,
  tone: 'deadline',
  when: (ctx) =>
    ctx.eventStartsInMinutes !== null
      ? { meta: `${ctx.eventStartsInMinutes} min`, rank: TONE_RANK.deadline }
      : false,
}

/** Alumni — people waiting on their own postings. */
const newApplicantsRule: CtxRule = {
  key: 'new-applicants',
  label: 'New applicants',
  icon: Briefcase,
  to: PATHS.JOBS,
  tone: 'deadline',
  when: (ctx) => (ctx.newApplicants > 0 ? { meta: String(ctx.newApplicants), rank: TONE_RANK.deadline } : false),
}

/** Alumni — pending incoming mentorship requests. */
const menteeRequestsRule: CtxRule = {
  key: 'mentee-requests',
  label: 'Mentee requests',
  icon: Handshake,
  to: PATHS.MENTORSHIP,
  tone: 'network',
  when: (ctx) => (ctx.menteeRequests > 0 ? { meta: String(ctx.menteeRequests), rank: TONE_RANK.network } : false),
}

/** Admin — unresolved content reports. */
const escalatedReportRule: CtxRule = {
  key: 'escalated-report',
  label: 'Escalated report',
  icon: Flag,
  to: `${PATHS.ADMIN}?tab=moderation`,
  tone: 'action',
  when: (ctx) => (ctx.pendingReports > 0 ? { meta: String(ctx.pendingReports), rank: TONE_RANK.action } : false),
}

/** Admin — an unused invite is about to lapse. */
const inviteExpiringRule: CtxRule = {
  key: 'invite-expiring',
  label: 'Invite batch expiring',
  icon: Mail,
  to: `${PATHS.ADMIN}?tab=members`,
  tone: 'deadline',
  when: (ctx) =>
    ctx.inviteExpiryDays !== null
      ? {
          meta: ctx.inviteExpiryDays <= 0 ? 'Today' : `${ctx.inviteExpiryDays}d left`,
          rank: TONE_RANK.deadline,
        }
      : false,
}

/**
 * Driver — pinned, because a shift is not a glanceable notification: it holds for as
 * long as the driver's own beacon stays fresh and must never be hidden behind overflow.
 */
const onDutyRule: CtxRule = {
  key: 'on-duty',
  label: 'On duty now',
  icon: Radio,
  to: PATHS.SHUTTLE_DRIVE,
  tone: 'live',
  pinned: true,
  when: (ctx) => (ctx.onDuty ? { meta: 'Live', rank: TONE_RANK.live } : false),
}

export const RAILS: Record<UserRole, RoleRail> = {
  student: {
    fixed: [
      { key: 'home', label: 'Home', icon: Home, to: PATHS.FEED },
      { key: 'groups', label: 'Groups & people', icon: Users, to: PATHS.GROUPS },
      { key: 'events', label: 'Events', icon: Calendar, to: PATHS.EVENTS },
      { key: 'jobs', label: 'Jobs', icon: Briefcase, to: PATHS.JOBS },
      { key: 'mentorship', label: 'Mentorship', icon: Handshake, to: PATHS.MENTORSHIP },
    ],
    contextual: [shuttleArrivingRule, eventStartingRule, applicationUpdateRule, draftsRule('Drafts')],
    secondary: [...MEMBER_SECONDARY, NEWS_ROW],
    tools: [
      { key: 'shuttle', label: 'Shuttle live', icon: Bus, iconColor: 'var(--uc-cyan)', iconBg: 'var(--uc-cyan-bg)', to: PATHS.SHUTTLE },
      { key: 'elms', label: 'eLMS', icon: BookOpen, iconColor: 'var(--uc-orange-l)', iconBg: 'var(--uc-orange-bg)', externalUrl: 'https://elms.uiu.ac.bd' },
      { key: 'cgpa', label: 'CGPA calculator', icon: BarChart2, iconColor: 'var(--uc-mint)', iconBg: 'var(--uc-mint-bg)', externalUrl: 'https://cgpa.uiu.ac.bd' },
    ],
  },
  alumni: {
    fixed: [
      { key: 'home', label: 'Home', icon: Home, to: PATHS.FEED },
      { key: 'groups', label: 'Groups & people', icon: Users, to: PATHS.GROUPS },
      { key: 'events', label: 'Events', icon: Calendar, to: PATHS.EVENTS },
      { key: 'postings', label: 'My postings', icon: Briefcase, to: PATHS.JOBS },
      { key: 'mentees', label: 'Mentees', icon: Handshake, to: PATHS.MENTORSHIP },
    ],
    contextual: [newApplicantsRule, menteeRequestsRule, draftsRule('Drafts')],
    secondary: [...MEMBER_SECONDARY, NEWS_ROW],
    // "Directory" repeated `secondary`'s My network and "Post a job" repeated the
    // `postings` row above — same destination, second name — and neither started the
    // action its label promised. Shuttle is the one utility no other zone offers.
    tools: [
      { key: 'shuttle', label: 'Shuttle', icon: Bus, iconColor: 'var(--uc-cyan)', iconBg: 'var(--uc-cyan-bg)', to: PATHS.SHUTTLE },
    ],
  },
  faculty: {
    fixed: [
      { key: 'home', label: 'Home', icon: Home, to: PATHS.FEED },
      // Both land on /groups; the section param is what makes them different rows.
      // `isActive` is query-aware, so exactly one of the two lights up.
      { key: 'sections', label: 'My sections', icon: GraduationCap, to: `${PATHS.GROUPS}?section=sections` },
      { key: 'groups', label: 'Groups & people', icon: Users, to: `${PATHS.GROUPS}?section=groups` },
      { key: 'events', label: 'Events', icon: Calendar, to: PATHS.EVENTS },
      { key: 'announcements', label: 'Announcements', icon: Newspaper, to: PATHS.NEWS },
    ],
    contextual: [draftsRule('Drafts')],
    secondary: [...MEMBER_SECONDARY, JOBS_ROW],
    tools: [
      { key: 'elms', label: 'eLMS', icon: BookOpen, iconColor: 'var(--uc-orange-l)', iconBg: 'var(--uc-orange-bg)', externalUrl: 'https://elms.uiu.ac.bd' },
      // No third tile: "Attendance" named a module that does not exist, and the gradebook
      // it would honestly be renamed to is reached through the `sections` row above —
      // a tile pointing there would just be that row under a second name.
      { key: 'shuttle', label: 'Shuttle', icon: Bus, iconColor: 'var(--uc-cyan)', iconBg: 'var(--uc-cyan-bg)', to: PATHS.SHUTTLE },
    ],
  },
  driver: {
    fixed: [
      { key: 'duty', label: 'Duty board', icon: Home, to: PATHS.SHUTTLE_DRIVE },
      { key: 'route', label: 'Route & stops', icon: Map, to: PATHS.SHUTTLE },
      { key: 'messages', label: 'Messages', icon: MessageSquare, to: PATHS.MESSAGES },
      { key: 'notices', label: 'Notices', icon: Newspaper, to: PATHS.NEWS },
    ],
    // Drivers author nothing, so no drafts row; duty is their one real signal and
    // it is pinned for the length of the shift.
    contextual: [onDutyRule],
    // A driver is walled off from the social app; only its own duty surfaces.
    secondary: [
      { key: 'notifications', label: 'Notifications', icon: Bell, to: PATHS.NOTIFICATIONS },
    ],
    // Empty for the same reason `rightRail` is: a driver's whole surface is two routes,
    // and both are fixed rows above. The three tiles that used to sit here resolved to
    // exactly those two — "Trip log" and "Report issue" both to the duty board, "Live
    // map" to Route & stops — and the first two named features the API has never had
    // (`POST /shuttle/locations` is a driver's only write). Three names, no new places.
    tools: [],
  },
  admin: {
    // Six fixed rows, mirroring the admin prototype exactly. There is deliberately no
    // Feed row: an admin's home is /admin and every row here is an admin surface. The
    // member feed stays reachable from every other role's rail.
    fixed: [
      // Tab values match AdminPage's own `Tab` union (adminTabs.test.ts parses it).
      { key: 'insights', label: 'Insights', icon: BarChart2, to: `${PATHS.ADMIN}?tab=insights` },
      { key: 'moderation', label: 'Moderation', icon: ShieldCheck, to: `${PATHS.ADMIN}?tab=moderation` },
      { key: 'admin-groups', label: 'Groups', icon: UsersRound, to: `${PATHS.ADMIN}?tab=groups` },
      { key: 'members', label: 'Members & invites', icon: Users, to: `${PATHS.ADMIN}?tab=members` },
      { key: 'announcements', label: 'Announcements', icon: Newspaper, to: `${PATHS.ADMIN}?tab=announcements` },
      { key: 'content', label: 'Content', icon: LayoutGrid, to: `${PATHS.ADMIN}?tab=content` },
    ],
    contextual: [escalatedReportRule, inviteExpiringRule, draftsRule('Unsent broadcast draft')],
    secondary: MEMBER_SECONDARY.filter((row) => ADMIN_SECONDARY_KEYS.has(row.key)),
    // Deletion requests is no longer a tile: it now lives inside the Moderation tab
    // beside reports, which is where an admin already goes to action a queue.
    tools: [
      { key: 'learning', label: 'Learning', icon: GraduationCap, iconColor: 'var(--uc-orange-l)', iconBg: 'var(--uc-orange-bg)', to: `${PATHS.ADMIN}?tab=learning` },
      { key: 'content-sync', label: 'Content sync', icon: RefreshCw, iconColor: 'var(--uc-indigo-l)', iconBg: 'var(--uc-indigo-bg)', to: `${PATHS.ADMIN}?tab=content-sync` },
      // The rider map, not the ops screen, is what /shuttle renders — the routes and
      // schedules an admin manages live on the admin tab.
      { key: 'shuttle-ops', label: 'Shuttle ops', icon: Bus, iconColor: 'var(--uc-cyan)', iconBg: 'var(--uc-cyan-bg)', to: `${PATHS.ADMIN}?tab=shuttle` },
      // Mentorship is a member surface no admin row offers, so it qualifies as a tool
      // tile rather than a second name for a row.
      { key: 'mentorship', label: 'Mentorship', icon: Handshake, iconColor: 'var(--uc-orange-l)', iconBg: 'var(--uc-orange-bg)', to: PATHS.MENTORSHIP },
    ],
  },
}
