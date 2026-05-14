"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationsService = exports.NotificationsService = void 0;
const db_1 = require("../../config/db");
const socket_1 = require("../../socket");
const errors_1 = require("../../utils/errors");
class NotificationsService {
    async listNotifications(userId, query) {
        const countQuery = (0, db_1.db)('notifications').where({ user_id: userId });
        if (query.isRead !== undefined)
            countQuery.andWhere('is_read', query.isRead);
        const [{ count }] = await countQuery.count({ count: '*' });
        const total = Number(count);
        const rows = (await notificationSelectQuery()
            .where('notifications.user_id', userId)
            .modify((builder) => {
            if (query.isRead !== undefined)
                builder.andWhere('notifications.is_read', query.isRead);
        })
            .orderBy('notifications.created_at', 'desc')
            .limit(query.limit)
            .offset((query.page - 1) * query.limit));
        const [{ count: unreadCount }] = await (0, db_1.db)('notifications')
            .where({ user_id: userId, is_read: false })
            .count({ count: '*' });
        return {
            items: rows.map(toNotification),
            total,
            page: query.page,
            limit: query.limit,
            unreadCount: Number(unreadCount),
        };
    }
    async createNotification(input) {
        const [row] = await (0, db_1.db)('notifications')
            .insert({
            user_id: input.userId,
            type: input.type,
            actor_id: input.actorId ?? null,
            reference_id: input.referenceId ?? null,
            reference_type: input.referenceType ?? null,
            content: input.content,
        })
            .returning('id');
        if (!row)
            throw (0, errors_1.notFound)('Notification not found', 'NOTIFICATION_NOT_FOUND');
        const notification = await this.getNotification(input.userId, row.id);
        (0, socket_1.getIo)().to(`user:${input.userId}`).emit('notification:new', { notification });
        (0, socket_1.getIo)().to(`user:${input.userId}`).emit('notification:new:legacy', notification);
        return notification;
    }
    async markRead(userId, notificationId) {
        const updated = await (0, db_1.db)('notifications')
            .where({ id: notificationId, user_id: userId })
            .update({ is_read: true });
        if (updated === 0)
            throw (0, errors_1.notFound)('Notification not found', 'NOTIFICATION_NOT_FOUND');
        (0, socket_1.getIo)().to(`user:${userId}`).emit('notification:read', { notificationId });
        return { read: true };
    }
    async markAllRead(userId) {
        await (0, db_1.db)('notifications').where({ user_id: userId, is_read: false }).update({ is_read: true });
        (0, socket_1.getIo)().to(`user:${userId}`).emit('notification:read-all', {});
        return { read: true };
    }
    async getActorName(actorId) {
        const row = await (0, db_1.db)('profiles')
            .select('full_name')
            .where({ user_id: actorId })
            .first();
        return row?.full_name ?? 'Someone';
    }
    async getNotification(userId, notificationId) {
        const row = await notificationSelectQuery()
            .where({ 'notifications.id': notificationId, 'notifications.user_id': userId })
            .first();
        if (!row)
            throw (0, errors_1.notFound)('Notification not found', 'NOTIFICATION_NOT_FOUND');
        return toNotification(row);
    }
}
exports.NotificationsService = NotificationsService;
exports.notificationsService = new NotificationsService();
function notificationSelectQuery() {
    return (0, db_1.db)('notifications')
        .leftJoin('profiles as actor_profile', 'actor_profile.user_id', 'notifications.actor_id')
        .select('notifications.id', 'notifications.user_id', 'notifications.type', 'notifications.actor_id', 'notifications.reference_id', 'notifications.reference_type', 'notifications.content', 'notifications.is_read', 'notifications.created_at', 'actor_profile.full_name as actor_full_name', 'actor_profile.avatar_url as actor_avatar_url', 'actor_profile.headline as actor_headline');
}
function toNotification(row) {
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
        actor: row.actor_id
            ? {
                id: row.actor_id,
                fullName: row.actor_full_name,
                avatarUrl: row.actor_avatar_url,
                headline: row.actor_headline,
            }
            : null,
    };
}
