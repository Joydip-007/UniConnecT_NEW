import { LEARNING } from '@uniconnect/shared'
import type { CompleteUnitInput, SubmitUnitQuizAttemptInput } from '@uniconnect/shared'
import { db } from '../../config/db'
import { AppError, badRequest, conflict, forbidden, notFound, tooManyRequests } from '../../utils/errors'
import { badgeQueue } from '../../queues/badge.queue'
import { applyCompletion, localDateString, normalizePgDate, type StreakStats } from './streak'

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

  // The card shows how far into a path you are without opening the detail modal, so the
  // list needs the caller's own completion count and the title of the unit they resume at.
  // Both are scoped to `userId` — this is per-caller progress, never anyone else's.
  const enrolledPathIds = myEnrollments.map((r) => r.path_id)
  const completedByPath = new Map<string, number>()
  const nextUnitByPath = new Map<string, string>()

  if (enrolledPathIds.length > 0) {
    const myCompletions = await db('unit_completions')
      .whereIn('path_id', enrolledPathIds)
      .andWhere('user_id', userId)
      .select('path_id', 'unit_id')
    const completedUnitIds = new Set(myCompletions.map((c) => c.unit_id))
    for (const row of myCompletions) {
      completedByPath.set(row.path_id, (completedByPath.get(row.path_id) ?? 0) + 1)
    }

    const enrolledUnits = await db('skill_path_units')
      .whereIn('path_id', enrolledPathIds)
      .orderBy('display_order', 'asc')
      .select('path_id', 'id', 'title')
    for (const unit of enrolledUnits) {
      if (completedUnitIds.has(unit.id) || nextUnitByPath.has(unit.path_id)) continue
      nextUnitByPath.set(unit.path_id, unit.title)
    }
  }

  return paths.map((p) => ({
    ...p,
    unitCount: unitCountByPath.get(p.id) ?? 0,
    enrolledCount: enrolledCountByPath.get(p.id) ?? 0,
    myEnrollmentStatus: myEnrollmentByPath.get(p.id) ?? null,
    completedUnitCount: completedByPath.get(p.id) ?? 0,
    nextUnitTitle: nextUnitByPath.get(p.id) ?? null,
  }))
}

interface UnitContent {
  body?: string
  text?: string
  summary?: string
  /** Written by the admin path builder. `minutes` is accepted as an alias. */
  estimatedMinutes?: number
  minutes?: number
  video_url?: string
  questions?: { q: string; options: string[]; answer: number }[]
}

const READING_WORDS_PER_MINUTE = 200
const SUMMARY_MAX_CHARS = 160

/** The first sentence of a body, capped, for units authored before `summary` existed. */
function summarise(body: string): string {
  const flat = body.replace(/\s+/g, ' ').trim()
  const sentence = flat.match(/^.*?[.!?](\s|$)/)?.[0]?.trim() ?? flat
  return sentence.length > SUMMARY_MAX_CHARS ? `${sentence.slice(0, SUMMARY_MAX_CHARS - 1).trimEnd()}…` : sentence
}

export function unitMeta(unit: { type: string; content: UnitContent | null }) {
  const content = unit.content ?? {}
  const body = content.body ?? content.text ?? ''
  const words = body.trim() ? body.trim().split(/\s+/).length : 0
  const authored = content.estimatedMinutes ?? content.minutes
  const minutes =
    typeof authored === 'number' && authored > 0
      ? Math.round(authored)
      : unit.type === 'read' && words > 0
        ? Math.max(1, Math.ceil(words / READING_WORDS_PER_MINUTE))
        : null
  return {
    summary: content.summary?.trim() || (body ? summarise(body) : null),
    minutes,
    questionCount: unit.type === 'quiz' ? (content.questions?.length ?? 0) : 0,
    hasVideo: typeof content.video_url === 'string' && content.video_url.length > 0,
  }
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
      // Row metadata is public so a locked unit still says what it covers and how long it
      // takes; the body, video and questions stay gated behind `unlocked`.
      ...unitMeta(u),
      content: unlocked ? u.content : null,
      completion_rule: u.completion_rule ?? {},
    }
  })

  // The detail payload shares the card's shape, so it owes the same counts. Without
  // `unitCount` the modal's meta line renders as " units · ~5 days · beginner".
  const [{ count: enrolledCount }] = await db('skill_path_enrollments')
    .where('path_id', pathId)
    .whereIn('status', ['active', 'completed'])
    .count('* as count')

  return {
    ...path,
    unitCount: units.length,
    enrolledCount: Number(enrolledCount),
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

    let created
    try {
      ;[created] = await trx('skill_path_enrollments')
        .insert({
          path_id: pathId,
          user_id: userId,
          university_id: universityId,
          status: 'active',
        })
        .returning('*')
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw conflict('Already enrolled')
      }
      throw error
    }

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
  return {
    currentStreak: row.current_streak,
    longestStreak: row.longest_streak,
    lastActivityDate: normalizePgDate(row.last_activity_date),
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

export async function getStats(userId: string, universityId: string) {
  const statsRow = await db('learning_stats').where('user_id', userId).first()
  const university = await db('universities').where('id', universityId).first('timezone')
  const timezone = university?.timezone ?? 'UTC'
  // University-local month, consistent with the sweep's freeze accounting.
  const month = localDateString(new Date(), timezone).slice(0, 7)
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
  showcased_at: string | null
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
      'user_badges.showcased_at',
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
    iconUrl: r.icon_url,
    category: r.category,
    points: r.points,
    skillPathId: r.skill_path_id,
    awardedAt: r.awarded_at,
    isShowcased: r.is_showcased,
    showcasedAt: r.showcased_at,
    rarity: rarityFor(holderCountByBadge.get(r.id) ?? 0),
  }))
}

export async function setShowcase(userId: string, badgeId: string | null) {
  await db.transaction(async (trx) => {
    await trx('user_badges').where({ user_id: userId }).update({ is_showcased: false, showcased_at: null })

    if (badgeId) {
      const owned = await trx('user_badges').where({ user_id: userId, badge_id: badgeId }).first()
      if (!owned) throw notFound('Badge not owned')

      await trx('user_badges')
        .where({ user_id: userId, badge_id: badgeId })
        .update({ is_showcased: true, showcased_at: trx.fn.now() })
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

// ── Checkpoint quizzes ──────────────────────────────────────────────────────

interface QuizUnitRow {
  id: string
  path_id: string
  display_order: number
  title: string
  type: string
  content: UnitContent | null
  completion_rule: { passScore?: number } | null
}

function passScoreOf(unit: { completion_rule: { passScore?: number } | null }) {
  return unit.completion_rule?.passScore ?? LEARNING.DEFAULT_QUIZ_PASS_SCORE
}

function toAttempt(
  row: { id: string; answers: unknown; score: number; correct_count: number; total_questions: number; created_at: string },
  questions: NonNullable<UnitContent['questions']>,
  passScore: number,
) {
  const answers = (Array.isArray(row.answers) ? row.answers : []) as (number | null)[]
  return {
    id: row.id,
    createdAt: row.created_at,
    score: row.score,
    correctCount: row.correct_count,
    totalQuestions: row.total_questions,
    passed: row.score >= passScore,
    review: questions.map((q, i) => ({
      question: q.q,
      options: q.options,
      selectedIndex: typeof answers[i] === 'number' ? answers[i] : null,
      correctIndex: q.answer,
      isCorrect: answers[i] === q.answer,
    })),
  }
}

/**
 * The caller's quiz unit, reachable only when it is unlocked for them: already passed, or
 * the next unit of a path they are enrolled in. A finished path's checkpoints stay open for
 * retakes, which is why a `completed` enrollment counts too.
 */
async function loadQuizUnitForCaller(unitId: string, userId: string, universityId: string) {
  const unit = await db('skill_path_units').where('id', unitId).first<QuizUnitRow | undefined>()
  if (!unit) throw notFound('Unit not found')
  const path = await findVisiblePath(unit.path_id, universityId)
  if (!path) throw notFound('Unit not found')
  if (unit.type !== 'quiz') throw badRequest('Not a quiz unit')

  const enrollment = await db('skill_path_enrollments')
    .where({ path_id: path.id, user_id: userId })
    .whereIn('status', ['active', 'completed'])
    .first()
  if (!enrollment) throw forbidden('Not enrolled')

  const units = await db('skill_path_units').where('path_id', path.id).orderBy('display_order', 'asc').select('id')
  const completions = await db('unit_completions').where({ path_id: path.id, user_id: userId }).select('unit_id')
  const done = new Set(completions.map((c) => c.unit_id))
  const next = units.find((u) => !done.has(u.id))
  const alreadyCompleted = done.has(unitId)
  if (!alreadyCompleted && next?.id !== unitId) throw badRequest('Unit is locked — complete earlier units first')

  return { unit, path, enrollment, alreadyCompleted, questions: unit.content?.questions ?? [] }
}

export async function submitUnitQuizAttempt(
  unitId: string,
  userId: string,
  universityId: string,
  input: SubmitUnitQuizAttemptInput,
) {
  const { unit, path, enrollment, alreadyCompleted, questions } = await loadQuizUnitForCaller(
    unitId,
    userId,
    universityId,
  )
  if (questions.length === 0) throw badRequest('This quiz has no questions yet')
  if (input.answers.length !== questions.length) throw badRequest('Answer every question')

  const correctCount = questions.filter((q, i) => input.answers[i] === q.answer).length
  const score = Math.round((100 * correctCount) / questions.length)
  const passScore = passScoreOf(unit)

  const [row] = await db('unit_quiz_attempts')
    .insert({
      university_id: universityId,
      user_id: userId,
      unit_id: unitId,
      path_id: path.id,
      answers: JSON.stringify(input.answers),
      correct_count: correctCount,
      total_questions: questions.length,
      score,
    })
    .returning('*')

  // A pass on the current unit completes it. The attempt is kept either way, so a pass that
  // the daily pacing refuses still shows in Past results and the unit can be completed tomorrow.
  let completion: Awaited<ReturnType<typeof completeUnit>> | null = null
  let completionError: string | null = null
  if (score >= passScore && !alreadyCompleted && enrollment.status === 'active') {
    try {
      completion = await completeUnit(unitId, userId, universityId, { score })
    } catch (error) {
      if (!(error instanceof AppError) || error.statusCode >= 500) throw error
      completionError = error.message
    }
  }

  return { attempt: toAttempt(row, questions, passScore), passScore, completion, completionError }
}

export async function listUnitQuizAttempts(unitId: string, userId: string, universityId: string) {
  const unit = await db('skill_path_units').where('id', unitId).first<QuizUnitRow | undefined>()
  if (!unit || unit.type !== 'quiz') throw notFound('Unit not found')
  const path = await findVisiblePath(unit.path_id, universityId)
  if (!path) throw notFound('Unit not found')

  const rows = await db('unit_quiz_attempts')
    .where({ unit_id: unitId, user_id: userId })
    .orderBy('created_at', 'desc')
  const passScore = passScoreOf(unit)
  return rows.map((r) => toAttempt(r, unit.content?.questions ?? [], passScore))
}

/**
 * Every checkpoint quiz in the caller's visible catalogue, in path order, with where the
 * caller stands on it. Backs the Learn page's Quizzes tab.
 */
export async function listMyQuizzes(userId: string, universityId: string) {
  const paths = await tenantVisible(db('skill_paths').where('is_published', true), universityId)
    .orderBy('created_at', 'asc')
    .select<SkillPathRow[]>('id', 'title')
  if (paths.length === 0) return []
  const pathIds = paths.map((p) => p.id)

  const units = await db('skill_path_units')
    .whereIn('path_id', pathIds)
    .orderBy([{ column: 'path_id' }, { column: 'display_order', order: 'asc' }])
    .select<QuizUnitRow[]>('id', 'path_id', 'display_order', 'title', 'type', 'content', 'completion_rule')
  const quizUnits = units.filter((u) => u.type === 'quiz')
  if (quizUnits.length === 0) return []

  const enrollments = await db('skill_path_enrollments')
    .whereIn('path_id', pathIds)
    .andWhere('user_id', userId)
    .select('path_id', 'status')
  const statusByPath = new Map(enrollments.map((e) => [e.path_id, e.status as string]))

  const completions = await db('unit_completions').whereIn('path_id', pathIds).andWhere('user_id', userId).select('unit_id')
  const done = new Set(completions.map((c) => c.unit_id))

  const stats = await db('unit_quiz_attempts')
    .whereIn('unit_id', quizUnits.map((u) => u.id))
    .andWhere('user_id', userId)
    .groupBy('unit_id')
    .select('unit_id')
    .count('* as attemptCount')
    .max('score as bestScore')
  const statsByUnit = new Map(stats.map((r) => [r.unit_id as string, r]))

  const latest = await db('unit_quiz_attempts')
    .distinctOn('unit_id')
    .whereIn('unit_id', quizUnits.map((u) => u.id))
    .andWhere('user_id', userId)
    .orderBy([{ column: 'unit_id' }, { column: 'created_at', order: 'desc' }])
    .select('unit_id', 'score')
  const latestByUnit = new Map(latest.map((r) => [r.unit_id as string, r.score as number]))

  const unitsByPath = new Map<string, QuizUnitRow[]>()
  for (const u of units) unitsByPath.set(u.path_id, [...(unitsByPath.get(u.path_id) ?? []), u])
  const pathOrder = new Map(paths.map((p, i) => [p.id, i]))

  return quizUnits
    .sort((a, b) => (pathOrder.get(a.path_id) ?? 0) - (pathOrder.get(b.path_id) ?? 0) || a.display_order - b.display_order)
    .map((unit) => {
      const status = statusByPath.get(unit.path_id) ?? null
      const started = status === 'active' || status === 'completed'
      const siblings = unitsByPath.get(unit.path_id) ?? []
      const next = status === 'active' ? siblings.find((u) => !done.has(u.id)) : undefined
      const completed = done.has(unit.id)
      const state: 'completed' | 'next' | 'locked' = completed
        ? 'completed'
        : next?.id === unit.id
          ? 'next'
          : 'locked'
      const row = statsByUnit.get(unit.id)
      const attemptCount = Number(row?.attemptCount ?? 0)
      const bestScore = row?.bestScore === null || row?.bestScore === undefined ? null : Number(row.bestScore)
      const passScore = passScoreOf(unit)
      return {
        unitId: unit.id,
        pathId: unit.path_id,
        pathTitle: paths.find((p) => p.id === unit.path_id)?.title ?? '',
        title: unit.title,
        summary: unitMeta(unit).summary,
        questionCount: unit.content?.questions?.length ?? 0,
        passScore,
        state,
        pathStarted: started,
        // What the learner must finish first, when the quiz is locked inside an active path.
        blockedByTitle: state === 'locked' && next ? next.title : null,
        attemptCount,
        bestScore,
        lastScore: latestByUnit.get(unit.id) ?? null,
        passed: completed || (bestScore !== null && bestScore >= passScore),
      }
    })
}

// ── Badge progress & pins ───────────────────────────────────────────────────

/** Badge triggers the Learn page owns. Social badges (posts, events…) live on the profile. */
const LEARNING_TRIGGERS = ['streak_milestone', 'unit_completed', 'quiz_win', 'path_completed'] as const

/**
 * The learning badge catalogue with the caller's progress toward each. Progress uses the same
 * counters the badge worker awards on, so a bar at 100% and an earned badge always agree.
 */
export async function getBadgeProgress(userId: string, universityId: string) {
  const visiblePaths = await tenantVisible(db('skill_paths').where('is_published', true), universityId).select<
    SkillPathRow[]
  >('id', 'title')
  const visiblePathIds = visiblePaths.map((p) => p.id)

  const badges = await db('badges')
    .whereIn('trigger_type', LEARNING_TRIGGERS)
    .where((w) => w.whereNull('skill_path_id').orWhereIn('skill_path_id', visiblePathIds))
    .orderBy([{ column: 'trigger_type' }, { column: 'trigger_count', order: 'asc' }, { column: 'name' }])
    .select('id', 'name', 'description', 'icon_url', 'category', 'trigger_type', 'trigger_count', 'skill_path_id')

  const mine = await db('user_badges')
    .where('user_id', userId)
    .select('badge_id', 'awarded_at', 'is_showcased', 'showcased_at')
  const mineByBadge = new Map(mine.map((m) => [m.badge_id as string, m]))

  const stats = await db('learning_stats').where('user_id', userId).first('longest_streak')
  const [{ count: unitsDone }] = await db('unit_completions').where('user_id', userId).count<{ count: string }[]>('* as count')
  const [{ count: dailyQuizzes }] = await db('daily_quiz_attempts').where('user_id', userId).count<{ count: string }[]>('* as count')

  const pathBadgeIds = badges.filter((b) => b.skill_path_id).map((b) => b.skill_path_id as string)
  const unitTotals = pathBadgeIds.length
    ? await db('skill_path_units').whereIn('path_id', pathBadgeIds).groupBy('path_id').select('path_id').count('* as n')
    : []
  const unitTotalByPath = new Map(unitTotals.map((r) => [r.path_id as string, Number(r.n)]))
  const doneInPath = pathBadgeIds.length
    ? await db('unit_completions').whereIn('path_id', pathBadgeIds).andWhere('user_id', userId).groupBy('path_id').select('path_id').count('* as n')
    : []
  const doneByPath = new Map(doneInPath.map((r) => [r.path_id as string, Number(r.n)]))

  // "Held by N% of learners": holders in this university over everyone here with a streak row.
  const [{ count: learnersRaw }] = await db('learning_stats').where('university_id', universityId).count<{ count: string }[]>('* as count')
  const learners = Math.max(1, Number(learnersRaw))
  const holders = badges.length
    ? await db('user_badges')
        .join('users', 'users.id', 'user_badges.user_id')
        .where('users.university_id', universityId)
        .whereIn('user_badges.badge_id', badges.map((b) => b.id))
        .groupBy('user_badges.badge_id')
        .select('user_badges.badge_id')
        .count('* as n')
    : []
  const holdersByBadge = new Map(holders.map((r) => [r.badge_id as string, Number(r.n)]))

  return badges.map((b) => {
    const owned = mineByBadge.get(b.id)
    let current: number
    let target: number = b.trigger_count
    switch (b.trigger_type) {
      case 'streak_milestone':
        current = stats?.longest_streak ?? 0
        break
      case 'unit_completed':
        current = Number(unitsDone)
        break
      case 'quiz_win':
        current = Number(dailyQuizzes)
        break
      default:
        current = doneByPath.get(b.skill_path_id) ?? 0
        target = unitTotalByPath.get(b.skill_path_id) ?? 0
    }
    return {
      id: b.id as string,
      name: b.name as string,
      description: (b.description as string | null) ?? null,
      iconUrl: (b.icon_url as string | null) ?? null,
      triggerType: b.trigger_type as (typeof LEARNING_TRIGGERS)[number],
      skillPathId: (b.skill_path_id as string | null) ?? null,
      pathTitle: visiblePaths.find((p) => p.id === b.skill_path_id)?.title ?? null,
      current,
      target,
      earned: Boolean(owned),
      awardedAt: owned?.awarded_at ?? null,
      pinned: Boolean(owned?.is_showcased),
      pinnedAt: owned?.showcased_at ?? null,
      heldByPct: Math.round((100 * (holdersByBadge.get(b.id) ?? 0)) / learners),
    }
  })
}

/**
 * Pins or unpins an owned badge. At most `MAX_PINNED_BADGES` stay pinned; pinning a fourth
 * drops the one pinned longest ago, so the newest choice always sticks.
 */
export async function setBadgePin(userId: string, badgeId: string, pinned: boolean) {
  await db.transaction(async (trx) => {
    const owned = await trx('user_badges').where({ user_id: userId, badge_id: badgeId }).forUpdate().first()
    if (!owned) throw notFound('Badge not owned')

    if (!pinned) {
      await trx('user_badges').where({ id: owned.id }).update({ is_showcased: false, showcased_at: null })
      return
    }
    await trx('user_badges').where({ id: owned.id }).update({ is_showcased: true, showcased_at: trx.fn.now() })

    const pins = await trx('user_badges')
      .where({ user_id: userId, is_showcased: true })
      .orderByRaw('showcased_at DESC NULLS LAST, awarded_at DESC')
      .select('id')
    const overflow = pins.slice(LEARNING.MAX_PINNED_BADGES).map((p) => p.id)
    if (overflow.length) {
      await trx('user_badges').whereIn('id', overflow).update({ is_showcased: false, showcased_at: null })
    }
  })
}
