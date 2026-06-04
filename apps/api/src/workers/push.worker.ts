import webpush from 'web-push'
import { env } from '../config/env'
import { pushQueue } from '../queues/push.queue'
import { pushService } from '../modules/push/service'
import { logger } from '../utils/logger'

const vapidConfigured = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY)

if (vapidConfigured) {
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!)
} else {
  logger.warn('VAPID keys not configured — push notifications will be skipped')
}

pushQueue.process(async (job) => {
  if (!vapidConfigured) return

  const { userId, notification } = job.data
  const subscriptions = await pushService.listForUser(userId)
  if (subscriptions.length === 0) return

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    url: notification.url ?? '/notifications',
    icon: notification.icon ?? '/favicon.svg',
  })

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        )
        await pushService.touch(sub.endpoint)
      } catch (error: unknown) {
        const statusCode = (error as { statusCode?: number }).statusCode
        if (statusCode === 404 || statusCode === 410) {
          // Subscription is dead/expired — prune it.
          await pushService.deleteByEndpoint(sub.endpoint)
        } else {
          logger.warn('Push send failed', { endpoint: sub.endpoint, statusCode, error })
        }
      }
    }),
  )
})

pushQueue.on('failed', (job, error) => {
  logger.error('Push queue job failed', { jobId: job?.id, error })
})
