import { db } from '../config/db'
import { logger } from '../utils/logger'
import { postLifecycleQueue } from '../queues/post-lifecycle.queue'
import { archivePostById, publishScheduledPost } from '../modules/feed/service'

// Reconciliation sweep every minute: the safety net for any delayed job dropped by a
// worker restart / redeploy. Stable jobId prevents duplicate registration on restart.
postLifecycleQueue.add(
  { type: 'sweep' },
  {
    repeat: { cron: '* * * * *' },
    jobId: 'post-lifecycle-sweep',
  },
)

postLifecycleQueue.process(async (job) => {
  const data = job.data

  // ── Reconciliation cron ───────────────────────────────────────────────────
  if (data.type === 'sweep') {
    const duePublish = await db('posts')
      .select<{ id: string }[]>('id')
      .where('is_published', false)
      .whereNotNull('publish_at')
      .whereNull('archived_at')
      .whereRaw('publish_at <= now()')
    for (const row of duePublish) await publishScheduledPost(row.id)

    const dueExpire = await db('posts')
      .select<{ id: string }[]>('id')
      .whereNull('archived_at')
      .whereNotNull('expires_at')
      .whereRaw('expires_at <= now()')
    for (const row of dueExpire) await archivePostById(row.id)

    if (duePublish.length || dueExpire.length) {
      logger.info('Post lifecycle sweep reconciled', { published: duePublish.length, archived: dueExpire.length })
    }
    return
  }

  // ── Per-post delayed jobs (precision path) ─────────────────────────────────
  if (!data.postId) return
  if (data.type === 'publish') {
    await publishScheduledPost(data.postId)
  } else if (data.type === 'expire') {
    await archivePostById(data.postId)
  } else {
    logger.warn('Unknown post lifecycle job type', { type: data.type })
  }
})

postLifecycleQueue.on('failed', (job, error) => {
  logger.error('Post lifecycle queue job failed', { jobId: job?.id, type: job?.data?.type, error })
})
