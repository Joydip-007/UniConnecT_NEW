import { notificationQueue } from '../queues/notification.queue'
import { notificationsService } from '../modules/notifications'
import { logger } from '../utils/logger'

notificationQueue.process(async (job) => {
  const data = job.data
  const actorId = data.actorId ?? readString(data.payload.actorId) ?? readString(data.payload.senderId) ?? null
  const referenceId = data.referenceId ?? readString(data.payload.referenceId) ?? readString(data.payload.messageId) ?? null
  const referenceType = data.referenceType ?? readString(data.payload.referenceType) ?? inferReferenceType(data.type)
  const content = data.content ?? (await buildContent(data.type, actorId, data.payload))

  await notificationsService.createNotification({
    userId: data.userId,
    type: data.type,
    actorId,
    referenceId,
    referenceType,
    content,
  })
})

notificationQueue.on('failed', (job, error) => {
  logger.error('Notification queue job failed', { jobId: job?.id, error })
})

async function buildContent(type: string, actorId: string | null, payload: Record<string, unknown>) {
  const actorName = actorId ? await getActorName(actorId) : 'Someone'
  const preview = readString(payload.preview)

  if (type === 'message:new') {
    return preview ? `${actorName}: ${preview}` : `${actorName} sent you a message`
  }

  return preview ? `${actorName}: ${preview}` : `${actorName} sent you a notification`
}

async function getActorName(actorId: string) {
  return notificationsService.getActorName(actorId)
}

function inferReferenceType(type: string) {
  if (type.startsWith('message')) return 'message'
  if (type.startsWith('job')) return 'job'
  if (type.startsWith('event')) return 'event'
  if (type.startsWith('post') || type === 'like' || type === 'comment') return 'post'
  if (type === 'follow') return 'user'
  return null
}

function readString(value: unknown) {
  return typeof value === 'string' && value ? value : null
}
