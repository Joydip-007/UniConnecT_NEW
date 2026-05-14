import { badgeQueue } from '../queues/badge.queue'
import { db } from '../config/db'
import { getIo } from '../socket'
import { logger } from '../utils/logger'

interface BadgeRow {
  id: string
  name: string
  description: string | null
  icon_url: string | null
  trigger_type: string
  trigger_count: number
  points: number
}

badgeQueue.process(async (job) => {
  const { userId, action, payload } = job.data

  const badges = await db<BadgeRow>('badges').where({ trigger_type: action })
  if (badges.length === 0) return

  const activityCount = await getActivityCount(userId, action, payload)

  for (const badge of badges) {
    if (activityCount < badge.trigger_count) continue

    const already = await db('user_badges').where({ user_id: userId, badge_id: badge.id }).first()
    if (already) continue

    await db('user_badges').insert({ user_id: userId, badge_id: badge.id })

    const io = getIo()
    io.to(`user:${userId}`).emit('badge:earned', {
      badge: {
        id: badge.id,
        name: badge.name,
        description: badge.description,
        icon_url: badge.icon_url,
        points: badge.points,
      },
    })

    logger.info('Badge awarded', { userId, badgeId: badge.id, badgeName: badge.name })
  }
})

badgeQueue.on('failed', (job, error) => {
  logger.error('Badge queue job failed', { jobId: job?.id, error })
})

async function getActivityCount(
  userId: string,
  action: string,
  payload: Record<string, unknown> | undefined,
): Promise<number> {
  switch (action) {
    case 'post_created':
      return countRows('posts', { author_id: userId, is_deleted: false })
    case 'job_applied':
      return countRows('job_applications', { applicant_id: userId })
    case 'job_posted':
      return countRows('jobs', { posted_by: userId })
    case 'follow_count':
      return countRows('follows', { follower_id: userId })
    case 'event_rsvp':
      return countRows('event_rsvps', { user_id: userId })
    case 'mentorship_accept':
      return countRows('mentorship_requests', { mentor_id: userId, status: 'accepted' })
    case 'return_login':
      return typeof payload?.eligible === 'boolean' && payload.eligible ? 1 : 0
    default:
      return 0
  }
}

async function countRows(table: string, where: Record<string, unknown>): Promise<number> {
  const [{ count }] = await db(table).where(where).count<{ count: string | number }[]>({ count: '*' })
  return Number(count)
}
