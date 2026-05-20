"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
    async deleteNotification(userId, notificationId) {
        const deleted = await (0, db_1.db)('notifications').where({ id: notificationId, user_id: userId }).delete();
        if (deleted === 0)
            throw (0, errors_1.notFound)('Notification not found', 'NOTIFICATION_NOT_FOUND');
        (0, socket_1.getIo)().to(`user:${userId}`).emit('notification:deleted', { notificationId });
        return { deleted: true };
    }
    async acceptGroupInvite(userId, universityId, userRole, notificationId) {
        const notification = await (0, db_1.db)('notifications')
            .where({ id: notificationId, user_id: userId, type: 'group_invite' })
            .select('id', 'reference_id')
            .first();
        if (!notification || !notification.reference_id) {
            throw (0, errors_1.notFound)('Group invitation not found', 'GROUP_INVITE_NOT_FOUND');
        }
        const { groupsService } = await Promise.resolve().then(() => __importStar(require('../groups/service')));
        const group = await groupsService.joinGroupViaInvite({ userId, universityId, role: userRole }, notification.reference_id);
        await (0, db_1.db)('notifications').where({ id: notificationId, user_id: userId }).update({ is_read: true });
        (0, socket_1.getIo)().to(`user:${userId}`).emit('notification:read', { notificationId });
        return { group, notificationId };
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
