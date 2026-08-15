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
  type LucideIcon,
} from 'lucide-react'
import { PATHS } from '@/router/paths'

export interface RailRow {
  key: string
  label: string
  icon: LucideIcon
  to: string
}

/** Cheaply-derived signals the contextual zone reacts to. */
export interface RailContext {
  draftCount: number
}

export type ContextualTone = 'self' | 'network' | 'live' | 'deadline' | 'action'

export interface CtxRule {
  key: string
  label: string
  icon: LucideIcon
  to: string
  tone: ContextualTone
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

export const RAILS: Record<UserRole, RoleRail> = {
  student: {
    fixed: [
      { key: 'home', label: 'Home', icon: Home, to: PATHS.FEED },
      { key: 'groups', label: 'Groups & people', icon: Users, to: PATHS.GROUPS },
      { key: 'events', label: 'Events', icon: Calendar, to: PATHS.EVENTS },
      { key: 'jobs', label: 'Jobs', icon: Briefcase, to: PATHS.JOBS },
      { key: 'mentorship', label: 'Mentorship', icon: Handshake, to: PATHS.MENTORSHIP },
    ],
    contextual: [draftsRule('Drafts')],
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
    contextual: [draftsRule('Drafts')],
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
      { key: 'sections', label: 'My sections', icon: GraduationCap, to: PATHS.GROUPS },
      { key: 'groups', label: 'Groups & people', icon: Users, to: PATHS.GROUPS },
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
    // No draft-authoring surface exists for drivers — the zone stays empty
    // (the correct resting state) until shift/maintenance signals are wired.
    contextual: [],
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
    contextual: [draftsRule('Unsent broadcast draft')],
    secondary: [...MEMBER_SECONDARY, GROUPS_ROW, EVENTS_ROW, JOBS_ROW, MENTORSHIP_ROW],
    tools: [
      { key: 'audit', label: 'Audit log', icon: ClipboardList, iconColor: 'var(--uc-indigo-l)', iconBg: 'var(--uc-indigo-bg)', to: PATHS.ADMIN },
      { key: 'broadcast', label: 'Broadcast', icon: Megaphone, iconColor: 'var(--uc-orange-l)', iconBg: 'var(--uc-orange-bg)', to: PATHS.ADMIN },
      { key: 'shuttle-ops', label: 'Shuttle ops', icon: Bus, iconColor: 'var(--uc-cyan)', iconBg: 'var(--uc-cyan-bg)', to: PATHS.SHUTTLE },
    ],
  },
}
