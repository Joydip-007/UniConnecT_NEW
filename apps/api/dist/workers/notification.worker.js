"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const notification_queue_1 = require("../queues/notification.queue");
const notifications_1 = require("../modules/notifications");
const logger_1 = require("../utils/logger");
notification_queue_1.notificationQueue.process(async (job) => {
    const data = job.data;
    const actorId = data.actorId ?? readString(data.payload.actorId) ?? readString(data.payload.senderId) ?? null;
    const referenceId = data.referenceId ?? readString(data.payload.referenceId) ?? readString(data.payload.messageId) ?? null;
    const referenceType = data.referenceType ?? readString(data.payload.referenceType) ?? inferReferenceType(data.type);
    const content = data.content ?? (await buildContent(data.type, actorId, data.payload));
    await notifications_1.notificationsService.createNotification({
        userId: data.userId,
        type: data.type,
        actorId,
        referenceId,
        referenceType,
        content,
    });
});
notification_queue_1.notificationQueue.on('failed', (job, error) => {
    logger_1.logger.error('Notification queue job failed', { jobId: job?.id, error });
});
async function buildContent(type, actorId, payload) {
    const actorName = actorId ? await getActorName(actorId) : 'Someone';
    const preview = readString(payload.preview);
    if (type === 'message:new') {
        return preview ? `${actorName}: ${preview}` : `${actorName} sent you a message`;
    }
    return preview ? `${actorName}: ${preview}` : `${actorName} sent you a notification`;
}
async function getActorName(actorId) {
    return notifications_1.notificationsService.getActorName(actorId);
}
function inferReferenceType(type) {
    if (type.startsWith('message'))
        return 'message';
    if (type.startsWith('job'))
        return 'job';
    if (type.startsWith('event'))
        return 'event';
    if (type.startsWith('post') || type === 'like' || type === 'comment')
        return 'post';
    if (type === 'follow')
        return 'user';
    return null;
}
function readString(value) {
    return typeof value === 'string' && value ? value : null;
}
