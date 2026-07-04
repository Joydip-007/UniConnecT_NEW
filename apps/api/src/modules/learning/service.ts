import { db } from '../../config/db'
import { conflict, notFound } from '../../utils/errors'

function tenantVisible(qb: import('knex').Knex.QueryBuilder, universityId: string) {
  return qb.where((w) => w.whereNull('university_id').orWhere('university_id', universityId))
}

interface SkillPathRow {
  id: string
  university_id: string | null
  title: string
  description: string | null
  category: string
  difficulty: string
  estimated_days: number
  badge_name: string | null
  badge_icon: string | null
  is_published: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export async function listPaths(universityId: string, userId: string) {
  const paths = await tenantVisible(db('skill_paths').where('is_published', true), universityId)
    .orderBy('created_at', 'asc')
    .select<SkillPathRow[]>('*')

  if (paths.length === 0) return []

  const pathIds = paths.map((p) => p.id)

  const unitCounts = await db('skill_path_units')
    .whereIn('path_id', pathIds)
    .groupBy('path_id')
    .select('path_id')
    .count('* as unitCount')
  const unitCountByPath = new Map(unitCounts.map((r) => [r.path_id, Number(r.unitCount)]))

  const enrollCounts = await db('skill_path_enrollments')
    .whereIn('path_id', pathIds)
    .whereIn('status', ['active', 'completed'])
    .groupBy('path_id')
    .select('path_id')
    .count('* as enrolledCount')
  const enrolledCountByPath = new Map(enrollCounts.map((r) => [r.path_id, Number(r.enrolledCount)]))

  const myEnrollments = await db('skill_path_enrollments')
    .whereIn('path_id', pathIds)
    .andWhere('user_id', userId)
    .select('path_id', 'status')
  const myEnrollmentByPath = new Map(myEnrollments.map((r) => [r.path_id, r.status]))

  return paths.map((p) => ({
    ...p,
    unitCount: unitCountByPath.get(p.id) ?? 0,
    enrolledCount: enrolledCountByPath.get(p.id) ?? 0,
    myEnrollmentStatus: myEnrollmentByPath.get(p.id) ?? null,
  }))
}

async function findVisiblePath(pathId: string, universityId: string) {
  const path = await tenantVisible(db('skill_paths').where('id', pathId), universityId).first()
  return path
}

export async function getPath(pathId: string, userId: string, universityId: string) {
  const path = await findVisiblePath(pathId, universityId)
  if (!path) throw notFound('Path not found')

  const units = await db('skill_path_units').where('path_id', pathId).orderBy('display_order', 'asc')

  const enrollment = await db('skill_path_enrollments')
    .where({ path_id: pathId, user_id: userId })
    .first()

  const completions = await db('unit_completions')
    .where({ path_id: pathId, user_id: userId })
    .select('unit_id')
  const completedUnitIds = new Set(completions.map((c) => c.unit_id))

  let nextIncompleteOrder = 1
  if (enrollment) {
    const completedOrders = units
      .filter((u) => completedUnitIds.has(u.id))
      .map((u) => u.display_order)
    let order = 1
    while (completedOrders.includes(order)) order += 1
    nextIncompleteOrder = order
  }

  const enrolled = Boolean(enrollment)

  const outUnits = units.map((u) => {
    const completed = completedUnitIds.has(u.id)
    const unlocked = enrolled && u.display_order <= nextIncompleteOrder
    return {
      id: u.id,
      display_order: u.display_order,
      title: u.title,
      type: u.type,
      completed,
      content: unlocked ? u.content : null,
    }
  })

  return {
    ...path,
    units: outUnits,
    enrollment: enrollment ?? null,
  }
}

export async function enroll(pathId: string, userId: string, universityId: string) {
  const path = await findVisiblePath(pathId, universityId)
  if (!path || !path.is_published) throw notFound('Path not found')

  return db.transaction(async (trx) => {
    const existing = await trx('skill_path_enrollments')
      .where({ path_id: pathId, user_id: userId })
      .first()

    if (existing) {
      if (existing.status === 'active' || existing.status === 'completed') {
        throw conflict('Already enrolled')
      }
      const [updated] = await trx('skill_path_enrollments')
        .where('id', existing.id)
        .update({ status: 'active', started_at: trx.fn.now(), completed_at: null })
        .returning('*')
      return updated
    }

    const [created] = await trx('skill_path_enrollments')
      .insert({
        path_id: pathId,
        user_id: userId,
        university_id: universityId,
        status: 'active',
      })
      .returning('*')

    await trx('learning_stats')
      .insert({ user_id: userId, university_id: universityId })
      .onConflict('user_id')
      .ignore()

    return created
  })
}

export async function abandon(pathId: string, userId: string) {
  const existing = await db('skill_path_enrollments')
    .where({ path_id: pathId, user_id: userId, status: 'active' })
    .first()
  if (!existing) throw notFound('Enrollment not found')

  const [updated] = await db('skill_path_enrollments')
    .where('id', existing.id)
    .update({ status: 'abandoned' })
    .returning('*')
  return updated
}
