"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mentorshipService = exports.MentorshipService = exports.POINTS_PER_USD = exports.POINTS_PER_SESSION = void 0;
const db_1 = require("../../config/db");
const socket_1 = require("../../socket");
const errors_1 = require("../../utils/errors");
exports.POINTS_PER_SESSION = 10;
exports.POINTS_PER_USD = 100;
class MentorshipService {
    async listAlumni(universityId, query) {
        const base = (0, db_1.db)('users')
            .join('profiles', 'profiles.user_id', 'users.id')
            .where({
            'users.university_id': universityId,
            'users.role': 'alumni',
            'profiles.is_open_to_mentorship': true,
        });
        const [{ count }] = await base.clone().count({ count: '*' });
        const total = Number(count);
        const rows = await base
            .clone()
            .select('users.id', 'users.university_id', 'profiles.full_name', 'profiles.headline', 'profiles.department', 'profiles.batch_year', 'profiles.skills', 'profiles.avatar_url')
            .orderBy('profiles.full_name', 'asc')
            .limit(query.limit)
            .offset((query.page - 1) * query.limit);
        return {
            items: rows.map(toAlumni),
            total,
            page: query.page,
            hasMore: query.page * query.limit < total,
        };
    }
    async createRequest(context, input) {
        if (context.role !== 'student') {
            throw (0, errors_1.forbidden)('Only students can send mentorship requests', 'MENTORSHIP_STUDENT_ONLY');
        }
        // Verify alumni exists, belongs to same university, and is open to mentorship
        const alumni = await (0, db_1.db)('users')
            .join('profiles', 'profiles.user_id', 'users.id')
            .where({
            'users.id': input.alumniId,
            'users.university_id': context.universityId,
            'users.role': 'alumni',
            'profiles.is_open_to_mentorship': true,
        })
            .select('users.id', 'profiles.full_name')
            .first();
        if (!alumni)
            throw (0, errors_1.notFound)('Alumni not found or not open to mentorship', 'ALUMNI_NOT_FOUND');
        let requestId;
        try {
            const [row] = await (0, db_1.db)('mentorship_requests')
                .insert({
                university_id: context.universityId,
                student_id: context.userId,
                alumni_id: input.alumniId,
                message: input.message,
            })
                .returning('id');
            if (!row)
                throw (0, errors_1.badRequest)('Request could not be created', 'REQUEST_CREATE_FAILED');
            requestId = row.id;
        }
        catch (error) {
            if (isUniqueViolation(error)) {
                throw (0, errors_1.conflict)('A mentorship request already exists for this alumni', 'REQUEST_ALREADY_EXISTS');
            }
            throw error;
        }
        const request = await this.getRequestById(requestId);
        if (!request)
            throw (0, errors_1.notFound)('Request not found', 'REQUEST_NOT_FOUND');
        // Notify the alumni
        const studentProfile = await (0, db_1.db)('profiles')
            .where({ user_id: context.userId })
            .select('full_name')
            .first();
        (0, socket_1.getIo)()
            .to(`user:${input.alumniId}`)
            .emit('mentorship:request:new', {
            request,
            studentName: studentProfile?.full_name ?? 'A student',
        });
        return request;
    }
    async getMyRequests(universityId, studentId, query) {
        const base = (0, db_1.db)('mentorship_requests')
            .where({
            'mentorship_requests.university_id': universityId,
            'mentorship_requests.student_id': studentId,
            'mentorship_requests.is_deleted': false,
        });
        const [{ count }] = await base.clone().count({ count: '*' });
        const total = Number(count);
        const rows = await base
            .clone()
            .join('users as alumni_user', 'alumni_user.id', 'mentorship_requests.alumni_id')
            .join('profiles as alumni_profile', 'alumni_profile.user_id', 'alumni_user.id')
            .select('mentorship_requests.id', 'mentorship_requests.university_id', 'mentorship_requests.student_id', 'mentorship_requests.alumni_id', 'mentorship_requests.message', 'mentorship_requests.status', 'mentorship_requests.session_notes', 'mentorship_requests.created_at', 'mentorship_requests.updated_at', 'alumni_profile.full_name as alumni_full_name', 'alumni_profile.avatar_url as alumni_avatar_url', 'alumni_profile.headline as alumni_headline', 'alumni_profile.department as alumni_department', 'alumni_profile.batch_year as alumni_batch_year')
            .orderBy('mentorship_requests.created_at', 'desc')
            .limit(query.limit)
            .offset((query.page - 1) * query.limit);
        return {
            items: rows.map(toMyRequest),
            total,
            page: query.page,
            hasMore: query.page * query.limit < total,
        };
    }
    async getIncomingRequests(universityId, alumniId, query) {
        const base = (0, db_1.db)('mentorship_requests')
            .where({
            'mentorship_requests.university_id': universityId,
            'mentorship_requests.alumni_id': alumniId,
            'mentorship_requests.is_deleted': false,
        })
            .modify((builder) => {
            if (query.status)
                builder.andWhere('mentorship_requests.status', query.status);
        });
        const [{ count }] = await base.clone().count({ count: '*' });
        const total = Number(count);
        const rows = await base
            .clone()
            .join('users as student_user', 'student_user.id', 'mentorship_requests.student_id')
            .join('profiles as student_profile', 'student_profile.user_id', 'student_user.id')
            .select('mentorship_requests.id', 'mentorship_requests.university_id', 'mentorship_requests.student_id', 'mentorship_requests.alumni_id', 'mentorship_requests.message', 'mentorship_requests.status', 'mentorship_requests.session_notes', 'mentorship_requests.created_at', 'mentorship_requests.updated_at', 'student_profile.full_name as student_full_name', 'student_profile.avatar_url as student_avatar_url', 'student_profile.headline as student_headline', 'student_profile.department as student_department', 'student_profile.batch_year as student_batch_year')
            .orderBy('mentorship_requests.created_at', 'desc')
            .limit(query.limit)
            .offset((query.page - 1) * query.limit);
        return {
            items: rows.map(toIncomingRequest),
            total,
            page: query.page,
            hasMore: query.page * query.limit < total,
        };
    }
    async updateRequest(context, requestId, input) {
        const request = await (0, db_1.db)('mentorship_requests')
            .where({ id: requestId, university_id: context.universityId, is_deleted: false })
            .select('id', 'alumni_id', 'student_id', 'status')
            .first();
        if (!request)
            throw (0, errors_1.notFound)('Mentorship request not found', 'REQUEST_NOT_FOUND');
        // Only the alumni on the request (or admin) can update
        if (context.userId !== request.alumni_id && context.role !== 'admin') {
            throw (0, errors_1.forbidden)('You do not have permission to update this request', 'REQUEST_FORBIDDEN');
        }
        const updates = { updated_at: db_1.db.fn.now() };
        if (input.status !== undefined)
            updates.status = input.status;
        if (input.session_notes !== undefined)
            updates.session_notes = input.session_notes;
        await (0, db_1.db)('mentorship_requests')
            .where({ id: requestId, university_id: context.universityId })
            .update(updates);
        // Award points when transitioning into 'completed' (forward-only; no retroactive backfill)
        if (input.status === 'completed' &&
            request.status !== 'completed') {
            await (0, db_1.db)('profiles')
                .where({ user_id: request.alumni_id })
                .increment('mentorship_points', exports.POINTS_PER_SESSION);
        }
        return this.getRequestById(requestId);
    }
    async getMyRewards(universityId, userId) {
        const profile = await (0, db_1.db)('profiles')
            .where({ user_id: userId })
            .select('mentorship_points')
            .first();
        const points = profile?.mentorship_points ?? 0;
        const history = await (0, db_1.db)('mentor_redemptions')
            .leftJoin('gift_cards', 'gift_cards.id', 'mentor_redemptions.gift_card_id')
            .where({
            'mentor_redemptions.university_id': universityId,
            'mentor_redemptions.user_id': userId,
        })
            .orderBy('mentor_redemptions.requested_at', 'desc')
            .select('mentor_redemptions.id', 'mentor_redemptions.points_spent', 'mentor_redemptions.status', 'mentor_redemptions.code_text', 'mentor_redemptions.admin_note', 'mentor_redemptions.requested_at', 'mentor_redemptions.fulfilled_at', 'gift_cards.id as gift_card_id', 'gift_cards.vendor', 'gift_cards.title', 'gift_cards.value_usd_cents', 'gift_cards.image_url');
        return {
            points,
            pointsPerSession: exports.POINTS_PER_SESSION,
            pointsPerUsd: exports.POINTS_PER_USD,
            history: history.map(toRedemption),
        };
    }
    async listGiftCards() {
        const rows = await (0, db_1.db)('gift_cards')
            .where({ is_active: true })
            .orderBy('threshold_points', 'asc')
            .select('id', 'vendor', 'title', 'description', 'image_url', 'value_usd_cents', 'threshold_points');
        return rows.map(toGiftCard);
    }
    async redeem(context, input) {
        if (context.role !== 'alumni') {
            throw (0, errors_1.forbidden)('Only alumni can redeem mentorship rewards', 'REDEEM_ALUMNI_ONLY');
        }
        return db_1.db.transaction(async (trx) => {
            const card = await trx('gift_cards')
                .where({ id: input.giftCardId, is_active: true })
                .select('id', 'threshold_points', 'title')
                .first();
            if (!card)
                throw (0, errors_1.notFound)('Gift card not available', 'GIFT_CARD_NOT_FOUND');
            const profile = await trx('profiles')
                .where({ user_id: context.userId })
                .forUpdate()
                .select('mentorship_points', 'is_open_to_mentorship')
                .first();
            if (!profile)
                throw (0, errors_1.notFound)('Profile not found', 'PROFILE_NOT_FOUND');
            if (!profile.is_open_to_mentorship) {
                throw (0, errors_1.badRequest)('Enable mentorship to redeem rewards', 'MENTORSHIP_NOT_ENABLED');
            }
            const balance = profile.mentorship_points;
            if (balance < card.threshold_points) {
                throw (0, errors_1.badRequest)('Not enough points to redeem this card', 'INSUFFICIENT_POINTS');
            }
            await trx('profiles')
                .where({ user_id: context.userId })
                .decrement('mentorship_points', card.threshold_points);
            const [row] = await trx('mentor_redemptions')
                .insert({
                university_id: context.universityId,
                user_id: context.userId,
                gift_card_id: card.id,
                points_spent: card.threshold_points,
                status: 'pending',
            })
                .returning('id');
            if (!row)
                throw (0, errors_1.badRequest)('Redemption could not be created', 'REDEMPTION_CREATE_FAILED');
            return {
                redemptionId: row.id,
                remainingPoints: balance - card.threshold_points,
            };
        });
    }
    async getRequestById(requestId) {
        return (0, db_1.db)('mentorship_requests')
            .where('mentorship_requests.id', requestId)
            .join('users as alumni_user', 'alumni_user.id', 'mentorship_requests.alumni_id')
            .join('profiles as alumni_profile', 'alumni_profile.user_id', 'alumni_user.id')
            .join('users as student_user', 'student_user.id', 'mentorship_requests.student_id')
            .join('profiles as student_profile', 'student_profile.user_id', 'student_user.id')
            .select('mentorship_requests.id', 'mentorship_requests.university_id', 'mentorship_requests.student_id', 'mentorship_requests.alumni_id', 'mentorship_requests.message', 'mentorship_requests.status', 'mentorship_requests.session_notes', 'mentorship_requests.created_at', 'mentorship_requests.updated_at', 'alumni_profile.full_name as alumni_full_name', 'alumni_profile.avatar_url as alumni_avatar_url', 'alumni_profile.headline as alumni_headline', 'student_profile.full_name as student_full_name', 'student_profile.avatar_url as student_avatar_url', 'student_profile.department as student_department', 'student_profile.batch_year as student_batch_year')
            .first();
    }
}
exports.MentorshipService = MentorshipService;
exports.mentorshipService = new MentorshipService();
function toAlumni(row) {
    return {
        id: row.id,
        universityId: row.university_id,
        fullName: row.full_name,
        headline: row.headline,
        department: row.department,
        batchYear: row.batch_year,
        skills: row.skills ?? [],
        avatarUrl: row.avatar_url,
    };
}
function toMyRequest(row) {
    return {
        id: row.id,
        message: row.message,
        status: row.status,
        sessionNotes: row.session_notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        alumni: {
            id: row.alumni_id,
            fullName: row.alumni_full_name ?? '',
            avatarUrl: row.alumni_avatar_url ?? null,
            headline: row.alumni_headline ?? null,
            department: row.alumni_department ?? null,
            batchYear: row.alumni_batch_year ?? null,
        },
    };
}
function toIncomingRequest(row) {
    return {
        id: row.id,
        message: row.message,
        status: row.status,
        sessionNotes: row.session_notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        student: {
            id: row.student_id,
            fullName: row.student_full_name ?? '',
            avatarUrl: row.student_avatar_url ?? null,
            headline: row.student_headline ?? null,
            department: row.student_department ?? null,
            batchYear: row.student_batch_year ?? null,
        },
    };
}
function isUniqueViolation(error) {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
function toGiftCard(row) {
    return {
        id: row.id,
        vendor: row.vendor,
        title: row.title,
        description: row.description,
        imageUrl: row.image_url,
        valueUsdCents: row.value_usd_cents,
        thresholdPoints: row.threshold_points,
    };
}
function toRedemption(row) {
    return {
        id: row.id,
        pointsSpent: row.points_spent,
        status: row.status,
        codeText: row.code_text,
        adminNote: row.admin_note,
        requestedAt: row.requested_at,
        fulfilledAt: row.fulfilled_at,
        giftCard: row.gift_card_id
            ? {
                id: row.gift_card_id,
                vendor: row.vendor ?? '',
                title: row.title ?? '',
                valueUsdCents: row.value_usd_cents ?? 0,
                imageUrl: row.image_url,
            }
            : null,
    };
}
