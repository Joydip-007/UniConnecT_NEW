import { LEARNING } from '@uniconnect/shared'
import { db } from '../config/db'
import { logger } from '../utils/logger'
import { learningQueue } from '../queues/learning.queue'
import { pushQueue } from '../queues/push.queue'
import {
  addDays,
  applySweep,
  localDateString,
  localHour,
  normalizePgDate,
  type StreakStats,
} from '../modules/learning/streak'

// Hourly at :10 — each run only acts on universities whose local hour matches.
// Stable jobId prevents duplicate registration on restart.
learningQueue
  .add({}, { repeat: { cron: '10 * * * *' }, jobId: 'learning-hourly' })
  .catch((error) => {
    logger.error('Failed to register repeatable job', { queue: 'learning', error })
  })

interface StatsRow {
  user_id: string
  university_id: string
  current_streak: number
  longest_streak: number
  last_activity_date: string | Date | null
  freezes_used_month: string | null
  freezes_used_count: number
  last_reminder_date: string | Date | null
}

function toStats(row: StatsRow): StreakStats {
  return {
    currentStreak: row.current_streak,
    longestStreak: row.longest_streak,
    lastActivityDate: normalizePgDate(row.last_activity_date),
    freezesUsedMonth: row.freezes_used_month,
    freezesUsedCount: row.freezes_used_count,
  }
}

export async function runLearningSweep(now: Date): Promise<void> {
  const universities = await db('universities').where({ is_active: true }).select('id', 'timezone')

  for (const uni of universities) {
    const hour = localHour(now, uni.timezone)
    const today = localDateString(now, uni.timezone)

    if (hour === 0) {
      // Midnight sweep: consume freezes / reset streaks for users who missed yesterday.
      const rows: StatsRow[] = await db('learning_stats')
        .where({ university_id: uni.id })
        .where('current_streak', '>', 0)
        .where('last_activity_date', '<', addDays(today, -1))
      for (const row of rows) {
        const result = applySweep(toStats(row), today)
        if (result.action === 'none') continue
        await db('learning_stats')
          .where({ user_id: row.user_id })
          .update({
            current_streak: result.stats.currentStreak,
            last_activity_date: result.stats.lastActivityDate,
            freezes_used_month: result.stats.freezesUsedMonth,
            freezes_used_count: result.stats.freezesUsedCount,
            updated_at: db.fn.now(),
          })
        logger.info('Streak sweep applied', { userId: row.user_id, action: result.action })
      }
    }

    if (hour === LEARNING.REMINDER_LOCAL_HOUR) {
      // Gentle reminder: active enrollment, live streak, nothing completed today, max one per day.
      const rows: StatsRow[] = await db('learning_stats')
        .where({ 'learning_stats.university_id': uni.id })
        .where('current_streak', '>', 0)
        .where((qb) => qb.whereNull('last_activity_date').orWhere('last_activity_date', '<', today))
        .where((qb) => qb.whereNull('last_reminder_date').orWhere('last_reminder_date', '<', today))
        .whereExists(
          db('skill_path_enrollments')
            .whereRaw('skill_path_enrollments.user_id = learning_stats.user_id')
            .where('status', 'active'),
        )
      for (const row of rows) {
        await pushQueue.add({
          userId: row.user_id,
          notification: {
            title: 'Keep your streak going',
            body: `You're on a ${row.current_streak}-day streak — one unit keeps it alive.`,
            url: '/learn',
          },
        })
        await db('learning_stats')
          .where({ user_id: row.user_id })
          .update({ last_reminder_date: today, updated_at: db.fn.now() })
      }
      if (rows.length > 0) logger.info('Streak reminders enqueued', { universityId: uni.id, count: rows.length })
    }
  }
}

learningQueue.process(async () => {
  await runLearningSweep(new Date())
})

learningQueue.on('failed', (job, error) => {
  logger.error('Learning queue job failed', { jobId: job?.id, error })
})
