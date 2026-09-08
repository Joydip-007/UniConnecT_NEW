import { db } from '../../config/db'
import type { ShuttleOpsSettingsInput } from './schema'

/** A broadcast is considered "live" if it's this fresh. Not a stateful on/off-duty
 *  flag — a driver simply ages out of "live" after this window with no explicit
 *  off-duty event, since the schema has no such concept. */
const LIVE_BROADCAST_WINDOW_MINUTES = 5

/** How close to a scheduled departure a broadcast must land to count as "on time".
 *  A proxy for true arrival tracking, which the schema doesn't support (no
 *  per-stop arrival events exist, only raw lat/lng broadcasts). */
const ON_TIME_TOLERANCE_MINUTES = 10

interface RouteRow {
  id: string
  schedule: { type?: 'fixed' | 'continuous'; departures?: { outbound?: string[]; inbound?: string[] } } | null
}

interface SettingsRow {
  shuttle_live_gps_enabled: boolean
  shuttle_rider_eta_enabled: boolean
  shuttle_auto_assign_enabled: boolean
  shuttle_service_alerts_enabled: boolean
}

export class AdminShuttleService {
  async getStats(universityId: string) {
    const routes = (await db('shuttle_routes')
      .select<RouteRow[]>('id', 'schedule')
      .where({ university_id: universityId, is_active: true })) as RouteRow[]

    const activeRoutes = routes.length
    const liveWindowStart = new Date(Date.now() - LIVE_BROADCAST_WINDOW_MINUTES * 60 * 1000)

    const liveRows = await db('shuttle_locations')
      .join('shuttle_routes', 'shuttle_routes.id', 'shuttle_locations.route_id')
      .select('shuttle_locations.route_id', 'shuttle_locations.driver_id')
      .where('shuttle_routes.university_id', universityId)
      .andWhere('shuttle_routes.is_active', true)
      .andWhere('shuttle_locations.updated_at', '>=', liveWindowStart)

    const liveRouteIds = new Set(liveRows.map((r) => r.route_id as string))
    const liveDriverIds = new Set(liveRows.map((r) => r.driver_id as string))

    const routeStatuses = routes.map((r) => ({ routeId: r.id, isLive: liveRouteIds.has(r.id) }))

    const onTimeRatePct = await this.computeOnTimeRatePct(universityId, routes)

    return {
      busesLive: liveRouteIds.size,
      activeRoutes,
      onDutyDrivers: liveDriverIds.size,
      onTimeRatePct,
      routes: routeStatuses,
    }
  }

  private async computeOnTimeRatePct(universityId: string, routes: RouteRow[]) {
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    let scheduled = 0
    let onTime = 0

    for (const route of routes) {
      if (route.schedule?.type !== 'fixed') continue
      const times = [
        ...(route.schedule.departures?.outbound ?? []),
        ...(route.schedule.departures?.inbound ?? []),
      ]

      for (const hhmm of times) {
        const departureAt = new Date(`${todayStr}T${hhmm}:00`)
        if (departureAt > now) continue // hasn't happened yet today
        scheduled += 1

        const windowStart = new Date(departureAt.getTime() - ON_TIME_TOLERANCE_MINUTES * 60 * 1000)
        const windowEnd = new Date(departureAt.getTime() + ON_TIME_TOLERANCE_MINUTES * 60 * 1000)

        const hit = await db('shuttle_locations')
          .join('shuttle_routes', 'shuttle_routes.id', 'shuttle_locations.route_id')
          .where('shuttle_routes.university_id', universityId)
          .andWhere('shuttle_locations.route_id', route.id)
          .andWhereBetween('shuttle_locations.updated_at', [windowStart, windowEnd])
          .first()

        if (hit) onTime += 1
      }
    }

    if (scheduled === 0) return null
    return Math.round((onTime / scheduled) * 100)
  }

  async getSettings(universityId: string) {
    const row = await this.ensureSettingsRow(universityId)
    return toSettings(row)
  }

  async updateSettings(universityId: string, input: ShuttleOpsSettingsInput) {
    await this.ensureSettingsRow(universityId)

    const patch: Record<string, unknown> = { updated_at: db.fn.now() }
    if (input.liveGpsEnabled !== undefined) patch.shuttle_live_gps_enabled = input.liveGpsEnabled
    if (input.riderEtaEnabled !== undefined) patch.shuttle_rider_eta_enabled = input.riderEtaEnabled
    if (input.autoAssignEnabled !== undefined) patch.shuttle_auto_assign_enabled = input.autoAssignEnabled
    if (input.serviceAlertsEnabled !== undefined) patch.shuttle_service_alerts_enabled = input.serviceAlertsEnabled

    await db('university_settings').where({ university_id: universityId }).update(patch)
    return this.getSettings(universityId)
  }

  /** Ensures a university_settings row exists; returns the shuttle-ops columns. */
  private async ensureSettingsRow(universityId: string): Promise<SettingsRow> {
    const existing = await db('university_settings')
      .select<SettingsRow[]>(
        'shuttle_live_gps_enabled',
        'shuttle_rider_eta_enabled',
        'shuttle_auto_assign_enabled',
        'shuttle_service_alerts_enabled',
      )
      .where({ university_id: universityId })
      .first()

    if (existing) return existing

    await db('university_settings').insert({ university_id: universityId }).onConflict('university_id').ignore()

    const row = await db('university_settings')
      .select<SettingsRow[]>(
        'shuttle_live_gps_enabled',
        'shuttle_rider_eta_enabled',
        'shuttle_auto_assign_enabled',
        'shuttle_service_alerts_enabled',
      )
      .where({ university_id: universityId })
      .first()

    if (!row) throw new Error('Failed to create university_settings row')
    return row
  }
}

export const adminShuttleService = new AdminShuttleService()

function toSettings(row: SettingsRow) {
  return {
    liveGpsEnabled: row.shuttle_live_gps_enabled,
    riderEtaEnabled: row.shuttle_rider_eta_enabled,
    autoAssignEnabled: row.shuttle_auto_assign_enabled,
    serviceAlertsEnabled: row.shuttle_service_alerts_enabled,
  }
}
