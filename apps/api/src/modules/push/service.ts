import { db } from '../../config/db'
import { logger } from '../../utils/logger'
import { pushQueue, type PushNotificationPayload } from '../../queues/push.queue'
import type { PushSubscribeInput } from './schema'

export interface PushSubscriptionRow {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  user_agent: string | null
}

export class PushService {
  /** Idempotent on endpoint — a re-subscribe from the same device updates the keys/owner. */
  async subscribe(
    userId: string,
    universityId: string,
    input: PushSubscribeInput,
    userAgent: string | null,
  ) {
    await db('push_subscriptions')
      .insert({
        user_id: userId,
        university_id: universityId,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        user_agent: userAgent,
      })
      .onConflict('endpoint')
      .merge({
        user_id: userId,
        university_id: universityId,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        user_agent: userAgent,
        last_used_at: db.fn.now(),
      })

    return { subscribed: true }
  }

  async unsubscribe(userId: string, endpoint: string) {
    await db('push_subscriptions').where({ user_id: userId, endpoint }).delete()
    return { unsubscribed: true }
  }

  async listForUser(userId: string): Promise<PushSubscriptionRow[]> {
    return db('push_subscriptions')
      .where({ user_id: userId })
      .select<PushSubscriptionRow[]>('id', 'user_id', 'endpoint', 'p256dh', 'auth', 'user_agent')
  }

  async deleteByEndpoint(endpoint: string) {
    await db('push_subscriptions').where({ endpoint }).delete()
  }

  async touch(endpoint: string) {
    await db('push_subscriptions').where({ endpoint }).update({ last_used_at: db.fn.now() })
  }
}

export const pushService = new PushService()

/** Fire-and-forget enqueue of a push job. Never throws into the caller's path. */
export function enqueuePush(userId: string, notification: PushNotificationPayload) {
  void pushQueue
    .add({ userId, notification })
    .catch((error: unknown) => logger.warn('Failed to enqueue push notification', { error, userId }))
}
