"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminService = exports.AdminService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const db_1 = require("../../config/db");
const errors_1 = require("../../utils/errors");
const email_queue_1 = require("../../queues/email.queue");
const env_1 = require("../../config/env");
const socket_1 = require("../../socket");
const system_groups_service_1 = require("../groups/system-groups.service");
class AdminService {
    async getStats(universityId) {
        const [users, posts, jobs, events, groups, news, reports] = await Promise.all([
            countWhere('users', { university_id: universityId }),
            countWhere('posts', { university_id: universityId }),
            countWhere('jobs', { university_id: universityId }),
            countWhere('events', { university_id: universityId }),
            countWhere('groups', { university_id: universityId }),
            countWhere('news', { university_id: universityId }),
            (0, db_1.db)('reports')
                .whereIn('reporter_id', (0, db_1.db)('users').where('university_id', universityId).select('id'))
                .where('status', 'pending')
                .count({ count: '*' })
                .first()
                .then((r) => Number(r?.count ?? 0)),
        ]);
        const activeUsers = await countActive(universityId);
        return { users, posts, jobs, events, groups, news, reports, activeUsers };
    }
    async listUsers(universityId, query) {
        const baseQuery = (0, db_1.db)('users')
            .join('profiles', 'profiles.user_id', 'users.id')
            .where('users.university_id', universityId)
            .where('users.is_deleted', false)
            .select('users.id', 'users.university_id', 'users.email', 'users.role', 'users.is_verified', 'users.is_active', 'users.last_active_at', 'users.created_at', 'profiles.full_name', 'profiles.avatar_url', 'profiles.department', 'profiles.batch_year');
        const [{ count }] = await (0, db_1.db)('users')
            .where({ university_id: universityId, is_deleted: false })
            .count({ count: '*' });
        const rows = await baseQuery
            .orderBy('users.created_at', 'desc')
            .limit(query.limit)
            .offset((query.page - 1) * query.limit);
        return {
            items: rows.map(toAdminUser),
            total: Number(count),
            page: query.page,
            limit: query.limit,
        };
    }
    async updateUserRole(universityId, userId, input) {
        const previous = await (0, db_1.db)('users')
            .join('profiles', 'profiles.user_id', 'users.id')
            .where({ 'users.id': userId, 'users.university_id': universityId })
            .select('users.role', 'profiles.department')
            .first();
        if (!previous)
            throw (0, errors_1.notFound)('User not found');
        const updated = await (0, db_1.db)('users')
            .where({ id: userId, university_id: universityId })
            .update({ role: input.role });
        if (updated === 0)
            throw (0, errors_1.notFound)('User not found');
        await system_groups_service_1.systemGroupsService.syncUserMembership(userId, universityId, { role: previous.role, department: previous.department }, { role: input.role, department: previous.department });
        return { userId, role: input.role };
    }
    async deleteUser(universityId, adminUserId, userId) {
        if (userId === adminUserId)
            throw (0, errors_1.badRequest)('You cannot delete your own account', 'SELF_ACTION');
        const user = await (0, db_1.db)('users')
            .join('profiles', 'profiles.user_id', 'users.id')
            .where({ 'users.id': userId, 'users.university_id': universityId, 'users.is_deleted': false })
            .select('users.role', 'profiles.department')
            .first();
        if (!user)
            throw (0, errors_1.notFound)('User not found');
        await (0, db_1.db)('users')
            .where({ id: userId, university_id: universityId })
            .update({ is_deleted: true, is_active: false });
        await (0, db_1.db)('user_sessions').where({ user_id: userId }).delete();
        await system_groups_service_1.systemGroupsService.removeUserFromSystemGroups(userId, universityId, user.role, user.department);
        return { userId, deleted: true };
    }
    async updateUserStatus(universityId, userId, input) {
        const previous = await (0, db_1.db)('users')
            .join('profiles', 'profiles.user_id', 'users.id')
            .where({ 'users.id': userId, 'users.university_id': universityId })
            .select('users.role', 'profiles.department')
            .first();
        if (!previous)
            throw (0, errors_1.notFound)('User not found');
        const updated = await (0, db_1.db)('users')
            .where({ id: userId, university_id: universityId })
            .update({ is_active: input.is_active });
        if (updated === 0)
            throw (0, errors_1.notFound)('User not found');
        if (!input.is_active) {
            await system_groups_service_1.systemGroupsService.removeUserFromSystemGroups(userId, universityId, previous.role, previous.department);
        }
        else {
            await system_groups_service_1.systemGroupsService.addUserToSystemGroups(userId, universityId, previous.role, previous.department);
        }
        return { userId, isActive: input.is_active };
    }
    async listReports(universityId, query) {
        const subQuery = (0, db_1.db)('users')
            .where('university_id', universityId)
            .select('id');
        const baseQuery = (0, db_1.db)('reports')
            .join('profiles as reporter_profile', 'reporter_profile.user_id', 'reports.reporter_id')
            .whereIn('reports.reporter_id', subQuery)
            .select('reports.id', 'reports.reporter_id', 'reports.target_id', 'reports.target_type', 'reports.reason', 'reports.description', 'reports.status', 'reports.resolved_by', 'reports.created_at', 'reports.resolved_at', 'reporter_profile.full_name as reporter_full_name');
        const [{ count }] = await (0, db_1.db)('reports')
            .whereIn('reporter_id', subQuery)
            .count({ count: '*' });
        const rows = await baseQuery
            .orderBy('reports.created_at', 'desc')
            .limit(query.limit)
            .offset((query.page - 1) * query.limit);
        return {
            items: rows.map(toReport),
            total: Number(count),
            page: query.page,
            limit: query.limit,
        };
    }
    async resolveReport(universityId, resolvedById, reportId, input) {
        const universityUserIds = (0, db_1.db)('users').where('university_id', universityId).select('id');
        const updated = await (0, db_1.db)('reports')
            .where({ id: reportId })
            .whereIn('reporter_id', universityUserIds)
            .update({
            status: input.status,
            resolved_by: resolvedById,
            resolved_at: db_1.db.fn.now(),
        });
        if (updated === 0)
            throw (0, errors_1.notFound)('Report not found');
        return { reportId, status: input.status };
    }
    async createInvitation(universityId, invitedById, input, universityName) {
        const token = node_crypto_1.default.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + input.expires_in_days);
        const [row] = await (0, db_1.db)('invitations')
            .insert({
            university_id: universityId,
            invited_by: invitedById,
            email: input.email,
            role: input.role,
            token,
            expires_at: expiresAt,
        })
            .returning('*');
        const registerUrl = `${env_1.env.WEB_URL}/register/${token}`;
        void email_queue_1.emailQueue.add({
            to: input.email,
            subject: "You're invited to join UniConnecT",
            text: JSON.stringify({
                template: 'invitation',
                userName: '',
                registerUrl,
                role: input.role,
                universityName,
                token,
            }),
        });
        return toInvitation(row);
    }
    async createBulkInvitations(universityId, invitedById, input, universityName) {
        const unique = [...new Set(input.emails.map((e) => e.toLowerCase().trim()))];
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + input.expires_in_days);
        const rows = unique.map((email) => ({
            university_id: universityId,
            invited_by: invitedById,
            email,
            role: input.role,
            token: node_crypto_1.default.randomBytes(32).toString('hex'),
            expires_at: expiresAt,
        }));
        await db_1.db.transaction(async (trx) => {
            await (0, db_1.db)('invitations').insert(rows).transacting(trx);
        });
        for (const row of rows) {
            const registerUrl = `${env_1.env.WEB_URL}/register/${row.token}`;
            void email_queue_1.emailQueue.add({
                to: row.email,
                subject: "You're invited to join UniConnecT",
                text: JSON.stringify({
                    template: 'invitation',
                    userName: '',
                    registerUrl,
                    role: input.role,
                    universityName,
                    token: row.token,
                }),
            });
        }
        return { created: rows.length, emails: rows.map((r) => r.email) };
    }
    async listInvitations(universityId, query) {
        const [{ count }] = await (0, db_1.db)('invitations')
            .where({ university_id: universityId })
            .count({ count: '*' });
        const rows = await (0, db_1.db)('invitations')
            .where({ university_id: universityId })
            .select('*')
            .orderBy('created_at', 'desc')
            .limit(query.limit)
            .offset((query.page - 1) * query.limit);
        return {
            items: rows.map(toInvitation),
            total: Number(count),
            page: query.page,
            limit: query.limit,
        };
    }
    async deleteInvitation(universityId, invitationId) {
        const deleted = await (0, db_1.db)('invitations')
            .where({ id: invitationId, university_id: universityId })
            .delete();
        if (deleted === 0)
            throw (0, errors_1.notFound)('Invitation not found');
        return { deleted: true };
    }
    async getAllowedEmailDomains(universityId) {
        const row = await (0, db_1.db)('universities')
            .select('allowed_email_domains')
            .where({ id: universityId })
            .first();
        return { allowedEmailDomains: row?.allowed_email_domains ?? [] };
    }
    async updateAllowedEmailDomains(universityId, domains) {
        const unique = [...new Set(domains.map((d) => d.trim().toLowerCase()).filter(Boolean))];
        await (0, db_1.db)('universities')
            .where({ id: universityId })
            .update({ allowed_email_domains: db_1.db.raw('?::text[]', [unique.length ? `{${unique.join(',')}}` : '{}']) });
        return { allowedEmailDomains: unique };
    }
    async listRedemptions(universityId, query) {
        const base = (0, db_1.db)('mentor_redemptions')
            .where('mentor_redemptions.university_id', universityId)
            .modify((builder) => {
            if (query.status)
                builder.where('mentor_redemptions.status', query.status);
        });
        const [{ count }] = await base.clone().count({ count: '*' });
        const total = Number(count);
        const rows = await base
            .clone()
            .join('users', 'users.id', 'mentor_redemptions.user_id')
            .join('profiles', 'profiles.user_id', 'users.id')
            .join('gift_cards', 'gift_cards.id', 'mentor_redemptions.gift_card_id')
            .select('mentor_redemptions.id', 'mentor_redemptions.status', 'mentor_redemptions.points_spent', 'mentor_redemptions.code_text', 'mentor_redemptions.admin_note', 'mentor_redemptions.requested_at', 'mentor_redemptions.fulfilled_at', 'users.id as user_id', 'users.email as user_email', 'profiles.full_name as user_full_name', 'profiles.avatar_url as user_avatar_url', 'gift_cards.id as gift_card_id', 'gift_cards.vendor as gift_card_vendor', 'gift_cards.title as gift_card_title', 'gift_cards.value_usd_cents as gift_card_value_usd_cents')
            .orderBy('mentor_redemptions.requested_at', 'desc')
            .limit(query.limit)
            .offset((query.page - 1) * query.limit);
        return {
            items: rows.map(toAdminRedemption),
            total,
            page: query.page,
            limit: query.limit,
        };
    }
    async updateRedemption(universityId, adminUserId, redemptionId, input) {
        return db_1.db.transaction(async (trx) => {
            const row = await trx('mentor_redemptions')
                .where({ id: redemptionId, university_id: universityId })
                .forUpdate()
                .select('id', 'user_id', 'points_spent', 'status')
                .first();
            if (!row)
                throw (0, errors_1.notFound)('Redemption not found', 'REDEMPTION_NOT_FOUND');
            if (row.status !== 'pending') {
                throw (0, errors_1.badRequest)('Redemption has already been processed', 'REDEMPTION_ALREADY_PROCESSED');
            }
            if (input.status === 'rejected') {
                await trx('profiles')
                    .where({ user_id: row.user_id })
                    .increment('mentorship_points', row.points_spent);
            }
            await trx('mentor_redemptions')
                .where({ id: redemptionId })
                .update({
                status: input.status,
                code_text: input.codeText ?? null,
                admin_note: input.adminNote ?? null,
                fulfilled_at: trx.fn.now(),
                fulfilled_by: adminUserId,
            });
            (0, socket_1.getIo)()
                .to(`user:${row.user_id}`)
                .emit('mentorship:redemption:updated', {
                redemptionId,
                status: input.status,
            });
            return { id: redemptionId, status: input.status };
        });
    }
}
exports.AdminService = AdminService;
exports.adminService = new AdminService();
async function countWhere(table, where) {
    const [{ count }] = await (0, db_1.db)(table).where(where).count({ count: '*' });
    return Number(count);
}
async function countActive(universityId) {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const [{ count }] = await (0, db_1.db)('users')
        .where('university_id', universityId)
        .andWhere('last_active_at', '>=', since)
        .count({ count: '*' });
    return Number(count);
}
function toAdminUser(row) {
    return {
        id: row.id,
        email: row.email,
        role: row.role,
        isVerified: row.is_verified,
        isActive: row.is_active,
        lastActiveAt: row.last_active_at,
        createdAt: row.created_at,
        profile: {
            fullName: row.full_name,
            avatarUrl: row.avatar_url,
            department: row.department,
            batchYear: row.batch_year,
        },
    };
}
function toReport(row) {
    return {
        id: row.id,
        reporterId: row.reporter_id,
        reporterName: row.reporter_full_name,
        targetId: row.target_id,
        targetType: row.target_type,
        reason: row.reason,
        description: row.description,
        status: row.status,
        resolvedBy: row.resolved_by,
        createdAt: row.created_at,
        resolvedAt: row.resolved_at,
    };
}
function toAdminRedemption(row) {
    return {
        id: row.id,
        status: row.status,
        pointsSpent: row.points_spent,
        codeText: row.code_text,
        adminNote: row.admin_note,
        requestedAt: row.requested_at,
        fulfilledAt: row.fulfilled_at,
        user: {
            id: row.user_id,
            email: row.user_email,
            fullName: row.user_full_name,
            avatarUrl: row.user_avatar_url,
        },
        giftCard: {
            id: row.gift_card_id,
            vendor: row.gift_card_vendor,
            title: row.gift_card_title,
            valueUsdCents: row.gift_card_value_usd_cents,
        },
    };
}
function toInvitation(row) {
    return {
        id: row.id,
        email: row.email,
        role: row.role,
        token: row.token,
        isUsed: row.is_used,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
    };
}
