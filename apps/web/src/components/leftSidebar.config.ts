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
  Network,
  Map,
  Wrench,
  ClipboardList,
  Megaphone,
  MessageSquare,
  GraduationCap,
  Compass,
  PackageSearch,
  Bell,
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
  /** Admin: profiles awaiting verification. */
  verifications: number
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

/** Shared by every member role; drivers deliberately get none of it. */
const MEMBER_SECONDARY: RailRow[] = [
  { key: 'explore', label: 'Explore', icon: Compass, to: PATHS.EXPLORE },
  { key: 'network', label: 'My network', icon: Network, to: PATHS.CONNECTIONS },
  { key: 'messages', label: 'Messages', icon: MessageSquare, to: PATHS.MESSAGES },
  { key: 'notifications', label: 'Notifications', icon: Bell, to: PATHS.NOTIFICATIONS },
  { key: 'learn', label: 'Learn', icon: GraduationCap, to: PATHS.LEARN },
  { key: 'lost-found', label: 'Lost & found', icon: PackageSearch, to: PATHS.LOST_FOUND },
  { key: 'drafts', label: 'Drafts', icon: FileText, to: PATHS.DRAFTS },
]

/**
 * Rows that are fixed for some roles and secondary for others. Which roles get them is
 * decided by what the API lets that role do, not by the mockups:
 *  - jobs        POST/PATCH/DELETE is `requireRole('alumni','faculty','admin')`
 *  - mentorship  is `requireRole('student')` and `requireRole('alumni','admin')` —
 *                faculty has no write access anywhere in the module, so it gets no row
 *  - news        is a fixed "Announcements"/"Notices" row for faculty, admin and driver
 */
const NEWS_ROW: RailRow = { key: 'news', label: 'News', icon: Newspaper, to: PATHS.NEWS }
const JOBS_ROW: RailRow = { key: 'jobs', label: 'Jobs', icon: Briefcase, to: PATHS.JOBS }
const MENTORSHIP_ROW: RailRow = { key: 'mentorship', label: 'Mentorship', icon: Handshake, to: PATHS.MENTORSHIP }
// The admin rail spends all five fixed rows on moderation duties, so the ordinary
// member surfaces it still owns (events are `requireRole('faculty','admin')`; groups
// carry no role guard at all) move here rather than disappearing.
const GROUPS_ROW: RailRow = { key: 'groups', label: 'Groups & people', icon: Users, to: PATHS.GROUPS }
const EVENTS_ROW: RailRow = { key: 'events', label: 'Events', icon: Calendar, to: PATHS.EVENTS }

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
  action: { bg: 'var(--role-admin-bg)', fg: 'var(--role-admin-text)' },
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
  to: `${PATHS.ADMIN}?tab=reports`,
  tone: 'action',
  when: (ctx) => (ctx.pendingReports > 0 ? { meta: String(ctx.pendingReports), rank: TONE_RANK.action } : false),
}

/** Admin — profiles awaiting verification. */
const verificationsRule: CtxRule = {
  key: 'verifications',
  label: 'Verification requests',
  icon: ShieldCheck,
  to: `${PATHS.ADMIN}?tab=users`,
  tone: 'action',
  when: (ctx) => (ctx.verifications > 0 ? { meta: String(ctx.verifications), rank: TONE_RANK.action } : false),
}

/** Admin — an unused invite is about to lapse. */
const inviteExpiringRule: CtxRule = {
  key: 'invite-expiring',
  label: 'Invite batch expiring',
  icon: Mail,
  to: `${PATHS.ADMIN}?tab=users`,
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
    tools: [
      { key: 'directory', label: 'Directory', icon: Network, iconColor: 'var(--uc-indigo-l)', iconBg: 'var(--uc-indigo-bg)', to: PATHS.CONNECTIONS },
      { key: 'post-job', label: 'Post a job', icon: Briefcase, iconColor: 'var(--uc-mint)', iconBg: 'var(--uc-mint-bg)', to: PATHS.JOBS },
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
      { key: 'attendance', label: 'Attendance', icon: ClipboardList, iconColor: 'var(--uc-indigo-l)', iconBg: 'var(--uc-indigo-bg)', to: PATHS.GROUPS },
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
    tools: [
      { key: 'trip-log', label: 'Trip log', icon: ClipboardList, iconColor: 'var(--uc-indigo-l)', iconBg: 'var(--uc-indigo-bg)', to: PATHS.SHUTTLE_DRIVE },
      { key: 'report-issue', label: 'Report issue', icon: Wrench, iconColor: 'var(--uc-amber-l)', iconBg: 'var(--uc-amber-bg)', to: PATHS.SHUTTLE_DRIVE },
      { key: 'live-map', label: 'Live map', icon: Map, iconColor: 'var(--uc-cyan)', iconBg: 'var(--uc-cyan-bg)', to: PATHS.SHUTTLE },
    ],
  },
  admin: {
    fixed: [
      { key: 'home', label: 'Home', icon: Home, to: PATHS.FEED },
      // Tab values must match AdminPage's own `Tab` union, not the mockup wording.
      { key: 'moderation', label: 'Moderation', icon: ShieldCheck, to: `${PATHS.ADMIN}?tab=reports` },
      { key: 'members', label: 'Members & invites', icon: Users, to: `${PATHS.ADMIN}?tab=users` },
      { key: 'announcements', label: 'Announcements', icon: Newspaper, to: PATHS.NEWS },
      { key: 'insights', label: 'Insights', icon: BarChart2, to: `${PATHS.ADMIN}?tab=overview` },
    ],
    contextual: [escalatedReportRule, verificationsRule, inviteExpiringRule, draftsRule('Unsent broadcast draft')],
    secondary: [...MEMBER_SECONDARY, GROUPS_ROW, EVENTS_ROW, JOBS_ROW, MENTORSHIP_ROW],
    tools: [
      { key: 'audit', label: 'Audit log', icon: ClipboardList, iconColor: 'var(--uc-indigo-l)', iconBg: 'var(--uc-indigo-bg)', to: PATHS.ADMIN },
      { key: 'broadcast', label: 'Broadcast', icon: Megaphone, iconColor: 'var(--uc-orange-l)', iconBg: 'var(--uc-orange-bg)', to: PATHS.ADMIN },
      { key: 'shuttle-ops', label: 'Shuttle ops', icon: Bus, iconColor: 'var(--uc-cyan)', iconBg: 'var(--uc-cyan-bg)', to: PATHS.SHUTTLE },
    ],
  },
}
