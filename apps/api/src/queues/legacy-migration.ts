import Queue from 'bull'
import { bullQueueOptions, type LogicalQueue } from '../config/bull'
import { watchRedisClient } from '../config/redis-errors'
import { logger } from '../utils/logger'
import { aiContentQueue } from './ai-content.queue'
import { badgeQueue } from './badge.queue'
import { contentSyncQueue } from './content-sync.queue'
import { emailQueue } from './email.queue'
import { feedRankingQueue } from './feed-ranking.queue'
import { groupDigestQueue } from './group-digest.queue'
import { learningQueue } from './learning.queue'
import { mentorshipQueue } from './mentorship.queue'
import { notificationDigestQueue } from './notification-digest.queue'
import { notificationQueue } from './notification.queue'
import { postLifecycleQueue } from './post-lifecycle.queue'
import { pushQueue } from './push.queue'

const ALL_QUEUES: LogicalQueue[] = [
  aiContentQueue,
  badgeQueue,
  contentSyncQueue,
  emailQueue,
  feedRankingQueue,
  groupDigestQueue,
  learningQueue,
  mentorshipQueue,
  notificationDigestQueue,
  notificationQueue,
  postLifecycleQueue,
  pushQueue,
] as LogicalQueue[]

export interface LegacyMigrationResult {
  queue: string
  moved: number
  repeatablesRemoved: number
  obliterated: boolean
}

/**
 * Before 2026-09-30 every job type had its own Bull queue (Redis keys `bull:{name}:*`).
 * They now ride two lanes (see QUEUE_LANES), so jobs already sitting in an old queue
 * would never run: a mentorship expiry scheduled 7 days out, or a scheduled post's
 * publish job. This moves waiting and delayed jobs to their new lane with the time
 * they had left, drops the old repeatable schedules (the workers re-register them on
 * the lane), then deletes the old queue's keys.
 *
 * Idempotent: a job re-added under the same jobId is not duplicated, and an emptied
 * queue is skipped on the next start. An old queue that still has an active job (the
 * previous instance is mid-job during a rolling restart) is left in place and retried
 * on the next start.
 *
 * Never call `close()` on these queues: they use the shared Bull clients, and closing
 * would disconnect them for every lane.
 */
export async function migrateLegacyQueues(targets: LogicalQueue[] = ALL_QUEUES): Promise<LegacyMigrationResult[]> {
  const results: LegacyMigrationResult[] = []
  for (const target of targets) {
    try {
      results.push(await migrateOne(target))
    } catch (error) {
      logger.error('Legacy queue migration failed', { queue: target.name, error })
    }
  }
  return results
}

async function migrateOne(target: LogicalQueue): Promise<LegacyMigrationResult> {
  const legacy = new Queue(target.name, bullQueueOptions)
  watchRedisClient(legacy, `legacy:${target.name}`)
  const result: LegacyMigrationResult = { queue: target.name, moved: 0, repeatablesRemoved: 0, obliterated: false }

  const counts = await legacy.getJobCounts()
  const repeatables = await legacy.getRepeatableJobs()
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0)
  if (total === 0 && repeatables.length === 0) return result

  for (const repeatable of repeatables) {
    await legacy.removeRepeatableByKey(repeatable.key)
    result.repeatablesRemoved += 1
  }

  const jobs = await legacy.getJobs(['waiting', 'delayed', 'paused'])
  for (const job of jobs) {
    if (!job) continue
    // The pending instance of a repeatable schedule: the worker re-registers the
    // schedule on the lane, so moving this one would run it twice.
    if (String(job.id).startsWith('repeat:')) {
      await job.remove()
      continue
    }
    const remainingDelay = job.timestamp + (job.opts.delay ?? 0) - Date.now()
    await target.add(job.data, {
      ...(job.opts.jobId !== undefined && { jobId: job.opts.jobId }),
      ...(job.opts.attempts !== undefined && { attempts: job.opts.attempts }),
      ...(job.opts.backoff !== undefined && { backoff: job.opts.backoff }),
      ...(remainingDelay > 0 && { delay: remainingDelay }),
    })
    await job.remove()
    result.moved += 1
  }

  const after = await legacy.getJobCounts()
  if (after.active === 0) {
    await legacy.obliterate({ force: true })
    result.obliterated = true
  }

  logger.info('Migrated legacy Bull queue', { ...result })
  return result
}
