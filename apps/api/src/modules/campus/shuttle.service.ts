import type { UserRole } from '@uniconnect/shared'
import { db } from '../../config/db'
import { badRequest, notFound } from '../../utils/errors'
import type { ShuttleNoticeInput, ShuttleRiderPrefsInput } from './schema'

interface AuthContext {
  userId: string
  universityId: string
  role: UserRole
}

interface ShiftRow {
  id: string
  route_id: string
  started_at: Date
  ended_at: Date | null
  riders_count: number
}

interface RiderPrefsRow {
  route_id: string | null
  stop_id: string | null
  alert_enabled: boolean
}

interface NoticeRow {
  id: string
  route_id: string | null
  route_name: string | null
  route_color: string | null
  tone: 'disruption' | 'info'
  title: string
  detail: string | null
  expires_at: Date | null
  created_at: Date
}

/** How many live notices the rider rail and the driver's News tab can show. */
const NOTICES_LIMIT = 20

const SHIFT_COLUMNS = ['id', 'route_id', 'started_at', 'ended_at', 'riders_count'] as const

function toShift(row: ShiftRow) {
  return {
    id: row.id,
    routeId: row.route_id,
    startedAt: new Date(row.started_at).toISOString(),
    endedAt: row.ended_at ? new Date(row.ended_at).toISOString() : null,
    ridersCount: Number(row.riders_count),
  }
}

function toNotice(row: NoticeRow) {
  return {
    id: row.id,
    routeId: row.route_id,
    routeName: row.route_name,
    routeColor: row.route_color,
    tone: row.tone,
    title: row.title,
    detail: row.detail,
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
  }
}

async function assertActiveRoute(universityId: string, routeId: string) {
  const route = await db('shuttle_routes')
    .where({ id: routeId, university_id: universityId, is_active: true })
    .first<{ id: string; stops: unknown } | undefined>('id', 'stops')
  if (!route) throw notFound('Shuttle route not found', 'SHUTTLE_ROUTE_NOT_FOUND')
  return route
}

function openShiftQuery(context: AuthContext) {
  return db('shuttle_shifts')
    .where({ driver_id: context.userId, university_id: context.universityId })
    .whereNull('ended_at')
}

export const shuttleService = {
  /** Opens a broadcast session on `routeId`, closing any session the driver left open. */
  async startShift(context: AuthContext, routeId: string) {
    await assertActiveRoute(context.universityId, routeId)
    const row = await db.transaction(async (trx) => {
      await trx('shuttle_shifts')
        .where({ driver_id: context.userId, university_id: context.universityId })
        .whereNull('ended_at')
        .update({ ended_at: trx.fn.now(), updated_at: trx.fn.now() })
      const [created] = await trx('shuttle_shifts')
        .insert({ university_id: context.universityId, driver_id: context.userId, route_id: routeId })
        .returning<ShiftRow[]>(SHIFT_COLUMNS)
      return created
    })
    return toShift(row)
  },

  /** Closes the open session. Idempotent: stopping with nothing open returns null. */
  async stopShift(context: AuthContext) {
    const [row] = await openShiftQuery(context)
      .update({ ended_at: db.fn.now(), updated_at: db.fn.now() })
      .returning<ShiftRow[]>(SHIFT_COLUMNS)
    return row ? toShift(row) : null
  },

  /** Counts a rider on (or takes a miscount off) the open session. Never goes below zero. */
  async adjustRiders(context: AuthContext, delta: 1 | -1) {
    const [row] = await openShiftQuery(context)
      .update({ riders_count: db.raw('GREATEST(riders_count + ?, 0)', [delta]), updated_at: db.fn.now() })
      .returning<ShiftRow[]>(SHIFT_COLUMNS)
    if (!row) throw badRequest('Start a broadcast before counting riders', 'NO_OPEN_SHIFT')
    return toShift(row)
  },

  /**
   * Everything the duty board needs, from real sessions: today's shifts (since the
   * client's local midnight), the open one, and the route the driver is assigned to —
   * the open shift's route, else the most recent one they ever drove.
   */
  async getDuty(context: AuthContext, since: string) {
    const rows = (await db('shuttle_shifts')
      .select(SHIFT_COLUMNS)
      .where({ driver_id: context.userId, university_id: context.universityId })
      .andWhere((q) => q.where('started_at', '>=', since).orWhereNull('ended_at').orWhere('ended_at', '>=', since))
      .orderBy('started_at', 'asc')) as ShiftRow[]

    const shifts = rows.map(toShift)
    const activeShift = shifts.find((s) => s.endedAt === null) ?? null

    let assignedRouteId = activeShift?.routeId ?? shifts.at(-1)?.routeId ?? null
    if (!assignedRouteId) {
      const latest = await db('shuttle_shifts')
        .where({ driver_id: context.userId, university_id: context.universityId })
        .orderBy('started_at', 'desc')
        .first<{ route_id: string } | undefined>('route_id')
      assignedRouteId = latest?.route_id ?? null
    }

    return { activeShift, assignedRouteId, shifts }
  },

  async getRiderPrefs(context: AuthContext) {
    const row = await db('shuttle_rider_prefs')
      .where({ user_id: context.userId, university_id: context.universityId })
      .first<RiderPrefsRow | undefined>('route_id', 'stop_id', 'alert_enabled')
    return {
      routeId: row?.route_id ?? null,
      stopId: row?.stop_id ?? null,
      alertEnabled: row?.alert_enabled ?? true,
    }
  },

  async putRiderPrefs(context: AuthContext, input: ShuttleRiderPrefsInput) {
    if (input.stop_id && !input.route_id) throw badRequest('A stop needs its route', 'STOP_WITHOUT_ROUTE')
    if (input.route_id) {
      const route = await assertActiveRoute(context.universityId, input.route_id)
      const stops = Array.isArray(route.stops) ? (route.stops as { id?: unknown }[]) : []
      if (input.stop_id && !stops.some((s) => s.id === input.stop_id)) {
        throw notFound('Stop not found on this route', 'SHUTTLE_STOP_NOT_FOUND')
      }
    }

    await db('shuttle_rider_prefs')
      .insert({
        user_id: context.userId,
        university_id: context.universityId,
        route_id: input.route_id,
        stop_id: input.stop_id,
        alert_enabled: input.alert_enabled,
      })
      .onConflict('user_id')
      .merge({
        route_id: input.route_id,
        stop_id: input.stop_id,
        alert_enabled: input.alert_enabled,
        updated_at: db.fn.now(),
      })

    return this.getRiderPrefs(context)
  },

  /** Live notices only — expired and removed ones drop off without a cleanup job. */
  async listNotices(universityId: string) {
    const rows = (await db('shuttle_notices')
      .leftJoin('shuttle_routes', 'shuttle_routes.id', 'shuttle_notices.route_id')
      .select(
        'shuttle_notices.id',
        'shuttle_notices.route_id',
        'shuttle_routes.name as route_name',
        'shuttle_routes.color as route_color',
        'shuttle_notices.tone',
        'shuttle_notices.title',
        'shuttle_notices.detail',
        'shuttle_notices.expires_at',
        'shuttle_notices.created_at',
      )
      .where('shuttle_notices.university_id', universityId)
      .andWhere('shuttle_notices.is_deleted', false)
      .andWhere((q) => q.whereNull('shuttle_notices.expires_at').orWhere('shuttle_notices.expires_at', '>', db.fn.now()))
      .orderByRaw("CASE WHEN shuttle_notices.tone = 'disruption' THEN 0 ELSE 1 END")
      .orderBy('shuttle_notices.created_at', 'desc')
      .limit(NOTICES_LIMIT)) as NoticeRow[]
    return rows.map(toNotice)
  },

  async createNotice(context: AuthContext, input: ShuttleNoticeInput) {
    if (input.route_id) await assertActiveRoute(context.universityId, input.route_id)
    const [row] = await db('shuttle_notices')
      .insert({
        university_id: context.universityId,
        route_id: input.route_id ?? null,
        tone: input.tone,
        title: input.title,
        detail: input.detail ?? null,
        expires_at: input.expires_at ?? null,
        created_by: context.userId,
      })
      .returning<{ id: string }[]>('id')
    const notices = await this.listNotices(context.universityId)
    return notices.find((n) => n.id === row.id) ?? { id: row.id }
  },

  async deleteNotice(context: AuthContext, noticeId: string) {
    const updated = await db('shuttle_notices')
      .where({ id: noticeId, university_id: context.universityId, is_deleted: false })
      .update({ is_deleted: true, updated_at: db.fn.now() })
    if (updated === 0) throw notFound('Notice not found', 'SHUTTLE_NOTICE_NOT_FOUND')
  },
}
