"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const badge_queue_1 = require("../queues/badge.queue");
const db_1 = require("../config/db");
const socket_1 = require("../socket");
const logger_1 = require("../utils/logger");
badge_queue_1.badgeQueue.process(async (job) => {
    const { userId, action, payload } = job.data;
    const badges = await (0, db_1.db)('badges').where({ trigger_type: action });
    if (badges.length === 0)
        return;
    const activityCount = await getActivityCount(userId, action, payload);
    for (const badge of badges) {
        if (activityCount < badge.trigger_count)
            continue;
        const already = await (0, db_1.db)('user_badges').where({ user_id: userId, badge_id: badge.id }).first();
        if (already)
            continue;
        await (0, db_1.db)('user_badges').insert({ user_id: userId, badge_id: badge.id });
        const io = (0, socket_1.getIo)();
        io.to(`user:${userId}`).emit('badge:earned', {
            badge: {
                id: badge.id,
                name: badge.name,
                description: badge.description,
                icon_url: badge.icon_url,
                points: badge.points,
            },
        });
        logger_1.logger.info('Badge awarded', { userId, badgeId: badge.id, badgeName: badge.name });
    }
});
badge_queue_1.badgeQueue.on('failed', (job, error) => {
    logger_1.logger.error('Badge queue job failed', { jobId: job?.id, error });
});
async function getActivityCount(userId, action, payload) {
    switch (action) {
        case 'post_created':
            return countRows('posts', { author_id: userId, is_deleted: false });
        case 'job_applied':
            return countRows('job_applications', { applicant_id: userId });
        case 'job_posted':
            return countRows('jobs', { posted_by: userId });
        case 'follow_count':
            return countRows('follows', { follower_id: userId });
        case 'event_rsvp':
            return countRows('event_rsvps', { user_id: userId });
        case 'mentorship_accept':
            return countRows('mentorship_requests', { mentor_id: userId, status: 'accepted' });
        case 'return_login':
            return typeof payload?.eligible === 'boolean' && payload.eligible ? 1 : 0;
        default:
            return 0;
    }
}
async function countRows(table, where) {
    const [{ count }] = await (0, db_1.db)(table).where(where).count({ count: '*' });
    return Number(count);
}
