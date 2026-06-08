import type { UserRole } from '@uniconnect/shared'
import { db } from '../../config/db'
import { getIo } from '../../socket'
import { forbidden, notFound } from '../../utils/errors'
import type {
  CourseInput,
  CourseListQuery,
  CreateLostFoundInput,
  EnrollCourseInput,
  LostFoundListQuery,
  ShuttleLocationInput,
  ShuttleRouteInput,
  UpdateLostFoundInput,
} from './schema'

interface AuthContext {
  userId: string
  universityId: string
  role: UserRole
}

interface CountRow {
  count: string | number
}

interface LostFoundRow {
  id: string
  university_id: string
  posted_by: string
  type: 'lost' | 'found'
  item_name: string
  description: string
  images: string[] | null
  location_detail: string
  contact_info: string
  is_resolved: boolean
  created_at: Date
  updated_at: Date
  posted_by_name: string
  posted_by_avatar_url: string | null
}

interface ShuttleRouteRow {
  id: string
  university_id: string
  name: string
  color: string
  stops: unknown
  schedule: unknown
  est_duration_min: number | null
  cycle_minutes: number | null
  is_active: boolean
  created_at: Date
  updated_at: Date
}

interface ShuttleLocationRow {
  id: string
  route_id: string
  driver_id: string
  lat: number
  lng: number
  speed_kmh: string | null
  heading_deg: string | null
  updated_at: Date
  route_name: string
  route_color: string
  driver_name: string
}

interface CourseRow {
  id: string
  university_id: string
  code: string
  title: string
  section: string | null
  term: string | null
  lms_url: string | null
  is_active: boolean
  created_at: Date
}

interface MyCourseRow extends CourseRow {
  status: string
  grade: string | null
  enrolled_at: Date
}

export class CampusService {
  async listLostFound(universityId: string, query: LostFoundListQuery) {
    const countQuery = db('lost_and_found').where({ university_id: universityId })
    if (query.type) countQuery.andWhere('type', query.type)
    if (query.isResolved !== undefined) countQuery.andWhere('is_resolved', query.isResolved)

    const [{ count }] = await countQuery.count<CountRow[]>({ count: '*' })
    const total = Number(count)

    const rows = (await lostFoundSelectQuery()
      .where('lost_and_found.university_id', universityId)
      .modify((builder) => {
        if (query.type) builder.andWhere('lost_and_found.type', query.type)
        if (query.isResolved !== undefined) builder.andWhere('lost_and_found.is_resolved', query.isResolved)
      })
      .orderBy('lost_and_found.created_at', 'desc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)) as LostFoundRow[]

    return { items: rows.map(toLostFound), total, page: query.page, limit: query.limit }
  }

  async createLostFound(context: AuthContext, input: CreateLostFoundInput) {
    const [row] = await db('lost_and_found')
      .insert({
        university_id: context.universityId,
        posted_by: context.userId,
        type: input.type,
        item_name: input.item_name,
        description: input.description,
        images: input.images,
        location_detail: input.location_detail,
        contact_info: input.contact_info,
      })
      .returning<{ id: string }[]>('id')

    if (!row) throw notFound('Lost and found item not found', 'LOST_FOUND_NOT_FOUND')
    return this.getLostFound(context.universityId, row.id)
  }

  async getLostFound(universityId: string, itemId: string) {
    const row = await lostFoundSelectQuery()
      .where({ 'lost_and_found.id': itemId, 'lost_and_found.university_id': universityId })
      .first<LostFoundRow>()

    if (!row) throw notFound('Lost and found item not found', 'LOST_FOUND_NOT_FOUND')
    return toLostFound(row)
  }

  async updateLostFound(context: AuthContext, itemId: string, input: UpdateLostFoundInput) {
    const item = await assertLostFoundOwner(context, itemId)
    assertCanModify(context, item.posted_by)

    await db('lost_and_found')
      .where({ id: itemId, university_id: context.universityId })
      .update({
        ...pickDefined({
          item_name: input.item_name,
          description: input.description,
          images: input.images,
          location_detail: input.location_detail,
          contact_info: input.contact_info,
          is_resolved: input.is_resolved,
        }),
        updated_at: db.fn.now(),
      })

    return this.getLostFound(context.universityId, itemId)
  }

  async resolveLostFound(context: AuthContext, itemId: string) {
    const item = await assertLostFoundOwner(context, itemId)
    assertCanModify(context, item.posted_by)

    await db('lost_and_found')
      .where({ id: itemId, university_id: context.universityId })
      .update({ is_resolved: true, updated_at: db.fn.now() })
    return this.getLostFound(context.universityId, itemId)
  }

  async listShuttleRoutes(universityId: string, includeInactive = false) {
    const query = db('shuttle_routes').select<ShuttleRouteRow[]>('*').where({ university_id: universityId })
    if (!includeInactive) query.andWhere({ is_active: true })
    const rows = await query.orderBy('name', 'asc')
    return rows.map(toShuttleRoute)
  }

  async deleteShuttleRoute(universityId: string, routeId: string) {
    const deleted = await db('shuttle_routes').where({ id: routeId, university_id: universityId }).del()
    if (deleted === 0) throw notFound('Shuttle route not found', 'SHUTTLE_ROUTE_NOT_FOUND')
  }

  async createShuttleRoute(universityId: string, input: ShuttleRouteInput) {
    const [row] = await db('shuttle_routes')
      .insert({
        university_id: universityId,
        name: input.name,
        color: input.color,
        stops: JSON.stringify(input.stops),
        schedule: JSON.stringify(input.schedule),
        est_duration_min: input.est_duration_min,
        cycle_minutes: input.cycle_minutes,
        is_active: input.is_active,
      })
      .returning<{ id: string }[]>('id')

    if (!row) throw notFound('Shuttle route not found', 'SHUTTLE_ROUTE_NOT_FOUND')
    return this.getShuttleRoute(universityId, row.id)
  }

  async updateShuttleRoute(universityId: string, routeId: string, input: ShuttleRouteInput) {
    const updated = await db('shuttle_routes')
      .where({ id: routeId, university_id: universityId })
      .update({
        name: input.name,
        color: input.color,
        stops: JSON.stringify(input.stops),
        schedule: JSON.stringify(input.schedule),
        est_duration_min: input.est_duration_min,
        cycle_minutes: input.cycle_minutes,
        is_active: input.is_active,
        updated_at: db.fn.now(),
      })

    if (updated === 0) throw notFound('Shuttle route not found', 'SHUTTLE_ROUTE_NOT_FOUND')
    return this.getShuttleRoute(universityId, routeId)
  }

  async listShuttleLocations(universityId: string) {
    const rows = (await db('shuttle_locations')
      .join('shuttle_routes', 'shuttle_routes.id', 'shuttle_locations.route_id')
      .join('profiles', 'profiles.user_id', 'shuttle_locations.driver_id')
      .select(
        'shuttle_locations.id',
        'shuttle_locations.route_id',
        'shuttle_locations.driver_id',
        'shuttle_locations.lat',
        'shuttle_locations.lng',
        'shuttle_locations.speed_kmh',
        'shuttle_locations.heading_deg',
        'shuttle_locations.updated_at',
        'shuttle_routes.name as route_name',
        'shuttle_routes.color as route_color',
        'profiles.full_name as driver_name',
      )
      .whereIn('shuttle_locations.id', function latestLocations() {
        this.select(db.raw('(ARRAY_AGG(shuttle_locations.id ORDER BY shuttle_locations.updated_at DESC))[1]'))
          .from('shuttle_locations')
          .join('shuttle_routes', 'shuttle_routes.id', 'shuttle_locations.route_id')
          .where('shuttle_routes.university_id', universityId)
          .andWhere('shuttle_routes.is_active', true)
          .groupBy('shuttle_locations.route_id')
      })) as ShuttleLocationRow[]

    return rows.map(toShuttleLocation)
  }

  async createShuttleLocation(context: AuthContext, input: ShuttleLocationInput) {
    const route = await db('shuttle_routes')
      .where({ id: input.route_id, university_id: context.universityId, is_active: true })
      .first()

    if (!route) throw notFound('Shuttle route not found', 'SHUTTLE_ROUTE_NOT_FOUND')

    const [row] = await db('shuttle_locations')
      .insert({
        route_id: input.route_id,
        driver_id: context.userId,
        lat: input.lat,
        lng: input.lng,
        speed_kmh: input.speed_kmh ?? null,
        heading_deg: input.heading_deg ?? null,
      })
      .returning<{ id: string }[]>('id')

    if (!row) throw notFound('Shuttle location not found', 'SHUTTLE_LOCATION_NOT_FOUND')
    const locations = await this.listShuttleLocations(context.universityId)
    const location = locations.find((entry) => entry.id === row.id)
    if (location && 'routeId' in location) {
      getIo().to(`uni:${context.universityId}`).emit('shuttle:location', location)
    }
    return location ?? { id: row.id }
  }

  async listCourses(universityId: string, query: CourseListQuery) {
    const countQuery = db('courses').where({ university_id: universityId, is_active: true })
    if (query.search) {
      countQuery.andWhere((builder) => {
        builder.whereILike('code', `%${query.search}%`).orWhereILike('title', `%${query.search}%`)
      })
    }

    const [{ count }] = await countQuery.count<CountRow[]>({ count: '*' })
    const total = Number(count)

    const rows = await db('courses')
      .select<CourseRow[]>('*')
      .where({ university_id: universityId, is_active: true })
      .modify((builder) => {
        if (query.search) {
          builder.andWhere((nested) => {
            nested.whereILike('code', `%${query.search}%`).orWhereILike('title', `%${query.search}%`)
          })
        }
      })
      .orderBy('code', 'asc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)

    return { items: rows.map(toCourse), total, page: query.page, limit: query.limit }
  }

  async createCourse(universityId: string, input: CourseInput) {
    const [row] = await db('courses')
      .insert(toCourseColumns(universityId, input))
      .returning<{ id: string }[]>('id')

    if (!row) throw notFound('Course not found', 'COURSE_NOT_FOUND')
    return this.getCourse(universityId, row.id)
  }

  async updateCourse(universityId: string, courseId: string, input: CourseInput) {
    const updated = await db('courses').where({ id: courseId, university_id: universityId }).update(toCourseColumns(universityId, input))
    if (updated === 0) throw notFound('Course not found', 'COURSE_NOT_FOUND')
    return this.getCourse(universityId, courseId)
  }

  async enrollCourse(context: AuthContext, courseId: string, input: EnrollCourseInput) {
    await this.getCourse(context.universityId, courseId)
    await db('user_courses')
      .insert({
        user_id: context.userId,
        course_id: courseId,
        status: input.status,
        grade: input.grade ?? null,
      })
      .onConflict(['user_id', 'course_id'])
      .merge({
        status: input.status,
        grade: input.grade ?? null,
      })

    return { enrolled: true }
  }

  async listMyCourses(context: AuthContext) {
    const rows = (await db('user_courses')
      .join('courses', 'courses.id', 'user_courses.course_id')
      .select(
        'courses.id',
        'courses.university_id',
        'courses.code',
        'courses.title',
        'courses.section',
        'courses.term',
        'courses.lms_url',
        'courses.is_active',
        'courses.created_at',
        'user_courses.status',
        'user_courses.grade',
        'user_courses.created_at as enrolled_at',
      )
      .where({ 'user_courses.user_id': context.userId, 'courses.university_id': context.universityId })
      .orderBy('courses.code', 'asc')) as MyCourseRow[]

    return rows.map((row) => ({ ...toCourse(row), status: row.status, grade: row.grade, enrolledAt: row.enrolled_at }))
  }

  private async getShuttleRoute(universityId: string, routeId: string) {
    const row = await db('shuttle_routes').select<ShuttleRouteRow[]>('*').where({ id: routeId, university_id: universityId }).first()
    if (!row) throw notFound('Shuttle route not found', 'SHUTTLE_ROUTE_NOT_FOUND')
    return toShuttleRoute(row)
  }

  private async getCourse(universityId: string, courseId: string) {
    const row = await db('courses').select<CourseRow[]>('*').where({ id: courseId, university_id: universityId }).first()
    if (!row) throw notFound('Course not found', 'COURSE_NOT_FOUND')
    return toCourse(row)
  }
}

export const campusService = new CampusService()

function lostFoundSelectQuery() {
  return db('lost_and_found')
    .join('profiles', 'profiles.user_id', 'lost_and_found.posted_by')
    .select<LostFoundRow[]>(
      'lost_and_found.id',
      'lost_and_found.university_id',
      'lost_and_found.posted_by',
      'lost_and_found.type',
      'lost_and_found.item_name',
      'lost_and_found.description',
      'lost_and_found.images',
      'lost_and_found.location_detail',
      'lost_and_found.contact_info',
      'lost_and_found.is_resolved',
      'lost_and_found.created_at',
      'lost_and_found.updated_at',
      'profiles.full_name as posted_by_name',
      'profiles.avatar_url as posted_by_avatar_url',
    )
}

async function assertLostFoundOwner(context: AuthContext, itemId: string) {
  const item = await db('lost_and_found')
    .select<{ posted_by: string }[]>('posted_by')
    .where({ id: itemId, university_id: context.universityId })
    .first()

  if (!item) throw notFound('Lost and found item not found', 'LOST_FOUND_NOT_FOUND')
  return item
}

function assertCanModify(context: AuthContext, ownerId: string) {
  if (context.userId === ownerId || context.role === 'admin') return
  throw forbidden('You do not have permission to modify this item', 'CAMPUS_FORBIDDEN')
}

function toLostFound(row: LostFoundRow) {
  return {
    id: row.id,
    universityId: row.university_id,
    postedBy: row.posted_by,
    type: row.type,
    itemName: row.item_name,
    description: row.description,
    images: row.images ?? [],
    imageUrls: row.images ?? [],
    locationDetail: row.location_detail,
    contactInfo: row.contact_info,
    isResolved: row.is_resolved,
    authorId: row.posted_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    poster: {
      id: row.posted_by,
      fullName: row.posted_by_name,
      avatarUrl: row.posted_by_avatar_url,
    },
    author: {
      fullName: row.posted_by_name,
      avatarUrl: row.posted_by_avatar_url,
      department: null,
      batchYear: null,
    },
  }
}

function toShuttleRoute(row: ShuttleRouteRow) {
  return {
    id: row.id,
    universityId: row.university_id,
    name: row.name,
    color: row.color,
    stops: row.stops,
    schedule: row.schedule,
    estDurationMin: row.est_duration_min,
    cycleMinutes: row.cycle_minutes,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toShuttleLocation(row: ShuttleLocationRow) {
  return {
    id: row.id,
    routeId: row.route_id,
    driverId: row.driver_id,
    lat: Number(row.lat),
    lng: Number(row.lng),
    speedKmh: row.speed_kmh === null ? null : Number(row.speed_kmh),
    headingDeg: row.heading_deg === null ? null : Number(row.heading_deg),
    updatedAt: row.updated_at,
    route: {
      id: row.route_id,
      name: row.route_name,
      color: row.route_color,
    },
    driver: {
      id: row.driver_id,
      fullName: row.driver_name,
    },
  }
}

function toCourse(row: CourseRow) {
  return {
    id: row.id,
    universityId: row.university_id,
    code: row.code,
    title: row.title,
    section: row.section,
    term: row.term,
    lmsUrl: row.lms_url,
    isActive: row.is_active,
    createdAt: row.created_at,
  }
}

function toCourseColumns(universityId: string, input: CourseInput) {
  return {
    university_id: universityId,
    code: input.code,
    title: input.title,
    section: input.section ?? null,
    term: input.term ?? null,
    lms_url: input.lms_url ?? null,
    is_active: input.is_active,
  }
}

function pickDefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined))
}
