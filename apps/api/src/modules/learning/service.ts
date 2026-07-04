import { LEARNING } from '@uniconnect/shared'
import type { CompleteUnitInput } from '@uniconnect/shared'
import { db } from '../../config/db'
import { badRequest, conflict, forbidden, notFound, tooManyRequests } from '../../utils/errors'
import { badgeQueue } from '../../queues/badge.queue'
import { applyCompletion, localDateString, type StreakStats } from './streak'

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

function normalizeStatsRow(row: {
  current_streak: number
  longest_streak: number
  last_activity_date: string | Date | null
  freezes_used_month: string | null
  freezes_used_count: number
}): StreakStats {
  const last = row.last_activity_date
  return {
    currentStreak: row.current_streak,
    longestStreak: row.longest_streak,
    lastActivityDate: last instanceof Date ? last.toISOString().slice(0, 10) : last,
    freezesUsedMonth: row.freezes_used_month,
    freezesUsedCount: row.freezes_used_count,
  }
}

export async function completeUnit(
  unitId: string,
  userId: string,
  universityId: string,
  input: CompleteUnitInput,
) {
  const unit = await db('skill_path_units').where('id', unitId).first()
  if (!unit) throw notFound('Unit not found')

  const path = await findVisiblePath(unit.path_id, universityId)
  if (!path) throw notFound('Unit not found')

  const enrollment = await db('skill_path_enrollments')
    .where({ path_id: path.id, user_id: userId, status: 'active' })
    .first()
  if (!enrollment) throw forbidden('Not enrolled')

  const units = await db('skill_path_units').where('path_id', path.id).orderBy('display_order', 'asc')
  const completions = await db('unit_completions').where({ path_id: path.id, user_id: userId }).select('unit_id')
  const completedUnitIds = new Set(completions.map((c) => c.unit_id))
  const lowestIncompleteIndex = units.findIndex((u) => !completedUnitIds.has(u.id))
  const lowestIncomplete = lowestIncompleteIndex === -1 ? null : units[lowestIncompleteIndex]
  const alreadyCompletedByUser = completedUnitIds.has(unitId)
  if (!alreadyCompletedByUser && (!lowestIncomplete || lowestIncomplete.id !== unitId)) {
    throw badRequest('Unit is locked — complete earlier units first')
  }

  if (unit.type === 'quiz' && !alreadyCompletedByUser) {
    const passScore = unit.completion_rule?.passScore ?? 100
    if ((input.score ?? 0) < passScore) throw badRequest('Score below pass mark')
  }

  const university = await db('universities').where('id', universityId).first('timezone')
  const timezone = university?.timezone ?? 'UTC'
  const todayLocal = localDateString(new Date(), timezone)

  if (!alreadyCompletedByUser) {
    // Daily pacing only throttles consecutive progress: check whether the unit immediately
    // preceding this one (the last one completed) was finished today — not the whole history.
    const previousUnit = lowestIncompleteIndex > 0 ? units[lowestIncompleteIndex - 1] : null
    if (previousUnit) {
      const previousCompletedToday = await db('unit_completions')
        .where({ path_id: path.id, user_id: userId, unit_id: previousUnit.id })
        .andWhereRaw("to_char(completed_at AT TIME ZONE ?, 'YYYY-MM-DD') = ?", [timezone, todayLocal])
        .first()
      if (previousCompletedToday) throw tooManyRequests('One unit per day — come back tomorrow')
    }
  }

  const isLastUnit = units[units.length - 1]?.id === unitId

  const result = await db.transaction(async (trx) => {
    const inserted = await trx('unit_completions')
      .insert({
        user_id: userId,
        unit_id: unitId,
        path_id: path.id,
        university_id: universityId,
        score: input.score ?? null,
      })
      .onConflict(['user_id', 'unit_id'])
      .ignore()
      .returning('id')

    if (inserted.length === 0) {
      const statsRow = await trx('learning_stats').where('user_id', userId).first()
      const stats = statsRow ? normalizeStatsRow(statsRow) : null
      return {
        alreadyCompleted: true,
        pathCompleted: false,
        streak: {
          currentStreak: stats?.currentStreak ?? 0,
          longestStreak: stats?.longestStreak ?? 0,
        },
        statsChanged: false,
      }
    }

    const existingStatsRow = await trx('learning_stats').where('user_id', userId).forUpdate().first()
    const baseStats: StreakStats = existingStatsRow
      ? normalizeStatsRow(existingStatsRow)
      : { currentStreak: 0, longestStreak: 0, lastActivityDate: null, freezesUsedMonth: null, freezesUsedCount: 0 }

    const { stats: nextStats, changed } = applyCompletion(baseStats, todayLocal)

    await trx('learning_stats')
      .insert({
        user_id: userId,
        university_id: universityId,
        current_streak: nextStats.currentStreak,
        longest_streak: nextStats.longestStreak,
        last_activity_date: nextStats.lastActivityDate,
        freezes_used_month: nextStats.freezesUsedMonth,
        freezes_used_count: nextStats.freezesUsedCount,
      })
      .onConflict('user_id')
      .merge({
        current_streak: nextStats.currentStreak,
        longest_streak: nextStats.longestStreak,
        last_activity_date: nextStats.lastActivityDate,
        freezes_used_month: nextStats.freezesUsedMonth,
        freezes_used_count: nextStats.freezesUsedCount,
        updated_at: trx.fn.now(),
      })

    let pathCompleted = false
    if (isLastUnit) {
      await trx('skill_path_enrollments')
        .where({ id: enrollment.id })
        .update({ status: 'completed', completed_at: trx.fn.now() })
      pathCompleted = true
    }

    return {
      alreadyCompleted: false,
      pathCompleted,
      streak: { currentStreak: nextStats.currentStreak, longestStreak: nextStats.longestStreak },
      statsChanged: changed,
    }
  })

  if (!result.alreadyCompleted) {
    await badgeQueue.add({ userId, universityId, action: 'unit_completed' })
    if (result.statsChanged && (LEARNING.STREAK_MILESTONES as readonly number[]).includes(result.streak.currentStreak)) {
      await badgeQueue.add({
        userId,
        universityId,
        action: 'streak_milestone',
        payload: { streak: result.streak.currentStreak },
      })
    }
    if (result.pathCompleted) {
      await badgeQueue.add({ userId, universityId, action: 'path_completed', payload: { pathId: path.id } })
    }
  }

  return {
    completed: true,
    alreadyCompleted: result.alreadyCompleted,
    pathCompleted: result.pathCompleted,
    streak: result.streak,
  }
}

export async function getToday(userId: string, universityId: string) {
  const enrollments = await db('skill_path_enrollments')
    .where({ user_id: userId, status: 'active' })
    .select('path_id')

  const university = await db('universities').where('id', universityId).first('timezone')
  const timezone = university?.timezone ?? 'UTC'
  const todayLocal = localDateString(new Date(), timezone)

  const results = []
  for (const enrollment of enrollments) {
    const pathId = enrollment.path_id
    const units = await db('skill_path_units').where('path_id', pathId).orderBy('display_order', 'asc')
    const completions = await db('unit_completions').where({ path_id: pathId, user_id: userId }).select('unit_id')
    const completedUnitIds = new Set(completions.map((c) => c.unit_id))
    const nextUnit = units.find((u) => !completedUnitIds.has(u.id))

    const completedToday = await db('unit_completions')
      .where({ path_id: pathId, user_id: userId })
      .andWhereRaw("to_char(completed_at AT TIME ZONE ?, 'YYYY-MM-DD') = ?", [timezone, todayLocal])
      .first()

    if (nextUnit) {
      results.push({
        pathId,
        unit: nextUnit,
        completedToday: Boolean(completedToday),
      })
    }
  }

  return results
}

export async function getStats(userId: string) {
  const statsRow = await db('learning_stats').where('user_id', userId).first()
  const now = new Date()
  const month = now.toISOString().slice(0, 7)
  if (!statsRow) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastActivityDate: null,
      freezesRemaining: LEARNING.STREAK_FREEZES_PER_MONTH,
    }
  }
  const stats = normalizeStatsRow(statsRow)
  const usedThisMonth = stats.freezesUsedMonth === month ? stats.freezesUsedCount : 0
  return {
    currentStreak: stats.currentStreak,
    longestStreak: stats.longestStreak,
    lastActivityDate: stats.lastActivityDate,
    freezesRemaining: LEARNING.STREAK_FREEZES_PER_MONTH - usedThisMonth,
  }
}

interface UserBadgeRow {
  id: string
  name: string
  description: string | null
  icon_url: string | null
  category: string
  points: number
  skill_path_id: string | null
  awarded_at: string
  is_showcased: boolean
  holderCount: string
}

function rarityFor(holderCount: number): 'epic' | 'rare' | 'common' {
  if (holderCount <= LEARNING.RARITY_EPIC_MAX_HOLDERS) return 'epic'
  if (holderCount <= LEARNING.RARITY_RARE_MAX_HOLDERS) return 'rare'
  return 'common'
}

export async function listUserBadges(userId: string) {
  const rows = await db('user_badges')
    .join('badges', 'badges.id', 'user_badges.badge_id')
    .where('user_badges.user_id', userId)
    .orderBy('user_badges.awarded_at', 'desc')
    .select<UserBadgeRow[]>(
      'badges.id',
      'badges.name',
      'badges.description',
      'badges.icon_url',
      'badges.category',
      'badges.points',
      'badges.skill_path_id',
      'user_badges.awarded_at',
      'user_badges.is_showcased',
    )

  if (rows.length === 0) return []

  const badgeIds = rows.map((r) => r.id)
  const holderCounts = await db('user_badges')
    .whereIn('badge_id', badgeIds)
    .groupBy('badge_id')
    .select('badge_id')
    .count('* as holderCount')
  const holderCountByBadge = new Map(holderCounts.map((r) => [r.badge_id, Number(r.holderCount)]))

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    icon_url: r.icon_url,
    category: r.category,
    points: r.points,
    skill_path_id: r.skill_path_id,
    awarded_at: r.awarded_at,
    isShowcased: r.is_showcased,
    rarity: rarityFor(holderCountByBadge.get(r.id) ?? 0),
  }))
}

export async function setShowcase(userId: string, badgeId: string | null) {
  await db.transaction(async (trx) => {
    await trx('user_badges').where({ user_id: userId }).update({ is_showcased: false })

    if (badgeId) {
      const owned = await trx('user_badges').where({ user_id: userId, badge_id: badgeId }).first()
      if (!owned) throw notFound('Badge not owned')

      await trx('user_badges')
        .where({ user_id: userId, badge_id: badgeId })
        .update({ is_showcased: true })
    }
  })
}

export async function listUserBadgesForOther(userId: string, universityId: string) {
  const target = await db('users').where({ id: userId, university_id: universityId }).first('id')
  if (!target) throw notFound('User not found')
  return listUserBadges(userId)
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
