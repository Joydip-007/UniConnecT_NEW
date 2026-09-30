import { db } from '../config/db'
import { logger } from '../utils/logger'
import { groupDigestQueue } from '../queues/group-digest.queue'
import { notificationQueue } from '../queues/notification.queue'

// Register the repeatable weekly job: Monday 03:00 UTC (= Monday 09:00 BDT)
groupDigestQueue.add(
  {},
  {
    repeat: { cron: '0 3 * * 1' },
    jobId: 'group-weekly-digest', // stable ID prevents duplicate registration on restart
  },
).catch((error) => {
  logger.error('Failed to register repeatable job', { queue: 'group-digest', error })
})

groupDigestQueue.process(async () => {
  logger.info('Group weekly digest job started')

  // 1. Get all active (non-system) universities that have groups
  const universities = await db('groups')
    .distinct('university_id')
    .where({ is_system: false })
    .select<{ university_id: string }[]>('university_id')

  let totalGroupsProcessed = 0
  let totalNotificationsEnqueued = 0

  for (const { university_id } of universities) {
    // 2. Get all non-system groups for this university
    const groups = await db('groups')
      .where({ university_id, is_system: false })
      .select<{ id: string; name: string }[]>('id', 'name')

    for (const group of groups) {
      // 3. Top-5 posts by engagement (reactions + comments) in last 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

      const topPosts = await db('posts')
        .where({ 'posts.group_id': group.id })
        .andWhere('posts.created_at', '>=', sevenDaysAgo)
        .leftJoin('reactions', function () {
          this.on('reactions.target_id', '=', 'posts.id').andOn(
            db.raw("reactions.target_type = 'post'"),
          )
        })
        .leftJoin('comments', 'comments.post_id', 'posts.id')
        .groupBy('posts.id')
        .orderByRaw('COUNT(DISTINCT reactions.id) + COUNT(DISTINCT comments.id) DESC')
        .limit(5)
        .select<{ id: string }[]>('posts.id')

      // 4. Skip groups with no posts this week
      if (topPosts.length === 0) continue

      const postIds = topPosts.map((p) => p.id)

      // 5. Get all members of this group
      const members = await db('group_members')
        .where({ group_id: group.id })
        .select<{ user_id: string }[]>('user_id')

      // 6. Enqueue one notification per member
      for (const { user_id } of members) {
        await notificationQueue.add({
          universityId: university_id,
          userId: user_id,
          type: 'group_weekly_digest',
          referenceId: group.id,
          referenceType: 'group',
          content: `Top posts this week in "${group.name}"`,
          payload: { groupId: group.id, postIds },
        })
        totalNotificationsEnqueued++
      }

      totalGroupsProcessed++
    }
  }

  logger.info('Group weekly digest job completed', {
    totalGroupsProcessed,
    totalNotificationsEnqueued,
  })
})

groupDigestQueue.on('failed', (job, error) => {
  logger.error('Group digest queue job failed', { jobId: job?.id, error })
})
