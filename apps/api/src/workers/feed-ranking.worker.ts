import { FEED_RANKING } from '@uniconnect/shared'
import { db } from '../config/db'
import { logger } from '../utils/logger'
import { feedRankingQueue } from '../queues/feed-ranking.queue'

// Refresh hot_score every 20 minutes. Stable jobId prevents duplicate registration on restart.
feedRankingQueue.add(
  {},
  {
    repeat: { cron: '*/20 * * * *' },
    jobId: 'feed-hot-score-refresh',
  },
).catch((error) => {
  logger.error('Failed to register repeatable job', { queue: 'feed-ranking', error })
})

const WINDOW = `${FEED_RANKING.WINDOW_DAYS} days`

feedRankingQueue.process(async () => {
  logger.info('Feed ranking refresh started')

  // 1. Reconcile counter drift for the recent window (cheap, bounded row count).
  await db.raw(`
    UPDATE posts p SET
      reaction_count = COALESCE(r.cnt, 0),
      comment_count  = COALESCE(c.cnt, 0)
    FROM posts base
    LEFT JOIN (
      SELECT target_id AS post_id, COUNT(*)::int AS cnt
      FROM reactions WHERE target_type = 'post' GROUP BY target_id
    ) r ON r.post_id = base.id
    LEFT JOIN (
      SELECT post_id, COUNT(*)::int AS cnt FROM comments GROUP BY post_id
    ) c ON c.post_id = base.id
    WHERE p.id = base.id
      AND base.created_at > now() - interval '${WINDOW}'
  `)

  // 2. Recompute hot_score for the window; zero out everything older.
  const refreshed = await db.raw(
    `
    UPDATE posts
    SET hot_score = (1 + ? * reaction_count + ? * comment_count)
      / power(EXTRACT(EPOCH FROM (now() - created_at)) / 3600 + 2, ?)
    WHERE created_at > now() - interval '${WINDOW}'
  `,
    [FEED_RANKING.REACTION_WEIGHT, FEED_RANKING.COMMENT_WEIGHT, FEED_RANKING.GRAVITY],
  )

  await db.raw(
    `UPDATE posts SET hot_score = 0 WHERE hot_score <> 0 AND created_at <= now() - interval '${WINDOW}'`,
  )

  logger.info('Feed ranking refresh completed', { windowDays: FEED_RANKING.WINDOW_DAYS, rowCount: refreshed.rowCount })
})

feedRankingQueue.on('failed', (job, error) => {
  logger.error('Feed ranking queue job failed', { jobId: job?.id, error })
})
