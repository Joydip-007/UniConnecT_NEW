import type { UserRole } from '@uniconnect/shared'
import { db } from '../../config/db'
import { getIo } from '../../socket'
import { notFound } from '../../utils/errors'
import type { NotificationListQuery } from './schema'

interface CountRow {
  count: string | number
}

interface CreateNotificationInput {
  userId: string
  type: string
  actorId?: string | null
  referenceId?: string | null
  referenceType?: string | null
  content: string
}

interface NotificationRow {
  id: string
  user_id: string
  type: string
  actor_id: string | null
  reference_id: string | null
  reference_type: string | null
  content: string
  is_read: boolean
  created_at: Date
  actor_full_name: string | null
  actor_avatar_url: string | null
  actor_headline: string | null
}

export class NotificationsService {
  async listNotifications(userId: string, query: NotificationListQuery) {
    const countQuery = db('notifications').where({ user_id: userId })
    if (query.isRead !== undefined) countQuery.andWhere('is_read', query.isRead)

    const [{ count }] = await countQuery.count<CountRow[]>({ count: '*' })
    const total = Number(count)

    const rows = (await notificationSelectQuery()
      .where('notifications.user_id', userId)
      .modify((builder) => {
        if (query.isRead !== undefined) builder.andWhere('notifications.is_read', query.isRead)
      })
      .orderBy('notifications.created_at', 'desc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)) as NotificationRow[]

    const [{ count: unreadCount }] = await db('notifications')
      .where({ user_id: userId, is_read: false })
      .count<CountRow[]>({ count: '*' })

    return {
      items: rows.map(toNotification),
      total,
      page: query.page,
      limit: query.limit,
      unreadCount: Number(unreadCount),
    }
  }

  async createNotification(input: CreateNotificationInput) {
    const [row] = await db('notifications')
      .insert({
        user_id: input.userId,
        type: input.type,
        actor_id: input.actorId ?? null,
        reference_id: input.referenceId ?? null,
        reference_type: input.referenceType ?? null,
        content: input.content,
      })
      .returning<{ id: string }[]>('id')

    if (!row) throw notFound('Notification not found', 'NOTIFICATION_NOT_FOUND')

    const notification = await this.getNotification(input.userId, row.id)
    getIo().to(`user:${input.userId}`).emit('notification:new', { notification })
    getIo().to(`user:${input.userId}`).emit('notification:new:legacy', notification)
    return notification
  }

  async markRead(userId: string, notificationId: string) {
    const updated = await db('notifications')
      .where({ id: notificationId, user_id: userId })
      .update({ is_read: true })

    if (updated === 0) throw notFound('Notification not found', 'NOTIFICATION_NOT_FOUND')

    getIo().to(`user:${userId}`).emit('notification:read', { notificationId })
    return { read: true }
  }

  async markAllRead(userId: string) {
    await db('notifications').where({ user_id: userId, is_read: false }).update({ is_read: true })
    getIo().to(`user:${userId}`).emit('notification:read-all', {})
    return { read: true }
  }

  async deleteNotification(userId: string, notificationId: string) {
    const deleted = await db('notifications').where({ id: notificationId, user_id: userId }).delete()
    if (deleted === 0) throw notFound('Notification not found', 'NOTIFICATION_NOT_FOUND')
    getIo().to(`user:${userId}`).emit('notification:deleted', { notificationId })
    return { deleted: true }
  }

  async acceptGroupInvite(
    userId: string,
    universityId: string,
    userRole: UserRole,
    notificationId: string,
  ) {
    const notification = await db('notifications')
      .where({ id: notificationId, user_id: userId, type: 'group_invite' })
      .select<{ id: string; reference_id: string | null }[]>('id', 'reference_id')
      .first()
    if (!notification || !notification.reference_id) {
      throw notFound('Group invitation not found', 'GROUP_INVITE_NOT_FOUND')
    }

    const { groupsService } = await import('../groups/service')
    const group = await groupsService.joinGroupViaInvite(
      { userId, universityId, role: userRole },
      notification.reference_id,
    )

    await db('notifications').where({ id: notificationId, user_id: userId }).update({ is_read: true })
    getIo().to(`user:${userId}`).emit('notification:read', { notificationId })

    return { group, notificationId }
  }

  async getActorName(actorId: string): Promise<string> {
    const row = await db('profiles')
      .select<{ full_name: string }>('full_name')
      .where({ user_id: actorId })
      .first()
    return row?.full_name ?? 'Someone'
  }

  private async getNotification(userId: string, notificationId: string) {
    const row = await notificationSelectQuery()
      .where({ 'notifications.id': notificationId, 'notifications.user_id': userId })
      .first<NotificationRow>()

    if (!row) throw notFound('Notification not found', 'NOTIFICATION_NOT_FOUND')
    return toNotification(row)
  }
}

export const notificationsService = new NotificationsService()

function notificationSelectQuery() {
  return db('notifications')
    .leftJoin('profiles as actor_profile', 'actor_profile.user_id', 'notifications.actor_id')
    .select<NotificationRow[]>(
      'notifications.id',
      'notifications.user_id',
      'notifications.type',
      'notifications.actor_id',
      'notifications.reference_id',
      'notifications.reference_type',
      'notifications.content',
      'notifications.is_read',
      'notifications.created_at',
      'actor_profile.full_name as actor_full_name',
      'actor_profile.avatar_url as actor_avatar_url',
      'actor_profile.headline as actor_headline',
    )
}

function toNotification(row: NotificationRow) {
  let refUrl: string | null = null
  if (row.type === 'group_invite') {
    refUrl = '/notifications'
  } else if (row.reference_type === 'group' && row.reference_id) {
    refUrl = `/groups/${row.reference_id}`
  } else if (row.reference_type === 'event' && row.reference_id) {
    refUrl = `/events/${row.reference_id}`
  } else if (row.reference_type === 'job' && row.reference_id) {
    refUrl = `/jobs/${row.reference_id}`
  } else if (row.reference_type === 'post' && row.reference_id) {
    refUrl = `/feed`
  }

  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    actorId: row.actor_id,
    referenceId: row.reference_id,
    referenceType: row.reference_type,
    content: row.content,
    isRead: row.is_read,
    createdAt: row.created_at,
    refUrl,
    actor: row.actor_id
      ? {
          id: row.actor_id,
          fullName: row.actor_full_name,
          avatarUrl: row.actor_avatar_url,
          headline: row.actor_headline,
        }
      : null,
  }
}
