import { useEffect, useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import type { UserRole } from '@uniconnect/shared'
import { api } from '@/lib/axios'
import { useMyDrafts } from '@/features/drafts/hooks/useMyDrafts'
import { calcProgressAndEta } from '@/features/shuttle/utils'
import type { LiveLocation, ShuttleRoute } from '@/features/shuttle/types'
import type { RailContext } from './leftSidebar.config'

/**
 * The rail renders on every authenticated page, so each signal below is (a) gated to
 * the roles whose API would actually answer it — a student must never fire an
 * admin-only request that would 403 on every page load — and (b) keyed to match the
 * query the corresponding right-rail widget or page already runs, so TanStack serves
 * one fetch to both. `staleTime` is 60s throughout: this is a rail, not a dashboard.
 */
const RAIL_STALE = 60_000

/** A beacon older than this is stale; we never claim a live arrival from one. */
const BEACON_FRESH_MS = 90_000
/** Arrival window for the student shuttle row. */
const SHUTTLE_ETA_LIMIT_MIN = 10
/** How soon an RSVP'd event has to start before the row appears. */
const EVENT_SOON_MIN = 60
/** Invite batches inside this window read as expiring. */
const INVITE_EXPIRY_DAYS = 3
/** An application status change older than this has stopped being news. */
const APPLICATION_UPDATE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

interface Page<T> {
  items: T[]
  total: number
  page: number
  hasMore: boolean
}

interface MyApplication {
  id: string
  status: string
  updatedAt: string
}

interface MyJob {
  id: string
  applicationCount: number
}

interface MyEvent {
  id: string
  startsAt: string
}

interface Invitation {
  id: string
  isUsed: boolean
  expiresAt: string
}

interface AdminStats {
  reports: number
}

/** Beacons carry their driver so a driver can recognise its own broadcast. */
type RailLocation = LiveLocation & { driverId: string; speedKmh: number | null }

/**
 * Re-renders on an interval so time-window rules (shuttle ETA, event countdown) go
 * false on their own. Disabled roles pay nothing.
 */
function useTick(enabled: boolean, ms = 30_000): void {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => setTick((t) => t + 1), ms)
    return () => clearInterval(id)
  }, [enabled, ms])
}

function minutesUntil(iso: string, now: number): number {
  return Math.round((Date.parse(iso) - now) / 60_000)
}

/**
 * Builds the signal bag the contextual rules read. `verifications` comes from the
 * profile query the rail already runs for its stat pair, so it costs no extra request.
 */
export function useRailContext(
  role: UserRole,
  userId: string | undefined,
  verifications: number | undefined,
): RailContext {
  const isStudent = role === 'student'
  const isAlumni = role === 'alumni'
  const isAdmin = role === 'admin'
  const isDriver = role === 'driver'
  const canAuthor = role !== 'driver'
  const needsBeacons = isStudent || isDriver

  useTick(needsBeacons)

  const { data: drafts } = useMyDrafts(canAuthor)

  // ── Shuttle beacons — student arrival + driver duty ───────────────────────
  const { data: routes } = useQuery<ShuttleRoute[]>({
    queryKey: ['shuttle', 'routes'],
    queryFn: () => api.get<{ data: ShuttleRoute[] }>('/shuttle/routes').then((r) => r.data.data),
    enabled: isStudent,
    staleTime: RAIL_STALE,
  })

  const { data: locations } = useQuery<RailLocation[]>({
    queryKey: ['shuttle', 'locations'],
    queryFn: () => api.get<{ data: RailLocation[] }>('/shuttle/locations').then((r) => r.data.data),
    enabled: needsBeacons,
    staleTime: RAIL_STALE,
  })

  // ── Student: application status changes ───────────────────────────────────
  const { data: myApplications } = useQuery<Page<MyApplication>>({
    queryKey: ['jobs', 'applications', 'my'],
    queryFn: () =>
      api.get<{ data: Page<MyApplication> }>('/jobs/applications/my', { params: { page: 1, limit: 20 } })
        .then((r) => r.data.data),
    enabled: isStudent,
    staleTime: RAIL_STALE,
  })

  // ── Student: an event they RSVP'd "going" to, about to start ──────────────
  const { data: myEvents } = useQuery<Page<MyEvent>>({
    queryKey: ['events', 'my'],
    queryFn: () =>
      api.get<{ data: Page<MyEvent> }>('/events/my', { params: { page: 1, limit: 5 } })
        .then((r) => r.data.data),
    enabled: isStudent,
    staleTime: RAIL_STALE,
  })

  // ── Alumni: applicants waiting on their postings ──────────────────────────
  // Same key and shape as `MyPostingsPanel`'s infinite query, so the two share a
  // cache entry rather than double-fetching /jobs/my.
  const { data: myJobs } = useInfiniteQuery<Page<MyJob>>({
    queryKey: ['jobs', 'my'],
    queryFn: ({ pageParam }) =>
      api.get<{ data: Page<MyJob> }>('/jobs/my', { params: { page: pageParam } }).then((r) => r.data.data),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: isAlumni,
    staleTime: RAIL_STALE,
  })

  // ── Alumni: pending mentee requests (same key as MenteeRequestsWidget) ─────
  const { data: incoming } = useQuery<Page<{ id: string }>>({
    queryKey: ['mentorship', 'incoming', { status: 'pending', limit: 3 }],
    queryFn: () =>
      api.get<{ data: Page<{ id: string }> }>('/mentorship/requests/incoming', {
        params: { page: 1, limit: 3, status: 'pending' },
      }).then((r) => r.data.data),
    enabled: isAlumni,
    staleTime: 30_000,
  })

  // ── Admin: pending reports (same key as PlatformTodayWidget) ──────────────
  const { data: adminStats } = useQuery<AdminStats>({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.get<{ data: AdminStats }>('/admin/stats').then((r) => r.data.data),
    enabled: isAdmin,
    staleTime: RAIL_STALE,
  })

  // ── Admin: invites about to lapse ─────────────────────────────────────────
  // There is no "expiring invites" count endpoint, and the admin invitations tab
  // already holds page 1 in cache under this exact key — so we derive from it
  // rather than adding an endpoint or a second request.
  const { data: invitations } = useQuery<Page<Invitation>>({
    queryKey: ['admin', 'invitations', 1],
    queryFn: () =>
      api.get<{ data: Page<Invitation> }>('/admin/invitations?page=1&limit=20').then((r) => r.data.data),
    enabled: isAdmin,
    staleTime: RAIL_STALE,
  })

  const now = Date.now()

  let shuttleEtaMinutes: number | null = null
  if (isStudent && routes && locations) {
    for (const route of routes) {
      const beacon = locations.find((l) => l.routeId === route.id)
      if (!beacon || now - Date.parse(beacon.updatedAt) >= BEACON_FRESH_MS) continue
      const { etaMinutes } = calcProgressAndEta(beacon.lat, beacon.lng, beacon.speedKmh ?? 0, route.stops)
      if (etaMinutes === null || etaMinutes > SHUTTLE_ETA_LIMIT_MIN) continue
      if (shuttleEtaMinutes === null || etaMinutes < shuttleEtaMinutes) shuttleEtaMinutes = etaMinutes
    }
  }

  const applicationUpdates = (myApplications?.items ?? []).filter(
    (a) => a.status !== 'pending' && now - Date.parse(a.updatedAt) < APPLICATION_UPDATE_WINDOW_MS,
  ).length

  let eventStartsInMinutes: number | null = null
  for (const event of myEvents?.items ?? []) {
    const mins = minutesUntil(event.startsAt, now)
    if (mins < 0 || mins > EVENT_SOON_MIN) continue
    if (eventStartsInMinutes === null || mins < eventStartsInMinutes) eventStartsInMinutes = mins
  }

  const newApplicants = (myJobs?.pages[0]?.items ?? []).reduce((sum, job) => sum + job.applicationCount, 0)

  let inviteExpiryDays: number | null = null
  for (const invite of invitations?.items ?? []) {
    if (invite.isUsed) continue
    const days = Math.ceil((Date.parse(invite.expiresAt) - now) / 86_400_000)
    if (days < 0 || days > INVITE_EXPIRY_DAYS) continue
    if (inviteExpiryDays === null || days < inviteExpiryDays) inviteExpiryDays = days
  }

  // A driver is on duty exactly while its own beacon is fresh — the beacon carries
  // `driverId`, so this survives navigating away from the broadcast screen and needs
  // no client-side duty flag to go stale.
  const onDuty =
    isDriver &&
    (locations ?? []).some(
      (l) => l.driverId === userId && now - Date.parse(l.updatedAt) < BEACON_FRESH_MS,
    )

  return {
    draftCount: canAuthor ? (drafts?.items.length ?? 0) : 0,
    shuttleEtaMinutes,
    applicationUpdates,
    eventStartsInMinutes,
    newApplicants,
    menteeRequests: incoming?.total ?? 0,
    verifications: isAdmin ? (verifications ?? 0) : 0,
    inviteExpiryDays,
    pendingReports: adminStats?.reports ?? 0,
    onDuty,
  }
}
